import SwiftUI
extension Color {
    init(hex:String) { let n=UInt64(hex.trimmingCharacters(in:CharacterSet.alphanumerics.inverted),radix:16) ?? 0; self.init(red:Double((n>>16)&255)/255,green:Double((n>>8)&255)/255,blue:Double(n&255)/255) }
}
enum Design {
    static let bg=Color(hex:"0b0d0c"),surface=Color(hex:"1a1d1c"),text=Color(hex:"f2f5f3"),secondary=Color(hex:"959e99"),green=Color(hex:"21c25e"),lime=Color(hex:"c3f73a")
}
@MainActor enum Art {
    static var mapping:[String:String] = { guard let u=Bundle.main.url(forResource:"asset-map",withExtension:"json"),let d=try? Data(contentsOf:u),let m=try? JSONDecoder().decode([String:String].self,from:d) else { return [:] };return m }()
    static let animations:JSON = { guard let u=Bundle.main.url(forResource:"animation-map",withExtension:"json"),let d=try? Data(contentsOf:u),let m=try? JSONDecoder().decode(JSON.self,from:d) else{return .null};return m }()
    static let epoch=Date()
    static func name(_ source:String)->String { mapping[source] ?? source }
    static func uiImage(_ source:String)->UIImage? {let n=name(source);return n.hasPrefix("/") ? UIImage(contentsOfFile:n):UIImage(named:n)}
    static func image(_ source:String)->Image {if let i=uiImage(source){return Image(uiImage:i)};return Image(name(source))}
    static func ratio(_ source:String)->Double {guard let i=uiImage(source) else{return 1};return i.size.width/i.size.height}
    struct Part {var source:String,dx:Double=0,dy:Double=0,opacity:Double=1}
    static func parts(_ source:String,age:Double)->[Part] {
        let anim=animations[source];guard anim != .null else{return [Part(source:source)]}
        var parts=[Part(source:anim["base"].string)]
        for layer in anim["layers"].array {
            let duration=layer["duration"].number,begin=layer["begin"].number
            let t=max(0,age-begin).truncatingRemainder(dividingBy:max(0.01,duration))/max(0.01,duration)
            let vals=layer["values"].string.split(separator:";").map{ $0.split(separator:" ").compactMap{Double($0)} }
            let f=t*Double(vals.count-1),a=min(vals.count-1,Int(f)),b=min(vals.count-1,a+1),u=f-Double(a)
            func component(_ i:Int)->Double {let x=i<vals[a].count ? vals[a][i]:0,y=i<vals[b].count ? vals[b][i]:x;return x+(y-x)*u}
            if layer["attribute"].string == "opacity" {parts.append(Part(source:layer["source"].string,opacity:component(0)))}
            else {parts.append(Part(source:layer["source"].string,dx:component(0)/anim["width"].number,dy:component(1)/anim["height"].number))}
        }
        return parts
    }
}
struct NativeArt:View {
    let source:String
    @Environment(\.accessibilityReduceMotion) private var reduced
    var body:some View {
        if Art.animations[source] == .null {Art.image(source).resizable().scaledToFit()}
        else {TimelineView(.animation(minimumInterval:1/30,paused:reduced)) {time in GeometryReader {g in
            let ratio=Art.ratio(source),w=min(g.size.width,g.size.height*ratio),h=w/ratio,age=reduced ? 0:time.date.timeIntervalSince(Art.epoch)
            ZStack {ForEach(Array(Art.parts(source,age:age).enumerated()),id:\.offset) {_,part in Art.image(part.source).resizable().scaledToFit().frame(width:w,height:h).opacity(part.opacity).offset(x:part.dx*w,y:part.dy*h)}}.frame(width:g.size.width,height:g.size.height)
        }}}
    }
}
struct Sticker:View {
    let source:String
    var style="sticker"
    var body:some View {
        NativeArt(source:source).compositingGroup()
            .saturation(style == "sketch" ? 0.7:1)
            .shadow(color:style == "neon" ? Color(hex:"b197fc"):style == "gold" ? Color(hex:"ffd43b"):.white,radius:style == "neon" || style == "gold" ? 8:0,x:2,y:0)
            .shadow(color:style == "sticker" ? .white:.clear,radius:0,x:-2,y:0)
            .shadow(color:style == "sticker" ? .white:.clear,radius:0,x:0,y:2)
            .shadow(color:style == "sticker" ? .white:.clear,radius:0,x:0,y:-2)
            .shadow(color:.black.opacity(0.3),radius:6,y:6)
            .accessibilityHidden(true)
    }
}

struct PressStyle:ButtonStyle { func makeBody(configuration:Configuration)->some View { configuration.label.scaleEffect(configuration.isPressed ? 0.96:1).animation(.easeOut(duration:0.12),value:configuration.isPressed) } }
struct AnchorKey:PreferenceKey {
    static let defaultValue:[String:Anchor<CGRect>]=[:]
    static func reduce(value:inout [String:Anchor<CGRect>],nextValue:()->[String:Anchor<CGRect>]) { value.merge(nextValue(),uniquingKeysWith:{$1}) }
}
extension View { func effectAnchor(_ id:String)->some View { anchorPreference(key:AnchorKey.self,value:.bounds) { [id:$0] } } }
