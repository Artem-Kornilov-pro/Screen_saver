import SwiftUI

struct QRActors:View {
    let theme:QRTheme,frame:QRFrame,style:String,phase:QRPhase,time:Double,stateAge:Double,side:Double
    struct Key {var t:Double,x:Double,y:Double,r:Double}
    private func sample(_ keys:[Key],_ t:Double)->(Double,Double,Double) {
        guard let first=keys.first,let last=keys.last else{return (0,0,0)}
        if t<=first.t{return(first.x,first.y,first.r)};if t>=last.t{return(last.x,last.y,last.r)}
        for i in 1..<keys.count where t<=keys[i].t {let a=keys[i-1],b=keys[i],u=Trajectory.sine((t-a.t)/(b.t-a.t));return(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,a.r+(b.r-a.r)*u)};return(0,0,0)
    }
    private func cycle(_ duration:Double)->Double {time.truncatingRemainder(dividingBy:duration)/duration}
    var body:some View {
        ZStack {
            if theme.id == "fishing" {Ellipse().stroke(Color(hex:"74c0fc").opacity(0.5),lineWidth:2).frame(width:side+24,height:30).overlay(Ellipse().stroke(Color(hex:"74c0fc").opacity(0.3),lineWidth:1).padding(8)).offset(y:side/2-8)}
            if theme.id == "detective" || theme.id == "chase" {
                let pose=catPose
                Sticker(source:"effects/qr/cat.svg",style:style).frame(width:94,height:107).rotationEffect(.degrees(pose.2)).offset(x:-side/2+10+pose.0,y:side/2-18+pose.1)
            }
            if !(theme.id == "detective" && frame.id == "loupe") {
                let pose=heroPose
                let dim=dimensions
                Sticker(source:theme.art,style:style).frame(width:dim.0,height:dim.1).rotationEffect(.degrees(pose.2),anchor:UnitPoint(x:0.5,y:0.8)).scaleEffect(theme.id == "detective" && phase == .catching ? 1+min(1,stateAge/0.65)*0.4:1).offset(x:side/2+dim.2+pose.0,y:side/2+dim.3+pose.1).opacity((theme.id == "fishing" && phase == .found) || (theme.id == "rocket" && phase == .found && stateAge>=1.2) ? 0:1)
            }
            if theme.id == "fishing",phase == .found {
                let u=min(1,stateAge/0.9),s=Trajectory.spring(u)
                Sticker(source:"effects/qr/fish.svg",style:style).frame(width:116,height:86).rotationEffect(.degrees(-30*(1-u))).offset(y:side/2+80-(80-17)*s-43).opacity(min(1,u*5))
            }
            if theme.id == "rocket",phase == .found,stateAge<1.2 {Circle().fill(RadialGradient(colors:[.white.opacity(0.5),.clear],center:.center,startRadius:0,endRadius:45)).frame(width:90,height:90).scaleEffect(0.2+stateAge*2).offset(x:side/2-20,y:side/2+stateAge*50).opacity(max(0,1-stateAge/1.2))}
        }.frame(width:side,height:side)
    }
    var dimensions:(Double,Double,Double,Double) {
        switch theme.id {
        case "detective":return(130,158,-32,-34)
        case "fishing":return(54,102,-42,-23)
        case "magic":return(110,135,-15,-34.5)
        case "rocket":return(63,130,-3.5,-35)
        default:return(85,66,-16.5,-11)
        }
    }
    var heroPose:(Double,Double,Double) {
        if phase == .catching {
            let u=min(1,stateAge/0.65)
            switch theme.id {
            case "detective":return(-25-45*u,-55-10*u,-10+16*u)
            case "fishing":return(0,55*u,12*u)
            case "magic":return(-35*Trajectory.sine(u),-22*sin(u * .pi),-12+60*u)
            case "chase":return(-80*u,-35*u,-15*u)
            default:return(0,0,0)
            }
        }
        if phase == .found {
            let u=min(1,stateAge)
            switch theme.id {
            case "detective":return(-70+80*Trajectory.sine(u),-65+71*Trajectory.sine(u),10*u)
            case "rocket":let t=min(1,stateAge/1.2);return(15*t,-420*t*t,8*t)
            case "chase":return(-80+55*Trajectory.sine(u),-35+47*Trajectory.sine(u),-12*u)
            default:return(0,0,0)
            }
        }
        switch theme.id {
        case "detective":return sample([Key(t:0,x:0,y:0,r:-12),Key(t:0.3,x:-70,y:-45,r:4),Key(t:0.6,x:-30,y:-100,r:-8),Key(t:0.8,x:6,y:-50,r:7),Key(t:1,x:0,y:0,r:-12)],cycle(4.8))
        case "magic":return sample([Key(t:0,x:0,y:0,r:-12),Key(t:0.5,x:0,y:-8,r:12),Key(t:1,x:0,y:0,r:-12)],cycle(3))
        case "rocket":return sample([Key(t:0,x:0,y:10,r:7),Key(t:0.5,x:0,y:-100,r:-7),Key(t:1,x:0,y:10,r:7)],cycle(3))
        case "chase":return sample([Key(t:0,x:0,y:5,r:-8),Key(t:0.35,x:-70,y:0,r:4),Key(t:0.7,x:-10,y:-30,r:10),Key(t:1,x:0,y:5,r:-8)],cycle(3.8))
        default:return sample([Key(t:0,x:0,y:0,r:-4),Key(t:0.5,x:0,y:-8,r:5),Key(t:1,x:0,y:0,r:-4)],cycle(2))
        }
    }
    var catPose:(Double,Double,Double) {
        if phase == .found {
            if theme.id == "chase" {return sample([Key(t:0,x:20,y:0,r:0),Key(t:0.5,x:90,y:-65,r:12),Key(t:1,x:100,y:-5,r:5)],min(1,stateAge))}
            return sample([Key(t:0,x:0,y:0,r:0),Key(t:0.25,x:0,y:6,r:9),Key(t:0.45,x:0,y:-3,r:-4),Key(t:0.65,x:0,y:6,r:9),Key(t:0.85,x:0,y:-3,r:-4),Key(t:1,x:0,y:0,r:0)],min(1,stateAge/1.4))
        }
        return theme.id == "chase" ? sample([Key(t:0,x:0,y:0,r:-7),Key(t:0.5,x:30,y:0,r:4),Key(t:1,x:0,y:0,r:-7)],cycle(3.8)):sample([Key(t:0,x:0,y:8,r:-4),Key(t:0.5,x:0,y:0,r:4),Key(t:1,x:0,y:8,r:-4)],cycle(4))
    }
}
