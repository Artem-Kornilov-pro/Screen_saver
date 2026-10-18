import SwiftUI
@preconcurrency import AVFoundation

/// One audited Sendable bridge. Session, device, wantsRunning and scan latch belong exclusively
/// to `queue`. The main thread only attaches the immutable session to AVCaptureVideoPreviewLayer.
/// All callbacks are Sendable and hop to MainActor in CameraModel. No frames leave AVFoundation.
final class CapturePipeline: NSObject, AVCaptureMetadataOutputObjectsDelegate, @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label:"kids.camera.session",qos:.userInitiated)
    private var device: AVCaptureDevice?
    private let output = AVCaptureMetadataOutput()
    private var configured = false, wantsRunning = false, latched = false
    private var observers: [NSObjectProtocol] = []
    private var token=0
    let event: @Sendable (Int,String,String) -> Void
    init(event: @escaping @Sendable (Int,String,String)->Void) {
        self.event=event; super.init()
        for name in [AVCaptureSession.runtimeErrorNotification, AVCaptureSession.wasInterruptedNotification, AVCaptureSession.interruptionEndedNotification] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:session,queue:nil) { [weak self] n in
                let ended = n.name == AVCaptureSession.interruptionEndedNotification
                self?.handleInterruption(ended:ended)
            })
        }
    }
    deinit { observers.forEach { NotificationCenter.default.removeObserver($0) } }
    func handleInterruption(ended: Bool) { queue.async { [self] in
        if ended && wantsRunning { session.startRunning(); event(token,"ready",device?.hasTorch == true ? "torch":"") }
        else { event(token,"interruption","Камера временно недоступна. Нажми «Камера» для повтора.") }
    } }
    func start(token:Int) { queue.async { [self] in
        self.token=token;wantsRunning=true; latched=false
        if !configured {
            guard let camera=AVCaptureDevice.default(.builtInWideAngleCamera,for:.video,position:.back),let input=try? AVCaptureDeviceInput(device:camera) else { event(token,"error","На этом устройстве камера недоступна"); return }
            session.beginConfiguration(); session.sessionPreset = .high
            guard session.canAddInput(input),session.canAddOutput(output) else { session.commitConfiguration(); event(token,"error","Не удалось подключить камеру"); return }
            session.addInput(input); session.addOutput(output)
            guard output.availableMetadataObjectTypes.contains(.qr) else { session.commitConfiguration(); event(token,"error","QR-распознавание недоступно"); return }
            output.metadataObjectTypes=[.qr]; output.setMetadataObjectsDelegate(self,queue:queue)
            session.commitConfiguration(); device=camera; configured=true
        }
        if !session.isRunning { session.startRunning() }
        event(token,"ready",device?.hasTorch == true ? "torch":"")
    } }
    func stop() { queue.async { [self] in wantsRunning=false; latched=true; if let device,device.hasTorch { try? device.lockForConfiguration(); device.torchMode = .off; device.unlockForConfiguration() }; if session.isRunning { session.stopRunning() } } }
    func setROI(_ roi: CGRect) { queue.async { [self] in output.rectOfInterest=roi } }
    func torch(_ on: Bool) { queue.async { [self] in guard wantsRunning,let device,device.hasTorch,device.isTorchAvailable else { return }; do { try device.lockForConfiguration(); defer { device.unlockForConfiguration() }; if on { try device.setTorchModeOn(level:0.6) } else { device.torchMode = .off } } catch { event(token,"error","Не удалось включить фонарик") } } }
    func metadataOutput(_ output: AVCaptureMetadataOutput,didOutput metadataObjects:[AVMetadataObject],from connection:AVCaptureConnection) {
        guard wantsRunning,!latched,let value=metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first else { return }
        latched=true; wantsRunning=false; session.stopRunning(); event(token,"read",value)
    }
}
@MainActor final class CameraModel: ObservableObject {
    @Published var message = ""
    @Published var active=false
    @Published var hasTorch=false
    @Published var torchOn=false
    private var generation=0, screenVisible=false
    var onRead: ((String)->Void)?
    lazy var pipeline=CapturePipeline { [weak self] token,kind,value in Task { @MainActor [weak self] in self?.receive(token,kind,value) } }
    func receive(_ token:Int,_ kind:String,_ value:String) {
        guard screenVisible,token == generation else { return }
        if kind == "read" { active=false; hasTorch=false; torchOn=false; onRead?(value) }
        else if kind == "ready" { hasTorch=value == "torch"; message="" }
        else { message=value; active=false; hasTorch=false; torchOn=false; pipeline.stop() }
    }
    var requestPermission: () async -> Bool = {
        switch AVCaptureDevice.authorizationStatus(for:.video) {
        case .authorized:return true
        case .notDetermined:return await AVCaptureDevice.requestAccess(for:.video)
        default:return false
        }
    }
    func start() async {
        generation+=1; let token=generation; screenVisible=true; message=""
        let authorized=await requestPermission()
        guard screenVisible,token == generation,!Task.isCancelled else { return }
        guard authorized else { message="Доступ к камере запрещён. Разреши его в настройках iPhone или используй демо."; return }
        active=true; pipeline.start(token:token)
    }
    func stop() { generation+=1; screenVisible=false; active=false; hasTorch=false; torchOn=false; pipeline.stop() }
    func toggleTorch() { guard hasTorch else { return }; torchOn.toggle(); pipeline.torch(torchOn) }
}
final class PreviewSurface: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var preview:AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    var pipeline:CapturePipeline?
    override func layoutSubviews() {
        super.layoutSubviews()
        if let connection=preview.connection,connection.isVideoOrientationSupported { connection.videoOrientation = .portrait }
        let side=min(bounds.width*0.62,240),rect=CGRect(x:(bounds.width-side)/2,y:bounds.height*0.46-side/2,width:side,height:side)
        pipeline?.setROI(preview.metadataOutputRectConverted(fromLayerRect:rect))
    }
}
struct CameraPreview:UIViewRepresentable {
    let pipeline:CapturePipeline
    func makeUIView(context:Context)->PreviewSurface { let v=PreviewSurface();v.pipeline=pipeline;v.preview.session=pipeline.session;v.preview.videoGravity = .resizeAspectFill;return v }
    func updateUIView(_ v:PreviewSurface,context:Context) { v.setNeedsLayout() }
    static func dismantleUIView(_ v:PreviewSurface,coordinator:()) { v.preview.session=nil;v.pipeline?.stop() }
}
