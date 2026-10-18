import SwiftUI

struct EffectLayer:View {
    @ObservedObject var engine:EffectEngine
    var body:some View {
        TimelineView(.animation(minimumInterval:1.0/60,paused:!engine.active || engine.nodes.isEmpty)) { timeline in
            Canvas { context,size in
                for node in engine.nodes { draw(node,at:timeline.date,in:&context,size:size) }
            }
        }.allowsHitTesting(false).accessibilityHidden(true)
    }
    private func draw(_ n:SceneNode,at date:Date,in context:inout GraphicsContext,size:CGSize) {
        let age=date.timeIntervalSince(n.start)
        guard age>=0 else{return}
        let type=n.spec["type"].string
        if age>n.duration && n.settleY == nil {return}
        var c=context
        let t=min(1,age/max(0.01,n.duration))
        if type.hasPrefix("decor") {drawDecor(n,age:age,context:&context,size:size);return}
        if type == "night" { let a=t<0.1 ? t/0.1:t>0.82 ? (1-t)/0.18:1;c.fill(Path(CGRect(origin:.zero,size:size)),with:.color(Color(hex:"071024").opacity(a*0.8)));return }
        if type == "rays" {
            guard !engine.reduced else{return};c.opacity=sin(t * .pi)*0.5;c.translateBy(x:n.from.x,y:n.from.y);c.rotate(by:.degrees(t*60));let colors=n.spec["colors"].array
            for i in 0..<12 { var p=Path();p.move(to:.zero);p.addLine(to:CGPoint(x:0,y:-180));p.addLine(to:CGPoint(x:32,y:-177));p.closeSubpath();c.fill(p,with:.color(Color(hex:colors.isEmpty ? "b197fc":colors[i%colors.count].string)));c.rotate(by:.degrees(30)) };return
        }
        if type == "particles" {
            let travel=n.drag>0 ? (1-exp(-n.drag*age))/n.drag:age
            let acceleration=n.drag>0 ? n.gravity*(age-travel)/n.drag:0.5*n.gravity*age*age
            let x=n.x+n.vx*travel+n.sway/2.2*(sin(age*2.2+n.phase)-sin(n.phase))+(n.seasonal ? engine.wind*age*45:0)
            var y=n.y+n.vy*travel+acceleration
            if let settle=n.settleY,y>=settle { y=settle;let hit=(settle-n.y)/max(1,n.vy);c.opacity=max(0,1-max(0,age-hit)/n.melt) }
            else { c.opacity=max(0,min(1,(n.duration-age)/0.4)) }
            c.translateBy(x:x,y:y)
            if n.source == "snow",let settle=n.settleY,y>=settle {let rect=CGRect(x:-n.size*0.6,y:-3,width:n.size*1.2,height:6);c.fill(Path(ellipseIn:rect),with:.color(Color(hex:n.label)));return}
            if !n.seasonal {let k=age/n.duration;let alpha=k<0.05 ? k/0.05:k>0.62 ? 1-Trajectory.smooth((k-0.62)/0.38):1;c.opacity *= alpha;let u=min(1,k/0.14),back=1+2.70158*pow(u-1,3)+1.70158*pow(u-1,2),scale=0.35+0.65*back;c.scaleBy(x:scale,y:scale)}
            c.rotate(by:.radians(n.spin*(1-exp(-0.4*age))/0.4))
            if n.source == "snow" {
                var p=Path()
                for i in 0..<6 { let a=Double(i) * .pi/3;let ex=cos(a)*n.size/2,ey=sin(a)*n.size/2;p.move(to:.zero);p.addLine(to:CGPoint(x:ex,y:ey));for f in [0.55,0.8] {let bx=ex*f,by=ey*f;for sign in [-1.0,1.0] {p.move(to:CGPoint(x:bx,y:by));p.addLine(to:CGPoint(x:bx-cos(a+sign * .pi/3)*n.size*0.18,y:by-sin(a+sign * .pi/3)*n.size*0.18))}} }
                c.stroke(p,with:.color(Color(hex:n.label.isEmpty ? "b6daff":n.label)),style:StrokeStyle(lineWidth:1.4,lineCap:.round));return
            }
            styledDraw(n.source,rect:CGRect(x:-n.size*Art.ratio(n.source)/2,y:-n.size/2,width:n.size*Art.ratio(n.source),height:n.size),style:n.style,context:&c);return
        }
        let ratio=Art.ratio(n.source),w=n.spec["fullWidth"].bool ? size.width:n.size*ratio,h=n.spec["fullWidth"].bool ? size.width/ratio:n.size
        var pose=Trajectory.pose(engine.reduced ? "fade":n.spec.text("anim","pop"),t:t,W:size.width,H:size.height,w:w,h:h,from:(n.from.x,n.from.y),to:(n.to.x,n.to.y),side:n.spec["side"].number)
        if type == "badge" {pose=Trajectory.pose("pop",t:t,W:size.width,H:size.height,w:w,h:h,from:(n.from.x,n.from.y),to:(n.from.x,n.from.y+h*0.3))}
        c.opacity=pose.opacity;c.translateBy(x:pose.x+w/2,y:pose.y+h/2);c.rotate(by:.degrees(pose.rotation));c.scaleBy(x:pose.sx,y:pose.sy)
        c.clip(to:Path(CGRect(x:-w/2,y:-h/2,width:w*pose.reveal,height:h)))
        styledDraw(n.source,rect:CGRect(x:-w/2,y:-h/2,width:w,height:h),style:n.style,context:&c)
        if type == "badge" { c.draw(Text(n.label).font(.system(size:w*0.15,weight:.heavy)).foregroundColor(Color(hex:"64350b")),at:.zero) }
    }
    private func styledDraw(_ source:String,rect:CGRect,style:String,context:inout GraphicsContext) {
        guard Art.uiImage(source) != nil else{return}
        var c=context
        if style == "neon" || style == "gold" {c.addFilter(.shadow(color:Color(hex:style == "gold" ? "ffd43b":"b197fc"),radius:8))}
        else if style != "plain" { for offset in [CGSize(width:2,height:0),CGSize(width:-2,height:0),CGSize(width:0,height:2),CGSize(width:0,height:-2)] {c.addFilter(.shadow(color:.white,radius:0,x:offset.width,y:offset.height))} }
        for part in Art.parts(source,age:engine.reduced ? 0:Date().timeIntervalSince(Art.epoch)) {
            var layer=c;layer.opacity *= part.opacity
            layer.draw(Art.image(part.source),in:rect.offsetBy(dx:part.dx*rect.width,dy:part.dy*rect.height))
        }
    }
}
