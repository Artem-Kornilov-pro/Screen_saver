import SwiftUI
import CoreMotion

@MainActor final class AppModel:ObservableObject {
    @Published var screen="main" { didSet { effects.setSuppressed(screen != "main" || snapshot.native["enabled"] == .bool(false));if screen != "qr" { camera.stop() };if screen == "main" {startMotion()}else{motion.stopDeviceMotionUpdates()} } }
    @Published var demo=false
    @Published var toast=""
    @Published var balance=35688
    @Published var tab=0
    @Published var overrideDate=false
    @Published var date=Date()
    @Published var forceGold=false
    @Published var reduced=false
    @Published var sound=false
    @Published var birthday=""
    @Published var source="bundle"
    @Published var revision="1"
    @Published var configError=""
    @Published var cdnURL=""
    let effects=EffectEngine(),camera=CameraModel()
    let config:ConfigurationStore
    var snapshot:ContentSnapshot
    private let motion=CMMotionManager()
    private var maintenance:Task<Void,Never>?,toastTask:Task<Void,Never>?
    private var pending:ContentSnapshot?
    private var flipSince:Date?,flipArmed=false,lastShake=Date.distantPast
    var effectiveDate:Date { overrideDate ? date:Date() }
    init() {
        func load(_ name:String)->JSON { guard let u=Bundle.main.url(forResource:name,withExtension:"json"),let d=try? Data(contentsOf:u),let j=try? JSONDecoder().decode(JSON.self,from:d) else{return .null};return j }
        let native:JSON = .object(["enabled":.bool(true),"qrThemes":.array(QRTheme.all.map{.string($0.id)}),"qrFrames":.array(QRFrame.all.map{.string($0.id)}),"assetMap":load("asset-map")])
        snapshot=ContentSnapshot(manifest:load("manifest"),seasonal:load("seasonal"),native:native,source:"bundle",revision:"1")
        let cache=FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("SberKids/content.json")
        config=ConfigurationStore(bundle:snapshot,cacheURL:cache)
        effects.manifest=snapshot.manifest;effects.seasonal=snapshot.seasonal;effects.choose(date:Date())
        if ProcessInfo.processInfo.arguments.contains("--camera-denied") {camera.requestPermission={false}}
        if ProcessInfo.processInfo.arguments.contains("--qr") {screen="qr";effects.suppressed=true}
        if let index=ProcessInfo.processInfo.arguments.firstIndex(of:"--doodle"),ProcessInfo.processInfo.arguments.count>index+1 {
            let id=ProcessInfo.processInfo.arguments[index+1];if let item=snapshot.manifest["items"].array.first(where:{$0["id"].string == id}){effects.select(item)}
        }
        if ProcessInfo.processInfo.arguments.contains("--demo-panel") {demo=true}
    }
    func apply(_ next:ContentSnapshot) {
        guard effects.combo.level == 0,screen != "qr",screen != "transfer" else {pending=next;configError="Набор проверен; вернись на главный экран и заверши комбо для применения.";return}
        pending=nil;Art.mapping=next.native["assetMap"].object.mapValues(\.string);snapshot=next;source=next.source;revision=next.revision;configError=""
        effects.manifest=next.manifest;effects.seasonal=next.seasonal
        effects.setSuppressed(next.native["enabled"] == .bool(false));refreshDate()
    }
    func start() async { apply(await config.cached());resume() }
    func refreshDate() { effects.reduced=reduced || UIAccessibility.isReduceMotionEnabled;effects.forceGold=forceGold;effects.choose(date:effectiveDate,birthday:birthday);effects.showSeason(date:effectiveDate);effects.event("clock",date:effectiveDate) }
    func resume() {
        effects.active=true
        maintenance?.cancel()
        maintenance=Task { [weak self] in
            var lastDay="";var lastMinute = -1
            while !Task.isCancelled {
                guard let self else{return};self.effects.prune()
                if let pending=self.pending,self.screen == "main",self.effects.combo.level == 0 {self.apply(pending)}
                let day=Calendar.current.startOfDay(for:self.effectiveDate).description
                if day != lastDay {lastDay=day;self.refreshDate()}
                let minute=Calendar.current.component(.minute,from:self.effectiveDate)
                if minute != lastMinute {lastMinute=minute;self.effects.event("clock",date:self.effectiveDate)}
                try? await Task.sleep(nanoseconds:500_000_000)
            }
        }
        if screen == "main" {startMotion()}
    }
    func suspend() {maintenance?.cancel();motion.stopDeviceMotionUpdates();effects.suspend();camera.stop()}
    private func startMotion() {
        guard motion.isDeviceMotionAvailable else{return}
        motion.deviceMotionUpdateInterval=0.05
        motion.startDeviceMotionUpdates(to:.main) { [weak self] data,_ in
            guard let data else{return}
            let x=data.gravity.x,z=data.gravity.z,acc=data.userAcceleration
            let force=sqrt(acc.x*acc.x+acc.y*acc.y+acc.z*acc.z)*9.81
            Task { @MainActor [weak self] in self?.motionSample(x:x,z:z,force:force) }
        }
    }
    private func motionSample(x:Double,z:Double,force:Double) {
        guard screen == "main",effects.active else{return}
        effects.wind=max(-1,min(1,x))
        let settings=effects.settings,now=Date()
        if force>snapshot.seasonal["settings"].num("shakeForce",15),now.timeIntervalSince(lastShake)>snapshot.seasonal["settings"].num("shakeCooldownMs",1500)/1000 {lastShake=now;shake()}
        let angle=acos(max(-1,min(1,-z)))*180 / .pi
        if angle>settings.num("flipDownAngle",150) {if flipSince == nil {flipSince=now};if now.timeIntervalSince(flipSince!)>settings.num("flipHoldMs",1200)/1000 {flipArmed=true}}
        else {flipSince=nil;if flipArmed,angle<settings.num("flipUpAngle",60) {flipArmed=false;flip()}}
    }
    func shake() {if !effects.gesture("shake") {effects.showSeason(date:effectiveDate,force:true)}}
    func flip() {if !effects.gesture("flip") {effects.event("flip")}}
    func pull() { _=effects.gesture("pull") }
    func setBalance(_ value:Int) {balance=value;effects.event("balance",value:value)}
    func topup() {balance+=500;effects.event("topup",amount:500);effects.event("balance",value:balance)}
    func showToast(_ text:String) {toast=text;toastTask?.cancel();toastTask=Task { [weak self] in try? await Task.sleep(nanoseconds:1_400_000_000);guard !Task.isCancelled else{return};self?.toast=""}}
    func fixture(_ name:String) async {guard let url=Bundle.main.url(forResource:name,withExtension:"json"),let d=try? Data(contentsOf:url) else{return};do{apply(try await config.local(d))}catch{configError="Некорректный набор отклонён. Сохранён "+source+" / "+revision}}
    func updateCDN() async {guard let url=URL(string:cdnURL) else{configError="Укажи HTTPS-адрес JSON";return};do{apply(try await config.update(from:url))}catch{configError="Загрузка не удалась: используется "+source+" / "+revision}}
}
@main struct SberKidsApp:App {
    @StateObject private var model=AppModel()
    @Environment(\.scenePhase) private var phase
    var body:some Scene {WindowGroup {RootView(model:model).preferredColorScheme(.dark).tint(Design.green).task {await model.start()}.onChange(of:phase) {p in if p == .active {model.resume()}else{model.suspend()}}}}
}
