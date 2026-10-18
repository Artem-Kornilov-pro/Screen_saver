import Foundation

struct Pose: Sendable { var x: Double; var y: Double; var rotation = 0.0; var sx = 1.0; var sy = 1.0; var opacity = 1.0; var reveal = 1.0 }
enum Trajectory {
    static func spring(_ t: Double) -> Double { 1 - exp(-6*t)*cos(10*t) }
    static func sine(_ t: Double) -> Double { -(cos(t * .pi)-1)/2 }
    static func smooth(_ t: Double) -> Double { t*t*(3-2*t) }
    static func bez(_ a: Double,_ b: Double,_ c: Double,_ d: Double,_ t: Double) -> Double { let u=1-t; return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d }
    /// Coordinates and durations follow doodles.js PATHS. Pose locates the top-left corner.
    static func pose(_ name: String, t: Double, W: Double, H: Double, w: Double, h: Double, from: (Double,Double), to: (Double,Double), side: Double = 0) -> Pose {
        let p = t * .pi
        switch name {
        case "fly":
            let k=0.3*t+0.7*t*t
            func pos(_ u: Double)->(Double,Double) { (bez(-w,W*0.18,W*0.6,W+w,u),bez(H*0.85,H*0.6,H*0.3,-h*1.2,u)) }
            let a=pos(max(0,k-0.01)),b=pos(min(1,k+0.01)),v=pos(k)
            return Pose(x:v.0-w/2,y:v.1-h/2,rotation:atan2(b.1-a.1,b.0-a.0)*180 / .pi+90+sin(p*8)*1.5)
        case "drift": let k=sine(t)*0.3+t*0.7; return Pose(x:-w+(W+2*w)*k,y:H*0.26+sin(k * .pi*3)*16,rotation:cos(k * .pi*3)*8)
        case "float": return Pose(x:W*0.38-w/2+sin(p*3)*W*0.22,y:-h+(H+2*h)*(0.85*t+0.15*sine(t)),rotation:cos(p*3)*16)
        case "ski":
            func pos(_ k: Double)->(Double,Double) { let hop=max(0,sin(k * .pi*4-0.6))*16*(1-k*0.4); return (-w+(W+w*1.3)*k,H*0.1-h+(H*0.5+h)*(0.8*k+0.2*k*k)-hop) }
            let k=0.55*t+0.45*t*t,a=pos(max(0,k-0.01)),b=pos(min(1,k+0.01)),v=pos(k)
            return Pose(x:v.0,y:v.1,rotation:max(-12,min(32,atan2(b.1-a.1,b.0-a.0)*180 / .pi*0.85)))
        case "walk": let s=sin(p*14),lift=abs(s); return Pose(x:-w+(W+2*w)*t,y:H-96-h-lift*5,rotation:s*4,sx:1+(1-lift)*0.03,sy:1-(1-lift)*0.04)
        case "sail": return Pose(x:-w+(W+2*w)*t,y:H-92-h+sin(p*4)*5,rotation:cos(p*4)*7)
        case "bounce", "hop":
            let hops = name == "bounce" ? 4.0 : 3.0, f=t*hops,i=min(hops-1,floor(f)),u=f-i
            let contact=max(0,1-min(u,1-u)/(name == "bounce" ? 0.06:0.08)),sy=1-contact*(name == "bounce" ? 0.2:0.15),sx=1+contact*(name == "bounce" ? 0.14:0.1)
            let base=name == "bounce" ? H*0.64-h : H-110-h, height=name == "bounce" ? H*0.3*pow(0.68,i):H*0.22
            return Pose(x:-w+(W+2*w)*t,y:base-4*u*(1-u)*height+h*(1-sy)/2,rotation:name == "bounce" ? t*600:(u-0.5)*10,sx:sx,sy:sy)
        case "unroll": let leave=t>0.86 ? pow((t-0.86)/0.14,2):0; return Pose(x:0,y:-12*leave,opacity:1-leave,reveal:1-pow(1-min(1,t/0.3),3))
        case "rowclear": let gone=t>0.72 ? pow((t-0.72)/0.28,2):0; let blink=t>0.4 && t<0.72 && Int((t-0.4)/0.08)%2 == 1 ? 0.35:1.0; return Pose(x:0,y:H-120-h,sx:1+gone*0.05,sy:1-gone,opacity:(1-gone)*blink,reveal:min(1,t/0.25))
        case "arc": let k=sine(t),u=1-k,cx=(from.0+to.0)/2,cy=min(from.1,to.1)-max(90,abs(to.1-from.1)*0.35); return Pose(x:u*u*from.0+2*u*k*cx+k*k*to.0-w/2,y:u*u*from.1+2*u*k*cy+k*k*to.1-h/2,rotation:k*360,sx:1-0.45*k,sy:1-0.45*k,opacity:t>0.88 ? (1-t)/0.12:1)
        case "trick": let air=t>0.35 && t<0.7 ? (t-0.35)/0.35 : -1; return Pose(x:-w+(W+2*w)*t,y:H-100-h+(air>=0 ? -sin(air * .pi)*H*0.25:sin(t*40)*1.5),rotation:air>=0 ? -sine(air)*360:0)
        case "seesaw": let o=t<0.1 ? smooth(t/0.1):t>0.88 ? smooth((1-t)/0.12):1,s=t<0.15 ? spring(t/0.15*1.2):1,ph=p*8+side * .pi; return Pose(x:W/2+(side>0 ? 0.55:-0.55)*w-w/2,y:H*0.34+sin(ph)*30,rotation:sin(ph)*10*(side>0 ? -1:1),sx:s,sy:s,opacity:o)
        case "hang": let o=t<0.1 ? smooth(t/0.1):t>0.85 ? smooth((1-t)/0.15):1,s=t<0.15 ? spring(t/0.15*1.2):1; return Pose(x:W*0.74-w/2,y:58+sin(p*4)*4,rotation:sin(p*3)*4,sx:s,sy:s,opacity:o)
        case "fade": return Pose(x:W/2-w/2,y:H*0.35,opacity:t<0.2 ? smooth(t/0.2):t>0.8 ? smooth((1-t)/0.2):1)
        default:
            let x=to.0-w/2,y=to.1-h*0.8
            if t<0.3 { let s=spring(t/0.3*1.25); return Pose(x:x,y:y+(1-s)*h*0.4,rotation:(1-s)*(-10),sx:s,sy:s) }
            if t<0.82 { let b=(t-0.3)/0.52; return Pose(x:x,y:y-sin(b * .pi*2)*3,rotation:sin(b * .pi*2)*4) }
            let e=pow((t-0.82)/0.18,2); return Pose(x:x,y:y+e*14,sx:1-e*0.25,sy:1-e*0.25,opacity:1-e)
        }
    }
}
