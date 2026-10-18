import SwiftUI
import AudioToolbox

struct QRTheme:Identifiable,Sendable {
    let id:String,title:String,hint:String,done:String,art:String,color:String
    static let all:[QRTheme] = [
        QRTheme(id:"detective",title:"Кот-детектив",hint:"Ищем зацепки…",done:"Дело раскрыто!",art:"effects/qr/loupe.svg",color:"d0bfff"),
        QRTheme(id:"fishing",title:"Рыбалка",hint:"Ждём хороший улов…",done:"Вот это улов!",art:"effects/qr/bobber.svg",color:"74c0fc"),
        QRTheme(id:"magic",title:"Магия",hint:"Немного волшебства…",done:"Код расколдован!",art:"effects/qr/wand.svg",color:"d0bfff"),
        QRTheme(id:"rocket",title:"Ракета",hint:"Готовимся к запуску…",done:"Код найден. Поехали!",art:"effects/doodles/packs/cosmonautics/rocket.svg",color:"ffd43b"),
        QRTheme(id:"chase",title:"Кот ловит мышку",hint:"Кто здесь прячется?",done:"Попалась!",art:"effects/qr/mouse.svg",color:"fcc2d7")]
}
struct QRFrame:Identifiable,Sendable {
    let id:String,title:String
    var art:String {id == "classic" ? "":"effects/qr/frame-\(id).svg"}
    static let all=[QRFrame(id:"classic",title:"Обычная"),QRFrame(id:"loupe",title:"Лупа"),QRFrame(id:"portal",title:"Портал"),QRFrame(id:"porthole",title:"Иллюминатор"),QRFrame(id:"cat",title:"Которамка")]
}
struct QRView:View {
    @ObservedObject var model:AppModel
    @ObservedObject var camera:CameraModel
    @State private var qr=QRState()
    @State private var style="sticker"
    @State private var help=false
    @State private var cameraMode=false
    @State private var started=Date()
    @State private var changed=Date()
    @State private var finishTask:Task<Void,Never>?
    @Environment(\.accessibilityReduceMotion) private var systemReduced
    @Environment(\.scenePhase) private var scenePhase
    init(model:AppModel) {self.model=model;self.camera=model.camera}
    var theme:QRTheme {QRTheme.all.first{$0.id == qr.theme} ?? QRTheme.all[0]}
    var frame:QRFrame {QRFrame.all.first{$0.id == qr.frame} ?? QRFrame.all[0]}
    var reduced:Bool {systemReduced || model.reduced}
    var body:some View {
        GeometryReader {g in
            let W=g.size.width,H=g.size.height,side=frame.id == "classic" ? min(W*0.62,240):min(W*0.54,208),matrix=min(W*0.54,208)
            ZStack(alignment:.top) {
                if cameraMode {CameraPreview(pipeline:camera.pipeline).ignoresSafeArea()}
                else {TerminalBackdrop().ignoresSafeArea();DemoMatrix().frame(width:matrix,height:matrix).position(x:W/2,y:H*0.46).scaleEffect(qr.phase == .catching && qr.theme == "detective" ? 1.14:1).animation(reduced ? nil:.easeInOut(duration:0.65),value:qr.phase)}
                LinearGradient(stops:[.init(color:.black.opacity(0.33),location:0),.init(color:.clear,location:0.27),.init(color:.clear,location:0.55),.init(color:Color(hex:"06100b").opacity(0.85),location:0.8),.init(color:Color(hex:"0b120e"),location:0.98)],startPoint:.top,endPoint:.bottom).ignoresSafeArea().allowsHitTesting(false)
                finder(side:side).position(x:W/2,y:H*0.46)
                VStack(spacing:10) {Text("Поймай QR-код\nв рамку").font(.system(size:27,weight:.heavy)).tracking(-0.7).multilineTextAlignment(.center);Text(theme.hint).font(.system(size:12)).foregroundColor(.white.opacity(0.74))}.position(x:W/2,y:H*0.172+36).allowsHitTesting(false)
                Text(cameraMode ? "КАМЕРА · НА УСТРОЙСТВЕ":"ДЕМО · БЕЗ КАМЕРЫ").font(.system(size:8,weight:.semibold)).tracking(1.4).padding(.horizontal,10).padding(.vertical,6).background(Color(hex:"141c17").opacity(0.7),in:Capsule()).position(x:W/2,y:H*0.28+10)
                toolbar.padding(.horizontal,24).padding(.top,max(44,g.safeAreaInsets.top)+8)
                VStack(spacing:5) {Text(feedbackTitle).font(.system(size:16,weight:.semibold)).foregroundColor(qr.phase == .found ? Color(hex:"d4ff83"):qr.phase == .error ? Color(hex:"ffe8cc"):.white);ScrollView {Text(feedbackSubtitle).font(.system(size:11)).foregroundColor(.white.opacity(0.57)).textSelection(.enabled).frame(maxWidth:.infinity)}.frame(maxHeight:48)}.padding(.horizontal,20).frame(width:W).position(x:W/2,y:H*0.662+22).accessibilityElement(children:.combine).accessibilityIdentifier("qr.feedback")
                bottom.padding(.horizontal,24).padding(.bottom,max(22,g.safeAreaInsets.bottom)).frame(maxHeight:.infinity,alignment:.bottom)
            }
        }.ignoresSafeArea().foregroundColor(.white)
        .onAppear {
            camera.onRead={value in read(value,isDemo:false)}
            let args=ProcessInfo.processInfo.arguments
            func argument(_ key:String)->String? {guard let i=args.firstIndex(of:key),args.count>i+1 else{return nil};return args[i+1]}
            if let id=argument("--qr-theme"),allowedThemes.contains(where:{$0.id == id}) {qr.selectTheme(id)}
            if let id=argument("--qr-frame"),allowedFrames.contains(where:{$0.id == id}) {qr.selectFrame(id)}
            if args.contains("--reduced") {model.reduced=true}
        }
        .onDisappear {finishTask?.cancel();camera.onRead=nil;camera.stop()}
        .onChange(of:scenePhase) {p in if p != .active {finishTask?.cancel();camera.stop();cameraMode=false;if qr.phase == .catching {qr.phase = .search}}}
        .onChange(of:camera.message) {value in if !value.isEmpty {cameraMode=false;qr.phase = .error}}
        .sheet(isPresented:$help) {settings}
    }
    private var toolbar:some View {
        HStack {
            Button {finishTask?.cancel();camera.stop();model.screen="main"} label:{Image(systemName:"xmark").font(.system(size:22,weight:.bold)).frame(width:48,height:48).background(Color(hex:"121813").opacity(0.55),in:RoundedRectangle(cornerRadius:18))}.accessibilityLabel("Закрыть сканер").accessibilityIdentifier("qr.close")
            Spacer()
            VStack(spacing:3) {Text("РАМКА").font(.system(size:8)).tracking(1.3).foregroundColor(.white.opacity(0.5));Menu {ForEach(allowedFrames) {f in Button(f.title){qr.selectFrame(f.id)}}} label:{HStack(spacing:4){Text(frame.title);Image(systemName:"chevron.down").font(.system(size:8))}.font(.system(size:12,weight:.medium))}.accessibilityIdentifier("qr.frame")}.padding(8).background(Color(hex:"121813").opacity(0.45),in:RoundedRectangle(cornerRadius:12))
            Spacer()
            Button {help=true} label:{Image(systemName:"info.circle.fill").font(.system(size:23)).frame(width:48,height:48).background(Color(hex:"121813").opacity(0.55),in:RoundedRectangle(cornerRadius:18))}.accessibilityLabel("Настройки сканера").accessibilityIdentifier("qr.settings")
        }
    }
    private var allowedThemes:[QRTheme] {let a=model.snapshot.native["qrThemes"].array;let r=QRTheme.all.filter{a.contains(.string($0.id))};return r.isEmpty ? [QRTheme.all[0]]:r}
    private var allowedFrames:[QRFrame] {let a=model.snapshot.native["qrFrames"].array;let r=QRFrame.all.filter{a.contains(.string($0.id))};return r.isEmpty ? [QRFrame.all[0]]:r}
    private var bottom:some View {
        VStack(spacing:0) {
            Menu {ForEach(allowedThemes) {t in Button(t.title) {selectTheme(t.id)}}} label:{HStack(spacing:7) {Art.image(theme.art).resizable().scaledToFit().frame(width:22,height:26);Text("\((QRTheme.all.firstIndex{$0.id == qr.theme} ?? 0)+1)/5 · "+theme.title).font(.system(size:12,weight:.medium));Image(systemName:"chevron.down").font(.system(size:8))}.padding(.horizontal,10).padding(.vertical,5).background(Color.white.opacity(0.07),in:Capsule()).overlay(Capsule().stroke(Color.white.opacity(0.13),lineWidth:1))}.accessibilityIdentifier("qr.theme")
            HStack(spacing:32) {
                if camera.hasTorch {Button {camera.toggleTorch()} label:{VStack(spacing:4){Image(systemName:"bolt.fill").font(.system(size:21));Text("Фонарик").font(.system(size:10))}}.foregroundColor(camera.torchOn ? Design.lime:.white).accessibilityLabel("Фонарик")}
                Button {finishTask?.cancel();qr.reset();Task {await camera.start();cameraMode=camera.active}} label:{VStack(spacing:4){Image(systemName:"camera").font(.system(size:21));Text("Камера").font(.system(size:10))}}.accessibilityIdentifier("qr.camera")
                if cameraMode {Button {camera.stop();cameraMode=false;qr.reset()} label:{VStack(spacing:4){Image(systemName:"play");Text("Демо").font(.system(size:10))}}}
            }.frame(minHeight:44).padding(.vertical,8).foregroundColor(Color(hex:"d4dcd7"))
            Button {
                if qr.phase == .found || qr.phase == .error {finishTask?.cancel();qr.reset();camera.stop();cameraMode=false;changed=Date()}
                else if cameraMode {camera.stop();cameraMode=false;qr.reset()}
                else {read("SBERKIDS-DEMO",isDemo:true)}
            } label:{HStack(spacing:14) {Text(qr.phase == .catching ? "Ловим код…":qr.phase == .found ? "Сканировать ещё":qr.phase == .error ? "Попробовать ещё":cameraMode ? "Вернуться к демо":"Поймать демо-код");Image(systemName:qr.phase == .found ? "arrow.clockwise":"arrow.right")}.font(.system(size:14,weight:.bold)).foregroundColor(Color(hex:"19300b")).frame(maxWidth:.infinity).frame(height:49).background(Design.lime,in:RoundedRectangle(cornerRadius:16))}.disabled(qr.phase == .catching).accessibilityIdentifier("qr.catch")
            Text("Демонстрация сканирования · без оплаты").font(.system(size:9)).foregroundColor(Color(hex:"9aa79e")).padding(.top,10)
        }
    }
    private func finder(side:Double)->some View {
        TimelineView(.animation(minimumInterval:1/60,paused:reduced || scenePhase != .active)) {time in
            let elapsed=time.date.timeIntervalSince(started),stateAge=time.date.timeIntervalSince(changed)
            ZStack {
                if frame.id == "classic" {
                    RoundedRectangle(cornerRadius:26).stroke(Color.white.opacity(0.10),lineWidth:7)
                    ForEach(0..<4) {i in Corner().stroke(qr.phase == .found ? Design.lime:qr.phase == .error ? Color(hex:"ffd8a8"):.white,style:StrokeStyle(lineWidth:4,lineCap:.round)).frame(width:25,height:25).rotationEffect(.degrees(Double(i)*90)).offset(x:i == 0 || i == 3 ? -side/2+12.5:side/2-12.5,y:i<2 ? -side/2+12.5:side/2-12.5)}
                } else {Sticker(source:frame.art,style:qr.phase == .found ? "neon":style).opacity(frame.id == "portal" && !reduced ? 0.925-0.075*cos(elapsed * .pi*2/3):1).rotationEffect(.degrees(frame.id == "loupe" && qr.phase == .found && stateAge<0.7 ? -6*sin(stateAge/0.7 * .pi*2):0)).frame(width:side*(frame.id == "cat" ? 1.6:1.44),height:side*(frame.id == "cat" ? 1.6:1.44))}
                if qr.phase == .search {Rectangle().fill(Design.lime).frame(width:side*0.8,height:2).shadow(color:Design.lime.opacity(0.5),radius:8).offset(y:reduced ? 0:side*(-0.38+0.75*(1-cos(elapsed * .pi*2/3))/2))}
                if qr.phase == .found {RoundedRectangle(cornerRadius:frame.id == "classic" ? 30:side).stroke(Design.lime,lineWidth:2).shadow(color:Design.lime.opacity(0.5),radius:16).padding(frame.id == "classic" ? -6:-side*0.162)}
                QRActors(theme:theme,frame:frame,style:style,phase:qr.phase,time:reduced ? 0:elapsed,stateAge:reduced ? 2:stateAge,side:side)
                if qr.phase == .found {Image(systemName:"checkmark").font(.system(size:30,weight:.semibold)).foregroundColor(Color(hex:"234419")).frame(width:64,height:64).background(Design.lime,in:Circle()).scaleEffect(reduced ? 1:max(0.4,Trajectory.spring(min(1,stateAge/0.5)))).accessibilityHidden(true)}
                if (qr.phase == .found && stateAge<1.2 || qr.phase == .catching && qr.theme == "magic"),!reduced {
                    ForEach(0..<16) {i in let a=Double(i)/16 * .pi*2;let p=qr.phase == .catching ? max(0,1-stateAge/0.6):min(1,stateAge/1.2);Sticker(source:"effects/doodles/packs/events/sparkle.svg",style:style).frame(width:22,height:22).offset(x:cos(a)*(95+Double(i%3)*23)*p,y:sin(a)*(95+Double(i%3)*23)*p).opacity(qr.phase == .found ? 1-p:1)}
                }
            }.frame(width:side,height:side)
        }.allowsHitTesting(false).accessibilityHidden(true)
    }
    var feedbackTitle:String {qr.phase == .found ? theme.done:qr.phase == .catching ? "Есть зацепка…":qr.phase == .error ? "Код пока не читается":cameraMode ? "Наведи камеру на QR-код":"Готовы поймать код?"}
    var feedbackSubtitle:String {if qr.phase == .found {return qr.payload == "SBERKIDS-DEMO" ? "Демо-код · без оплаты":"Содержимое: "+qr.payload};if qr.phase == .error {return camera.message.isEmpty ? "Добавь света или поднеси телефон ближе":camera.message};return qr.phase == .catching ? "QR распознан":cameraMode ? "Распознавание на устройстве":"Нажми кнопку — история оживёт"}
    func selectTheme(_ id:String) {finishTask?.cancel();qr.selectTheme(id);started=Date();changed=Date()}
    func read(_ value:String,isDemo:Bool) {guard qr.read(value) else{return};camera.stop();changed=Date();finishTask?.cancel();finishTask=Task {try? await Task.sleep(nanoseconds:reduced ? 120_000_000:650_000_000);guard !Task.isCancelled else{return};qr.phase = .found;changed=Date();UIAccessibility.post(notification:.announcement,argument:theme.done);UIImpactFeedbackGenerator(style:.light).impactOccurred();if model.sound {AudioServicesPlaySystemSound(1057)}}}
    var settings:some View {NavigationView {Form {
        Section(header:Text("Лови код, а не скуку")) {Text("Кадры остаются на устройстве. Содержимое QR показывается текстом; ссылки не открываются, платежей нет.")}
        Section(header:Text("Сюжет")) {ForEach(allowedThemes) {t in Button(t.title) {selectTheme(t.id);help=false}.accessibilityIdentifier("qr.theme."+t.id)}}
        Section(header:Text("Рамка")) {ForEach(allowedFrames) {f in Button(f.title) {qr.selectFrame(f.id);help=false}.accessibilityIdentifier("qr.frame."+f.id)}}
        Section(header:Text("Оформление")) {Picker("Стиль",selection:$style) {Text("Каракуля").tag("sketch");Text("Наклейка").tag("sticker");Text("Неон").tag("neon")};Toggle("Меньше движения",isOn:$model.reduced);Toggle("Звук",isOn:$model.sound)}
        Section {Button("Повторить") {finishTask?.cancel();qr.reset();help=false};Button("Проверить ошибку") {finishTask?.cancel();camera.stop();cameraMode=false;qr.phase = .error;help=false}.accessibilityIdentifier("qr.error")}
    }.navigationTitle("QR-демо").toolbar {ToolbarItem(placement:.confirmationAction) {Button("Готово"){help=false}}}}}
}
struct Corner:Shape {func path(in rect:CGRect)->Path {Path {p in p.move(to:CGPoint(x:0,y:rect.height));p.addLine(to:CGPoint(x:0,y:16));p.addQuadCurve(to:CGPoint(x:16,y:0),control:.zero);p.addLine(to:CGPoint(x:rect.width,y:0))}}}
struct DemoMatrix:View {
    var body:some View {Canvas {c,size in
        c.fill(Path(roundedRect:CGRect(origin:.zero,size:size),cornerRadius:14),with:.color(Color(hex:"f2f4ed")))
        let cell=(size.width-24)/25
        for y in 0..<25 {for x in 0..<25 {
            var dark=(x*13+y*7+x*y*3)%11<5
            for (cx,cy) in [(0,0),(18,0),(0,18)] {let dx=x-cx,dy=y-cy;if dx>=(-1),dx<=7,dy>=(-1),dy<=7 {dark=dx>=0 && dx<7 && dy>=0 && dy<7 && (dx == 0 || dx == 6 || dy == 0 || dy == 6 || (dx>=2 && dx<=4 && dy>=2 && dy<=4))}}
            if dark {c.fill(Path(roundedRect:CGRect(x:12+Double(x)*cell,y:12+Double(y)*cell,width:cell-1,height:cell-1),cornerRadius:1),with:.color(Color(hex:"17211b")))}}
        }
    }.accessibilityHidden(true)}
}
struct TerminalBackdrop:View {
    var body:some View {GeometryReader {g in
        ZStack {
            LinearGradient(colors:[Color(hex:"b68c62"),Color(hex:"8c6644"),Color(hex:"ba946d")],startPoint:.leading,endPoint:.trailing)
            Canvas {c,s in for i in stride(from:0,to:Int(s.height),by:19) {var p=Path();p.move(to:CGPoint(x:0,y:i));p.addLine(to:CGPoint(x:s.width,y:Double(i)+s.width*0.052));c.stroke(p,with:.color(Color(hex:"684f36").opacity(0.16)),lineWidth:2)}}
            RoundedRectangle(cornerRadius:40).fill(LinearGradient(colors:[Color(hex:"383c3c"),Color(hex:"141919"),Color(hex:"292f2e"),Color(hex:"121616")],startPoint:.topLeading,endPoint:.bottomTrailing)).shadow(color:.black.opacity(0.5),radius:20,y:18).frame(width:g.size.width*0.92,height:g.size.height*0.98).position(x:g.size.width/2,y:g.size.height*0.61)
            Text("ОПЛАТА ПО QR").font(.system(size:12)).tracking(1.7).foregroundColor(Color(hex:"a8b0ad")).position(x:g.size.width/2,y:g.size.height*0.18)
            RoundedRectangle(cornerRadius:12).fill(Color(hex:"d3d9cc")).overlay(RoundedRectangle(cornerRadius:12).stroke(Color(hex:"111816"),lineWidth:6)).frame(width:g.size.width*0.79,height:g.size.height*0.52).position(x:g.size.width/2,y:g.size.height*0.527)
            Text("Демонстрационный код").font(.system(size:11)).foregroundColor(Color(hex:"3d4841")).position(x:g.size.width/2,y:g.size.height*0.73)
            Text("1　2　3\n4　5　6\n7　8　9").font(.system(size:26,weight:.semibold)).tracking(8).lineSpacing(20).foregroundColor(Color(hex:"b8c2bb")).position(x:g.size.width/2,y:g.size.height*0.9)
        }
    }.accessibilityHidden(true)}
}
