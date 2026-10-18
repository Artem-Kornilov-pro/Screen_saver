import SwiftUI

struct SceneNode: Identifiable {
    let id=UUID()
    var spec:JSON,pack:String,style:String,start:Date,duration:Double
    var source:String="",x=0.0,y=0.0,vx=0.0,vy=0.0,gravity=0.0,drag=0.0,sway=0.0,phase=0.0,spin=0.0,size=20.0
    var from=CGPoint.zero,to=CGPoint.zero
    var seasonal=false,settleY:Double?,melt=20.0
    var label=""
}
@MainActor final class EffectEngine:ObservableObject {
    @Published var nodes:[SceneNode]=[]
    @Published var skins:[String:String]=[:]
    @Published var combo=ComboState()
    @Published var gold=false
    @Published var selected:JSON = .null
    @Published var fact=""
    @Published var active=true
    @Published var treeTapAt=Date.distantPast
    @Published var showHint=false
    var hintKind="tap3"
    private var hintTask:Task<Void,Never>?
    var anchors:[String:CGRect]=[:],size=CGSize(width:375,height:812)
    var manifest:JSON = .null,seasonal:JSON = .null
    var effectiveDate=Date()
    var reduced=false,forceGold=false,suppressed=false,wind=0.0
    private var eventLast:[String:Date]=[:]
    private var resetTask:Task<Void,Never>?
    var settings:JSON { manifest["settings"] }
    var dayKey:String { let f=DateFormatter();f.dateFormat="yyyy-MM-dd";return f.string(from:Date()) }
    func point(_ anchor:String)->CGPoint { if anchor == "center" {return CGPoint(x:size.width/2,y:size.height*0.44)};let r=anchors[anchor] ?? anchors["avatar"] ?? CGRect(x:16,y:70,width:44,height:44);return CGPoint(x:r.midX,y:r.midY) }
    func choose(date:Date,birthday:String="") {
        effectiveDate=date;skins=[:]
        selected=ContentRules.dressed(ContentRules.pick(manifest,date:date,calendar:.current,birthday:birthday) ?? .null,manifest:manifest,date:date,calendar:.current)
        combo=ComboState();gold=false;fact=""
        let key="skin."+selected["id"].string+dayKey
        if UserDefaults.standard.bool(forKey:key) { restoreSkins(selected["effect"],pack:selected["pack"].string) }
        for step in selected["effect"]["steps"].array where step["auto"].bool { run(step,pack:selected["pack"].string,style:"sticker",anchor:selected["effect"].text("anchor","avatar")) }
    }
    func restoreSkins(_ e:JSON,pack:String) { for step in e["steps"].array where step["type"].string == "skin" { skins[step.text("anchor","avatar")]="effects/doodles/"+pack+step["image"].string } }
    func select(_ item:JSON) { clear();skins=[:];selected=ContentRules.dressed(item,manifest:manifest,date:effectiveDate,calendar:.current);combo=ComboState();fact="" }
    func clear() { hintTask?.cancel();showHint=false;resetTask?.cancel();nodes=[];combo=ComboState();fact="" }
    func suspend() { active=false;clear() }
    func setSuppressed(_ value:Bool) { suppressed=value;if value { clear();skins=[:] } }
    @discardableResult func gesture(_ kind:String)->Bool {
        guard active,!suppressed,selected != .null,manifest["enabled"] != .bool(false) else { return false }
        let now=Date().timeIntervalSinceReferenceDate,old=combo.level
        if kind == "shake",combo.level == 0,nodes.contains(where:{$0.seasonal && $0.settleY != nil}) { nodes.removeAll(where:{$0.seasonal});return true }
        guard combo.trigger(kind,at:now,effect:selected["effect"],settings:settings) else { return false }
        if combo.level != old { playLevel() }
        resetTask?.cancel()
        let delay=combo.level == 3 ? settings.num("finaleMs",3200):settings.num("comboIdleMs",7000)
        resetTask=Task { [weak self] in try? await Task.sleep(nanoseconds:UInt64(delay*1_000_000));guard !Task.isCancelled else{return};self?.combo=ComboState();self?.fact="" }
        return true
    }
    func traceFinished() { guard combo.level == 1 else{return};combo.level=2;playLevel() }
    private func playLevel() {
        var e=selected["effect"]
        if let variant=ContentRules.weighted(e["variants"].array,random:Double.random(in:0..<1)) {
            for (path,value) in variant["override"].object { e=e.setting(path.split(separator:".").map(String.init),value) }
        }
        let pack=selected["pack"].string,anchor=e.text("anchor","avatar")
        let level=combo.level
        hintTask?.cancel();showHint=false
        if level == 1 || level == 2 {
            hintKind=level == 1 ? (e["combo"]["mode"].string == "trace" ? "trace":"tap3"):e["combo"].text("finale","shake")
            hintTask=Task { [weak self] in try? await Task.sleep(nanoseconds:level == 1 ? 900_000_000:1_100_000_000);guard !Task.isCancelled else{return};self?.showHint=true;try? await Task.sleep(nanoseconds:2_800_000_000);guard !Task.isCancelled else{return};self?.showHint=false }
        }
        if level == 3 {
            gold=forceGold || Double.random(in:0..<1)<e["combo"].num("goldChance",settings.num("goldChance",0.1))
            run(e["combo"]["effect"],pack:pack,style:gold ? "gold":"neon",anchor:anchor)
            burst(pack:pack,style:gold ? "gold":"neon",count:22,anchor:anchor)
        } else {
            run(e,pack:pack,style:level == 1 ? "sketch":"sticker",anchor:anchor,mult:level == 2 ? 1.4:1)
            if level == 2 { burst(pack:pack,style:"sticker",count:12,anchor:anchor) }
            fact=selected["fact"].string
            UserDefaults.standard.set(true,forKey:"found."+selected["id"].string)
        }
        UIImpactFeedbackGenerator(style:.light).impactOccurred()
        UIAccessibility.post(notification:.announcement,argument:level == 3 ? (gold ? "Золотой финал":"Комбо завершено"):level == 2 ? "Последний жест: "+e["combo"].text("finale","shake"):selected["title"].string)
    }
    private func burst(pack:String,style:String,count:Int,anchor:String) {
        let spec:JSON = .object(["type":.string("particles"),"sprites":.array([.string("effects/doodles/packs/events/sparkle.svg")]),"count":.number(Double(count)),"origin":.string("anchor"),"angle":.array([.number(-170),.number(-10)]),"speed":.array([.number(220),.number(520)]),"durationMs":.number(1800)])
        run(spec,pack:pack,style:style,anchor:anchor)
    }
    func run(_ spec:JSON,pack:String,style:String,anchor:String="avatar",mult:Double=1,delay:Double=0,label:String="") {
        guard spec != .null,!suppressed,active else{return}
        prune()
        let type=spec["type"].string
        if type == "combo" { for s in spec["steps"].array where !s["auto"].bool { run(s,pack:pack,style:style,anchor:anchor,mult:mult,delay:delay+spec.num("delayMs",0)/1000,label:label) };return }
        let from=point(anchor),to=point(spec.text("at",anchor)),start=Date().addingTimeInterval(delay+spec.num("delayMs",0)/1000)
        let duration=reduced ? 1.6:spec.num("durationMs",2000)/1000
        if type == "skin" {
            let source="effects/doodles/"+pack+spec["image"].string
            skins[spec.text("anchor",anchor)]=source
            if spec["ttl"].string == "day" { UserDefaults.standard.set(true,forKey:"skin."+selected["id"].string+dayKey) };return
        }
        if type == "particles" {
            guard !reduced else{return};let sprites=spec["sprites"].array.map(\.string);guard !sprites.isEmpty else{return}
            let limit=Int(min(150,max(10,settings.num("maxParticles",80))))
            let count=max(0,min(Int(spec.num("count",30)*mult),limit-nodes.filter{$0.spec["type"].string == "particles"}.count))
            let origin=spec.text("origin"),burst=origin == "anchor" || origin == "at"
            let p=origin == "at" ? to:from
            func range(_ key:String,_ low:Double,_ high:Double)->Double { let a=spec[key].array; return a.count == 2 ? Double.random(in:min(a[0].number,a[1].number)...max(a[0].number,a[1].number)):Double.random(in:low...high) }
            for i in 0..<count {
                let angle=range("angle",-30,120) * .pi/180,speed=range("speed",200,600)*(burst ? 1.35:1),scale=manifest.num("scale",1.4)
                var n=SceneNode(spec:spec,pack:pack,style:style,start:start.addingTimeInterval(Double.random(in:0...(burst ? 0.06:duration*0.35))),duration:duration*Double.random(in:0.7...1))
                let image=sprites[i%sprites.count];n.source=image.hasPrefix("effects/") ? image:"effects/doodles/"+pack+image
                n.x=burst ? p.x:Double.random(in:0...max(1,size.width));n.y=burst ? p.y:origin == "bottom" ? size.height+30:-30
                n.vx=cos(angle)*speed;n.vy=sin(angle)*speed;n.gravity=spec.num("gravity",650);n.drag=spec.num("drag",burst ? 1.6:0);n.sway=spec.num("sway",0);n.phase=Double.random(in:0...6.28);n.spin=Double.random(in:-spec.num("spin",3)...spec.num("spin",3));n.size=range("size",14,30)*scale
                nodes.append(n)
            };return
        }
        for i in 0..<max(1,min(20,Int(spec.num("repeat",1)))) {
            var n=SceneNode(spec:spec,pack:pack,style:style,start:start.addingTimeInterval(Double(i)*spec.num("staggerMs",0)/1000),duration:duration)
            n.source="effects/doodles/"+pack+spec["image"].string;n.from=from;n.to=to;n.size=spec.num("size",72)*manifest.num("scale",1.4);n.label=label
            nodes.append(n)
        }
    }
    func prune() { let now=Date();nodes.removeAll { now.timeIntervalSince($0.start)>$0.duration+($0.settleY == nil ? 0:$0.melt) } }
    func event(_ name:String,value:Int=0,amount:Int=0,date:Date=Date(),debug:Bool=false) {
        guard !suppressed,active,manifest["enabled"] != .bool(false) else{return}
        for d in manifest["events"].array where d["on"].string == name && d["enabled"] != .bool(false) {
            let id=d["id"].string
            if !debug,let last=eventLast[id],Date().timeIntervalSince(last)<d.num("cooldownMs",0)/1000 {continue}
            if name == "balance" { guard value>=Int(d.num("minValue",10)),d["rules"].array.contains(where:{ContentRules.matchRule($0,value:value)}) else{continue} }
            if name == "topup",amount<Int(d.num("minAmount",0)) {continue}
            if name == "clock" {
                guard ContentRules.clockMatches(d["match"],date:date,calendar:.current) else{continue}
                let key="clock."+id
                if !debug,d["oncePerDay"] != .bool(false),UserDefaults.standard.string(forKey:key) == dayKey {continue}
                if !debug {UserDefaults.standard.set(dayKey,forKey:key)}
            }
            eventLast[id]=Date()
            run(d["effect"],pack:d["pack"].string,style:d.text("style","sticker"),anchor:d.text("anchor","avatar"),label:value.formatted(.number.locale(Locale(identifier:"ru_RU"))))
        }
    }
    func showSeason(date:Date,force:Bool=false,id:String?=nil) {
        guard !suppressed,active else{return}
        let effects=seasonal["effects"].array.filter { e in e["enabled"] != .bool(false) && (id == nil ? ContentRules.matches(e["dates"].merging(.object(["type":.string("range")])),date:date,calendar:.current):e["id"].string == id) }.sorted{$0["priority"].number>$1["priority"].number}
        guard let e=effects.first else{return}
        let key="season."+e["id"].string
        if !force,UserDefaults.standard.string(forKey:key) == dayKey {return}
        UserDefaults.standard.set(dayKey,forKey:key)
        nodes.removeAll{$0.seasonal}
        let p=e["particles"],life=e.num("durationMs",7000)/1000,limit=min(150,Int(seasonal.num("maxParticles",80)))
        let count=reduced ? 0:max(0,min(limit,Int(p.num("count",28))))
        func rnd(_ key:String,_ fallback:Double)->Double { let a=p[key].array;return a.count == 2 ? Double.random(in:a[0].number...max(a[0].number,a[1].number)):fallback }
        for i in 0..<count {
            var n=SceneNode(spec:.object(["type":.string("particles")]),pack:"",style:"plain",start:Date().addingTimeInterval(Double(i)/Double(max(1,count))*life*0.5),duration:life)
            n.label=p["colors"].array.isEmpty ? "b6daff":p["colors"].array[i%p["colors"].array.count].string;n.seasonal=true;n.x=Double.random(in:0...max(1,size.width));n.y=p["rise"].bool ? size.height+25:-30;n.vy=rnd("speed",60)*(p["rise"].bool ? -1:1);n.size=rnd("size",20);n.phase=Double.random(in:0...6.28);n.spin=p["spin"].bool ? Double.random(in:-1...1):0;n.sway=20
            let sprites=p["sprites"].array.map(\.string);n.source=sprites.isEmpty ? "snow":"effects/"+sprites[i%sprites.count]
            if p["settle"] != .null,Double.random(in:0...1)<p["settle"].num("chance",0.3) {
                n.settleY=anchors.values.filter{$0.minX<n.x && $0.maxX>n.x && $0.minY>80}.map{$0.minY-Double.random(in:0...p["settle"].num("maxDepth",8))}.min()
                n.melt=p["settle"].num("meltMs",20000)/1000
            }
            nodes.append(n)
        }
        for decor in e["decor"].array where ["tree","garland"].contains(decor["kind"].string) {
            var spec=decor;spec=spec.setting(["type"],.string(decor["kind"].string == "tree" ? "decorTree":"decorGarland"))
            var n=SceneNode(spec:spec,pack:"",style:"plain",start:Date(),duration:life);n.seasonal=true;nodes.append(n)
        }
    }
    func pop(at point:CGPoint) {
        if nodes.contains(where:{$0.spec["type"].string == "decorTree"}) {let w=size.width*0.34,h=w*1.4;let rect=CGRect(x:size.width-w-12,y:size.height-h-16,width:w,height:h);if rect.contains(point){treeTapAt=Date();anchors["tree"]=CGRect(x:rect.midX,y:rect.minY,width:1,height:1);burst(pack:"packs/events/",style:"gold",count:14,anchor:"tree")}}
        nodes.removeAll { n in guard n.seasonal else{return false};let t=Date().timeIntervalSince(n.start);let y=min(n.settleY ?? .infinity,n.y+n.vy*t);return hypot(n.x-point.x,y-point.y)<35 } }
}
