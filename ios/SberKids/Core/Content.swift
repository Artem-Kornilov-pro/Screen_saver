import Foundation

/// Lossless Codable tree: permits future fields without executing remote code.
indirect enum JSON: Codable, Sendable, Equatable {
    case object([String: JSON]), array([JSON]), string(String), number(Double), bool(Bool), null
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSON].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSON].self)) }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self { case .object(let x): try c.encode(x); case .array(let x): try c.encode(x); case .string(let x): try c.encode(x); case .number(let x): try c.encode(x); case .bool(let x): try c.encode(x); case .null: try c.encodeNil() }
    }
    subscript(_ key: String) -> JSON { if case .object(let x) = self { return x[key] ?? .null }; return .null }
    var string: String { if case .string(let x) = self { return x }; return "" }
    var number: Double { if case .number(let x) = self { return x }; return 0 }
    var bool: Bool { if case .bool(let x) = self { return x }; return false }
    var array: [JSON] { if case .array(let x) = self { return x }; return [] }
    var object: [String: JSON] { if case .object(let x) = self { return x }; return [:] }
    func num(_ key: String, _ fallback: Double) -> Double { self[key] == .null ? fallback : self[key].number }
    func text(_ key: String, _ fallback: String = "") -> String { self[key] == .null ? fallback : self[key].string }
    func merging(_ over: JSON) -> JSON {
        guard case .object(var base) = self, case .object(let patch) = over else { return over }
        for (k, v) in patch { base[k] = base[k].map { $0.merging(v) } ?? v }
        return .object(base)
    }
    func setting(_ path: [String], _ value: JSON) -> JSON {
        guard let key = path.first else { return value }
        if case .array(var a) = self, let i = Int(key), a.indices.contains(i) { a[i] = a[i].setting(Array(path.dropFirst()), value); return .array(a) }
        var o = object; o[key] = self[key].setting(Array(path.dropFirst()), value); return .object(o)
    }
}
struct ContentRules {
    static let renderers: Set<String> = ["combo", "skin", "sticker", "particles", "badge", "rays", "night"]
    static func merge(_ base: JSON, _ patch: JSON) throws -> JSON {
        guard patch["schema"].number == 1 else { throw ContentError.schema }
        var merged = base.merging(patch)
        for key in ["items", "events"] {
            var entries = base[key].array
            for p in patch[key].array where !p["id"].string.isEmpty {
                if let i = entries.firstIndex(where: { $0["id"] == p["id"] }) { entries[i] = entries[i].merging(p) }
                else { entries.append(p) }
            }
            // One invalid entry does not destroy the valid bundle set.
            entries = entries.filter { renderers.contains($0["effect"]["type"].string) && !($0["pack"].string.contains("..")) }
            merged = merged.setting([key], .array(entries))
        }
        let limits: [String:(Double,Double,Double)] = [
            "holidayPriority":(0,1000,40),"maxParticles":(10,150,80),"comboIdleMs":(2000,30000,7000),"finaleMs":(1000,10000,3200),"buddyLingerMs":(0,30000,5000),"buddyFadeMs":(200,5000,1000),"traceRadius":(12,80,30),"goldChance":(0,1,0.1),"flipHoldMs":(300,5000,1200),"flipDownAngle":(120,179,150),"flipUpAngle":(10,90,60)]
        for (key,(low,high,fallback)) in limits { let v=merged["settings"].num(key,fallback);merged=merged.setting(["settings",key],.number(v.isFinite ? max(low,min(high,v)):fallback)) }
        return merged
    }
    static func matches(_ when: JSON, date: Date, calendar: Calendar, birthday: String = "") -> Bool {
        let m = calendar.component(.month, from: date), d = calendar.component(.day, from: date)
        let md = String(format: "%02d-%02d", m, d)
        switch when["type"].string {
        case "fixed": return when["md"].string == md
        case "range": let a = when["from"].string, b = when["to"].string; return a <= b ? md >= a && md <= b : md >= a || md <= b
        case "birthday": return String(birthday.suffix(5)) == md
        case "dates": let ymd = String(format: "%04d-%02d-%02d", calendar.component(.year, from: date), m, d); return when["list"].array.contains(.string(ymd))
        case "nth_weekday":
            guard m == Int(when["month"].number), (calendar.component(.weekday, from: date) + 5) % 7 + 1 == Int(when["weekday"].number) else { return false }
            let n = Int(when["n"].number), days = calendar.range(of: .day, in: .month, for: date)!.count
            return n > 0 ? (d + 6) / 7 == n : (days - d) / 7 + 1 == -n
        default: return false
        }
    }
    static func pick(_ manifest: JSON, date: Date, calendar: Calendar, birthday: String = "", age: Int = 9) -> JSON? {
        guard manifest["enabled"] != .bool(false) else { return nil }
        let entries = manifest["items"].array.filter { i in i["enabled"] != .bool(false) && versionGte("1.0.0",i.text("minAppVersion","1.0.0")) && renderers.contains(i["effect"]["type"].string) && (i["age"] == .null || (Double(age) >= i["age"].num("min", 0) && Double(age) <= i["age"].num("max", 100))) }
        let dated = entries.filter { !$0["pool"].bool && matches($0["when"], date: date, calendar: calendar, birthday: birthday) }.sorted { rank($0) > rank($1) }
        if let first = dated.first, rank(first) >= manifest["settings"].num("holidayPriority", 40) { return first }
        let rotation = dated + entries.filter { $0["pool"].bool }
        var utc = Calendar(identifier: .gregorian); utc.timeZone = TimeZone(secondsFromGMT: 0)!
        let c = calendar.dateComponents([.year,.month,.day], from: date)
        let day = Int(utc.date(from: c)!.timeIntervalSince1970 / 86400)
        return rotation.isEmpty ? nil : rotation[((day % rotation.count) + rotation.count) % rotation.count]
    }
    static func dressed(_ item:JSON,manifest:JSON,date:Date,calendar:Calendar)->JSON {
        guard item["pool"].bool,let season=manifest["seasons"].object.values.first(where:{$0["months"].array.contains(.number(Double(calendar.component(.month,from:date))))}) else{return item}
        var result=item
        if item["effect"]["buddy"] != .null {for (k,v) in ["wear":JSON.string("effects/doodles/"+season["pack"].string+season["wear"].string),"wearScale":season["wearScale"],"wearTop":season["wearTop"],"wearFit":season["wearFit"]] {result=result.setting(["effect","buddy",k],v)}}
        guard item["seasonParticles"].bool else{return result}
        let sprites=season["particles"].array.map{JSON.string("effects/doodles/"+season["pack"].string+$0.string)}
        let fall:JSON = .object(["type":.string("particles"),"sprites":.array(sprites),"count":.number(14),"origin":.string("top"),"angle":.array([.number(70),.number(110)]),"speed":.array([.number(90),.number(180)]),"gravity":.number(80),"sway":.number(50),"size":.array([.number(14),.number(26)]),"durationMs":.number(3200),"delayMs":.number(200)])
        result=result.setting(["effect","steps"],.array(result["effect"]["steps"].array+[fall]))
        if result["effect"]["combo"]["effect"]["type"].string == "combo" {result=result.setting(["effect","combo","effect","steps"],.array(result["effect"]["combo"]["effect"]["steps"].array+[fall]))}
        return result
    }
    static func versionGte(_ actual:String,_ minimum:String)->Bool {
        let a=actual.split(separator:".").map{Int($0) ?? 0},b=minimum.split(separator:".").map{Int($0) ?? 0}
        for i in 0..<max(a.count,b.count) {let x=i<a.count ? a[i]:0,y=i<b.count ? b[i]:0;if x != y {return x>y}};return true
    }
    static func rank(_ i: JSON) -> Double { i["when"]["type"].string == "birthday" ? .infinity : i["priority"].number }
    static func weighted(_ variants: [JSON], random: Double) -> JSON? {
        let total = variants.reduce(0) { $0 + max(0, $1["weight"].number) }
        guard total > 0 else { return nil }; var r = random * total
        for v in variants { r -= max(0, v["weight"].number); if r < 0 { return v } }; return variants.last
    }
    static func matchRule(_ r: JSON, value: Int) -> Bool {
        let n = abs(value), s = String(n), count = Int(r.num("min", 3)), v = r["value"].string.isEmpty ? String(Int(r["value"].number)) : r["value"].string
        switch r["type"].string {
        case "repeat": return s.count >= count && Set(s).count == 1
        case "multiple": let divisor = Int(r["of"].number); return divisor > 0 && n >= divisor && n % divisor == 0
        case "sequence": let a = s.compactMap(\.wholeNumberValue); guard a.count >= count, a.count > 1, abs(a[1]-a[0]) == 1 else { return false }; return zip(a.dropFirst(),a).allSatisfy { $0.0 - $0.1 == a[1]-a[0] }
        case "mirror": return s.count >= Int(r.num("min",4)) && s == String(s.reversed()) && Set(s).count > 1
        case "contains": return s.contains(v)
        case "endsWith": return s.hasSuffix(v)
        case "equals": return n == Int(v)
        default: return false
        }
    }
    static func clockMatches(_ m: JSON, date: Date, calendar: Calendar) -> Bool {
        let parts: [String: Int] = ["month": calendar.component(.month, from: date), "day": calendar.component(.day, from: date), "weekday": (calendar.component(.weekday, from: date)+5)%7+1, "hour": calendar.component(.hour, from: date), "minute": calendar.component(.minute, from: date)]
        for (k,v) in parts where m[k] != .null { if !m[k].array.isEmpty { if !m[k].array.contains(.number(Double(v))) { return false } } else if Int(m[k].number) != v { return false } }
        if m["hours"].array.count == 2 { return Double(parts["hour"]!) >= m["hours"].array[0].number && Double(parts["hour"]!) <= m["hours"].array[1].number }; return true
    }
}
enum ContentError: Error { case schema, tooLarge, source, resource }

struct ComboState: Sendable {
    var level = 0, taps: [Double] = [], lastAction = -Double.infinity
    mutating func trigger(_ kind: String, at now: Double, effect: JSON, settings: JSON) -> Bool {
        let combo = effect["combo"], finale = combo.text("finale", "shake")
        if level > 0 && level < 3 && now - lastAction > settings.num("comboIdleMs",7000)/1000 { self = ComboState() }
        let accepts = effect["trigger"].array.isEmpty ? kind == "tap" : effect["trigger"].array.contains(.string(kind))
        if level == 0 { guard accepts else { return false }; level = 1 }
        else if level == 1 {
            guard kind == "tap" || accepts || kind == finale else { return false }
            if kind == "tap" && combo.text("mode") != "trace" {
                taps = taps.filter { now - $0 < combo.num("windowMs",2500)/1000 }; taps.append(now)
                if taps.count >= Int(combo.num("taps",3)) { level = 2; taps = [] }
            }
        } else if level == 2 { guard kind == "tap" || kind == finale else { return false }; if kind == finale { level = 3 } }
        lastAction = now; return true
    }
}
enum QRPhase: String, Sendable { case search, catching, found, error }
struct QRState: Sendable {
    var phase: QRPhase = .search
    var theme = "detective", frame = "classic", payload = ""
    mutating func selectTheme(_ id: String) { theme = id; reset() }
    mutating func selectFrame(_ id: String) { frame = id }
    mutating func read(_ value: String) -> Bool { guard phase != .catching && phase != .found else { return false }; payload = String(value.prefix(2048)); phase = .catching; return true }
    mutating func reset() { phase = .search; payload = "" }
}

extension JSON: Identifiable { var id:String { self["id"].string } }
