import SwiftUI
extension EffectLayer {
    func drawDecor(_ n:SceneNode,age:Double,context:inout GraphicsContext,size:CGSize) {
        let t=engine.reduced ? 2:age
        let fade=min(1,age/0.6)*min(1,max(0,(n.duration-age)/1.5))
        var c=context;c.opacity=fade
        if n.spec["type"].string == "decorTree" {
            let w=size.width*max(0.15,min(0.5,n.spec.num("widthPct",0.34))),h=w*1.4
            let rise=pow(1-min(1,t/0.8),3),x=n.spec["anchor"].string == "bottom_start" ? 12:size.width-w-12,y=size.height-h-16+rise*h*0.4
            let since=Date().timeIntervalSince(engine.treeTapAt),wiggle=since<1.5 && !engine.reduced ? 0.07*sin(since*18)*exp(-since*3):0
            c.translateBy(x:x+w/2,y:y+h);c.rotate(by:.radians(wiggle));c.translateBy(x:-w/2,y:-h)
            c.fill(Path(CGRect(x:w*0.42,y:h*0.86,width:w*0.16,height:h*0.13)),with:.color(Color(hex:"7a4b2a")))
            let tiers:[(Double,Double,Double,String)] = [(0.42,0.88,0.5,"25894d"),(0.25,0.64,0.39,"2e9e5b"),(0.08,0.41,0.28,"3bb26b")]
            for (apex,base,half,color) in tiers {var p=Path();p.move(to:CGPoint(x:w/2,y:h*apex));p.addLine(to:CGPoint(x:w/2+w*half,y:h*base));p.addQuadCurve(to:CGPoint(x:w/2-w*half,y:h*base),control:CGPoint(x:w/2,y:h*(base+0.05)));p.closeSubpath();c.fill(p,with:.color(Color(hex:color)));c.stroke(p,with:.color(Color(hex:"1d6b3e")),lineWidth:2)}
            let ornaments:[(Double,Double)] = [(0.5,0.3),(0.38,0.5),(0.63,0.53),(0.29,0.75),(0.52,0.71),(0.73,0.79),(0.44,0.85)]
            let colors=["e8453c","ffc83d","3d8bff","ff7eb6","3ccb7f"]
            for (i,o) in ornaments.enumerated() {let glow=0.55+0.45*sin(t*3+Double(i)*1.3),r=w*0.045;let point=CGPoint(x:w*o.0,y:h*o.1);c.fill(Path(ellipseIn:CGRect(x:point.x-2*r,y:point.y-2*r,width:4*r,height:4*r)),with:.color(Color(hex:colors[i%colors.count]).opacity(0.35*glow)));c.fill(Path(ellipseIn:CGRect(x:point.x-r,y:point.y-r,width:2*r,height:2*r)),with:.color(Color(hex:colors[i%colors.count])))}
            let flash=since<0.8 ? 1-since/0.8:0,r=w*0.09*(1+flash*0.4),cx=w/2,cy=h*0.07
            c.fill(Path(ellipseIn:CGRect(x:cx-r*1.8,y:cy-r*1.8,width:r*3.6,height:r*3.6)),with:.color(Color(hex:"ffe38a").opacity(0.3+flash*0.5)))
            var p=Path();for i in 0..<10 {let rr=i%2 == 1 ? r*0.45:r,a = -Double.pi/2+Double(i) * .pi/5;let point=CGPoint(x:cx+cos(a)*rr,y:cy+sin(a)*rr);if i==0 {p.move(to:point)}else{p.addLine(to:point)}};p.closeSubpath();c.fill(p,with:.color(Color(hex:"ffc83d")));c.stroke(p,with:.color(Color(hex:"e0a100")),lineWidth:1.5)
        } else {
            let sag=22.0,drop=pow(1-min(1,t/0.8),3)*40,y=2-drop,segW=size.width/3,colors=["e8453c","ffc83d","3ccb7f","3d8bff"]
            for s in 0..<3 {let x0=Double(s)*segW,x1=x0+segW,cx=x0+segW/2,cy=y+sag*2;var p=Path();p.move(to:CGPoint(x:x0,y:y));p.addQuadCurve(to:CGPoint(x:x1,y:y),control:CGPoint(x:cx,y:cy));c.stroke(p,with:.color(Color(hex:"24543a")),lineWidth:1.5)
                for k in 0..<5 {let u=0.1+Double(k)*0.2,bx=(1-u)*(1-u)*x0+2*(1-u)*u*cx+u*u*x1,by=(1-u)*(1-u)*y+2*(1-u)*u*cy+u*u*y+7,i=s*5+k,lit=sin(t*4+Double(i%2) * .pi)>0,color=Color(hex:colors[i%4]);if lit {c.fill(Path(ellipseIn:CGRect(x:bx-11,y:by-11,width:22,height:22)),with:.color(color.opacity(0.35)))};c.fill(Path(ellipseIn:CGRect(x:bx-4.5,y:by-6,width:9,height:12)),with:.color(color.opacity(lit ? 1:0.55)));c.fill(Path(CGRect(x:bx-2.5,y:by-9,width:5,height:4)),with:.color(Color(hex:"24543a")))}
            }
        }
    }
}
