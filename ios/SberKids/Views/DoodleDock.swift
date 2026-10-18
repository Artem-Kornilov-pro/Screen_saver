import SwiftUI

/// Native hit-testing moves with the visible sticker; the avatar's first 72 pt stay free.
struct DoodleDock:View {
    @ObservedObject var engine:EffectEngine
    @State private var epoch=Date()
    @State private var pausedAt:Date?
    @State private var pausedTotal=0.0
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    var source:String {
        let e=engine.selected["effect"],pack=engine.selected["pack"].string
        if !e["buddy"]["image"].string.isEmpty{return "effects/doodles/"+pack+e["buddy"]["image"].string}
        if !e["hint"]["image"].string.isEmpty{return "effects/doodles/"+pack+e["hint"]["image"].string}
        if let step=e["steps"].array.first(where:{$0["type"].string == "skin" || $0["type"].string == "sticker" && !$0["fullWidth"].bool}){return "effects/doodles/"+pack+step["image"].string}
        return "effects/doodles/packs/events/sparkle.svg"
    }
    var body:some View {
        GeometryReader {g in
            TimelineView(.animation(minimumInterval:1/60,paused:!engine.active || engine.reduced || systemReduced)) {time in
                let moving = !engine.reduced && !systemReduced
                let elapsed=max(0,(pausedAt ?? time.date).timeIntervalSince(epoch)-pausedTotal)
                let k=moving ? 0.5-cos(elapsed/9 * .pi*2)/2:0
                let width=40*Art.ratio(source),travel=max(0,g.size.width-(width+20)-72)
                let style=engine.combo.level == 0 ? "plain":engine.combo.level == 1 ? "sketch":engine.combo.level == 2 ? "sticker":engine.gold ? "gold":"neon"
                let age=time.date.timeIntervalSince(epoch),idle=sin(age/3.4 * .pi*2),playing=sin(age/0.9 * .pi*2)
                Button {engine.nodes.removeAll{$0.seasonal};_ = engine.gesture("tap")} label:{
                    Sticker(source:source,style:style).frame(width:width,height:40).overlay(alignment:.topLeading) {wear(width:width,height:40)}
                        .rotationEffect(.degrees(moving ? (engine.combo.level>0 ? playing*8:idle*7):0))
                        .scaleEffect(moving && engine.combo.level>0 ? 1.07+playing*0.07:1)
                        .offset(y:moving && engine.combo.level == 0 ? -3+idle*3:0)
                        .padding(.horizontal,10).frame(height:60).contentShape(Rectangle())
                }.position(x:g.size.width-(width+20)/2+4-k*travel,y:g.size.height/2)
                    .accessibilityLabel("Дудл: "+engine.selected["title"].string).accessibilityIdentifier("doodle.capsule").effectAnchor("buddy")
            }
        }.onChange(of:engine.combo.level) {level in
            if level>0,pausedAt == nil {pausedAt=Date()}
            if level == 0,let start=pausedAt {pausedTotal+=Date().timeIntervalSince(start);pausedAt=nil}
        }.onChange(of:engine.selected["id"].string) {_ in epoch=Date();pausedAt=nil;pausedTotal=0}
    }
    @ViewBuilder private func wear(width:Double,height:Double)->some View {
        let b=engine.selected["effect"]["buddy"],fit=b["wearFit"],head=b["head"]
        if !b["wear"].string.isEmpty,head != .bool(false) {
            let h=fit == .null ? height*b.num("wearScale",1.2)/Art.ratio(b["wear"].string):head.num("w",0.6)*width/fit.num("bandW",0.5)/Art.ratio(b["wear"].string)
            let w=h*Art.ratio(b["wear"].string)
            let x=fit == .null ? (width-w)/2:head.num("x",0.5)*width-w/2
            let line=fit["at"].string == "eyes" ? head.num("eyes",0.45):head.num("y",0.12)
            let y=fit == .null ? height*b.num("wearTop",-0.5):line*height-fit.num("bandY",0.5)*h
            Sticker(source:b["wear"].string,style:"plain").frame(width:w,height:h).mask(alignment:.top) {Rectangle().frame(height:h*fit.num("clip",1))}.offset(x:x,y:y).allowsHitTesting(false)
        }
    }
}
struct GestureHint:View {
    let kind:String
    @Environment(\.accessibilityReduceMotion) private var reduced
    var body:some View {
        TimelineView(.animation(minimumInterval:1/30,paused:reduced)) {time in
            let age=time.date.timeIntervalSinceReferenceDate,s=sin(age * .pi*2/2.2)
            ZStack {
                if kind == "tap3" || kind == "pull" || kind == "trace" {Image(systemName:kind == "trace" ? "pencil.tip":"hand.point.up.left.fill").font(.system(size:60)).offset(y:kind == "pull" && !reduced ? s*8:0)}
                else {RoundedRectangle(cornerRadius:9).stroke(Design.lime,lineWidth:4).frame(width:42,height:76).overlay(RoundedRectangle(cornerRadius:4).fill(Design.lime.opacity(kind == "flip" && s<0 ? 0:0.35)).padding(7)).scaleEffect(x:1,y:kind == "flip" && !reduced ? (abs(s)<0.06 ? 0.06:s):1).rotationEffect(.degrees(kind == "shake" && !reduced ? sin(age*18)*10:0))}
            }.foregroundColor(Design.lime).shadow(color:Design.lime.opacity(0.5),radius:10)
        }.frame(width:104,height:104).allowsHitTesting(false).accessibilityHidden(true)
    }
}
