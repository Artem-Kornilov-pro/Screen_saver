import Foundation
import CryptoKit
import ImageIO

struct ContentSnapshot: Sendable {
    var manifest: JSON
    var seasonal: JSON
    var native: JSON
    var source: String
    var revision: String
}
actor ConfigurationStore {
    let bundle: ContentSnapshot
    let cacheURL: URL
    let maxBytes = 2 * 1024 * 1024
    let assetBudget = 6 * 1024 * 1024
    private let client=URLSession(configuration:.ephemeral,delegate:HTTPSRedirectPolicy(),delegateQueue:nil)
    private var assetDirectory:URL { cacheURL.deletingLastPathComponent().appendingPathComponent("assets") }
    private func validPNG(_ data:Data)->Bool {
        guard data.starts(with:[137,80,78,71,13,10,26,10]),let source=CGImageSourceCreateWithData(data as CFData,nil),let properties=CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [CFString:Any],let width=properties[kCGImagePropertyPixelWidth] as? Int,let height=properties[kCGImagePropertyPixelHeight] as? Int else{return false}
        return width>0 && height>0 && width<=2048 && height<=2048
    }
    private func digest(_ data:Data)->String {SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined()}
    private func assetMap(_ patch:JSON)throws->[String:JSON] {
        var map=bundle.native["assetMap"].object
        guard patch["assets"].array.count<=64 else{throw ContentError.tooLarge}
        for asset in patch["assets"].array {
            let id=asset["id"].string,hash=asset["sha256"].string
            guard id.hasPrefix("effects/"),!id.contains(".."),!id.contains(":"),hash.count == 64,hash.allSatisfy({$0.isHexDigit}) else{throw ContentError.resource}
            let url=assetDirectory.appendingPathComponent(hash+".png")
            guard let data=try? Data(contentsOf:url),data.count<=assetBudget,validPNG(data),digest(data) == hash else{throw ContentError.resource}
            map[id] = .string(url.path)
        }
        return map
    }
    private func fetch(_ url:URL,limit:Int)async throws->Data {
        var request=URLRequest(url:url);request.timeoutInterval=12;request.cachePolicy = .reloadIgnoringLocalCacheData
        let (bytes,response)=try await client.bytes(for:request)
        guard let http=response as? HTTPURLResponse,http.statusCode == 200,response.url?.host == url.host,response.url?.scheme == "https",response.expectedContentLength<=Int64(limit) else{throw ContentError.source}
        var data=Data();for try await byte in bytes {data.append(byte);if data.count>limit {throw ContentError.tooLarge}};return data
    }
    private func downloadAssets(_ patch:JSON,base:URL)async throws {
        guard patch["assets"].array.count<=64 else{throw ContentError.tooLarge}
        try FileManager.default.createDirectory(at:assetDirectory,withIntermediateDirectories:true)
        var bytes=((try? FileManager.default.contentsOfDirectory(at:assetDirectory,includingPropertiesForKeys:[.fileSizeKey])) ?? []).reduce(0){$0+((try? $1.resourceValues(forKeys:[.fileSizeKey]).fileSize) ?? 0)}
        for asset in patch["assets"].array {
            let hash=asset["sha256"].string
            guard hash.count == 64,hash.allSatisfy({$0.isHexDigit}),let url=URL(string:asset["url"].string,relativeTo:base)?.absoluteURL,url.host == base.host,url.scheme == "https",url.pathExtension.lowercased() == "png" else{throw ContentError.source}
            let target=assetDirectory.appendingPathComponent(hash+".png")
            var data=try? Data(contentsOf:target)
            if data == nil || digest(data!) != hash {data=try await fetch(url,limit:assetBudget)}
            guard let data,validPNG(data),digest(data) == hash else{throw ContentError.resource};bytes+=data.count-((try? target.resourceValues(forKeys:[.fileSizeKey]).fileSize) ?? 0);guard bytes<=assetBudget else{throw ContentError.tooLarge}
            try data.write(to:target,options:.atomic)
        }
    }
    private func trimAssets(keeping patch:JSON) {
        let keep=Set(patch["assets"].array.map{$0["sha256"].string+".png"})
        for file in (try? FileManager.default.contentsOfDirectory(at:assetDirectory,includingPropertiesForKeys:nil)) ?? [] where !keep.contains(file.lastPathComponent) {try? FileManager.default.removeItem(at:file)}
    }
    init(bundle: ContentSnapshot, cacheURL: URL) { self.bundle = bundle; self.cacheURL = cacheURL }
    func cached() -> ContentSnapshot {
        guard let d = try? Data(contentsOf: cacheURL), let s = try? validate(d, source: "cache") else { return bundle }; if let patch=try? JSONDecoder().decode(JSON.self,from:d) {trimAssets(keeping:patch)};return s
    }
    func validate(_ data: Data, source: String) throws -> ContentSnapshot {
        guard data.count <= maxBytes else { throw ContentError.tooLarge }
        let patch = try JSONDecoder().decode(JSON.self, from: data)
        guard patch["schema"].number == 1 else { throw ContentError.schema }
        let m = try ContentRules.merge(bundle.manifest, patch["doodles"].merging(.object(["schema": .number(1)])))
        var s = patch["seasonal"] == .null ? bundle.seasonal : bundle.seasonal.merging(patch["seasonal"])
        if patch["seasonal"]["effects"] != .null {
            var entries = bundle.seasonal["effects"].array
            for entry in patch["seasonal"]["effects"].array {
                if let i = entries.firstIndex(where: { $0["id"] == entry["id"] }) { entries[i] = entries[i].merging(entry) }
            }
            s = s.setting(["effects"],.array(entries))
        }
        let map=try assetMap(patch)
        let n = (patch["native"] == .null ? bundle.native : bundle.native.merging(patch["native"])).setting(["assetMap"],.object(map))
        // Assets must already have a compiled native representation. Unknown resources reject only this update.
        func check(_ j: JSON, pack: String) throws {
            for (k,v) in j.object {
                if ["image","wear"].contains(k), !v.string.isEmpty, map["effects/doodles/"+pack+v.string] == nil, !v.string.hasPrefix("effects/") { throw ContentError.resource }
                if k == "sprites" { for a in v.array where !a.string.hasPrefix("effects/") { if map["effects/doodles/"+pack+a.string] == nil { throw ContentError.resource } } }
                if case .object = v { try check(v,pack:pack) }; if case .array = v { for a in v.array { try check(a,pack:pack) } }
            }
        }
        for i in m["items"].array + m["events"].array { try check(i["effect"],pack:i["pack"].string) }
        return ContentSnapshot(manifest:m, seasonal:s, native:n, source:source, revision:patch.text("revision","1"))
    }
    func local(_ data: Data) throws -> ContentSnapshot { try validate(data, source:"local fixture") }
    func update(from url: URL) async throws -> ContentSnapshot {
        guard url.scheme == "https", url.host != nil, url.user == nil, url.password == nil else { throw ContentError.source }
        let data=try await fetch(url,limit:maxBytes)
        let patch=try JSONDecoder().decode(JSON.self,from:data)
        guard patch["schema"].number == 1 else{throw ContentError.schema}
        try await downloadAssets(patch,base:url)
        let result = try validate(data,source:"CDN")
        try FileManager.default.createDirectory(at:cacheURL.deletingLastPathComponent(),withIntermediateDirectories:true)
        try data.write(to:cacheURL,options:.atomic)
        return result
    }
}

/// Refuse redirects before a request can leave the explicitly configured HTTPS host.
final class HTTPSRedirectPolicy:NSObject,URLSessionTaskDelegate,Sendable {
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping @Sendable (URLRequest?)->Void) {
        completionHandler(request.url?.scheme == "https" && request.url?.host == task.originalRequest?.url?.host ? request:nil)
    }
}
