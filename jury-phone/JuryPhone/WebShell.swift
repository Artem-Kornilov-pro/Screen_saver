import CoreMotion
import SwiftUI
import UIKit
import WebKit

/// Полноэкранный WKWebView со страницей из папки web/, вшитой в приложение.
/// Страница отдаётся по схеме kids://app/, поэтому fetch() конфигов и картинок работает без сети.
struct WebShell: UIViewRepresentable {

	let startPath: String

	func makeCoordinator() -> Coordinator {
		Coordinator()
	}

	func makeUIView(context: Context) -> WKWebView {
		let configuration = WKWebViewConfiguration()
		if let root = Bundle.main.url(forResource: "web", withExtension: nil) {
			configuration.setURLSchemeHandler(BundleSchemeHandler(root: root), forURLScheme: BundleSchemeHandler.scheme)
		}
		configuration.allowsInlineMediaPlayback = true
		configuration.mediaTypesRequiringUserActionForPlayback = .all

		let controller = configuration.userContentController
		controller.addUserScript(WKUserScript(source: Bridge.script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
		controller.add(WeakMessageHandler(context.coordinator), name: Bridge.hapticHandler)

		let webView = ShakeWebView(frame: .zero, configuration: configuration)
		webView.uiDelegate = context.coordinator
		webView.isOpaque = false
		webView.backgroundColor = .black
		webView.scrollView.backgroundColor = .black
		webView.scrollView.contentInsetAdjustmentBehavior = .never
		webView.scrollView.bounces = false
		webView.scrollView.isScrollEnabled = false // скроллятся экраны внутри страницы, не сама страница
		webView.allowsLinkPreview = false

		if let url = URL(string: "\(BundleSchemeHandler.scheme)://app/\(startPath)") {
			webView.load(URLRequest(url: url))
		}
		context.coordinator.attach(to: webView)
		return webView
	}

	func updateUIView(_ webView: WKWebView, context: Context) {}

	static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
		coordinator.detach()
	}

	// MARK: - Coordinator

	final class Coordinator: NSObject, WKUIDelegate, WKScriptMessageHandler {

		private let motion = CMMotionManager()
		private let haptics = UIImpactFeedbackGenerator(style: .light)
		private weak var webView: WKWebView?

		/// Датчики идут в страницу как обычные события deviceorientation и devicemotion,
		/// поэтому JS-код тряски, ветра и переворота тот же, что и в браузере.
		func attach(to webView: WKWebView) {
			self.webView = webView
			guard motion.isDeviceMotionAvailable else { return }
			motion.deviceMotionUpdateInterval = 1.0 / 50
			motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
				guard let self, let data, let webView = self.webView else { return }
				webView.evaluateJavaScript(Bridge.motionCall(data), completionHandler: nil)
			}
		}

		func detach() {
			motion.stopDeviceMotionUpdates()
		}

		// Настоящие события датчиков WebKit не нужны: их заменяет мост выше. Отказ убирает и системный запрос.
		@available(iOS 15.0, *)
		func webView(
			_ webView: WKWebView,
			requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
			initiatedByFrame frame: WKFrameInfo,
			decisionHandler: @escaping (WKPermissionDecision) -> Void
		) {
			decisionHandler(.deny)
		}

		// VIBRATION_EVENT из контракта ТЗ превращается в лёгкий тактильный отклик.
		func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
			guard message.name == Bridge.hapticHandler else { return }
			haptics.impactOccurred()
		}
	}
}

// MARK: - Мост страница ↔ приложение

private enum Bridge {

	static let hapticHandler = "haptic"

	/// Создаёт window.__nativeMotion и пересылает VIBRATION_EVENT приложению.
	static let script = """
	(function () {
	  function fire(type, props) {
	    var event = new Event(type);
	    Object.keys(props).forEach(function (key) {
	      Object.defineProperty(event, key, { value: props[key] });
	    });
	    window.dispatchEvent(event);
	  }
	  window.__nativeMotion = function (beta, gamma, ax, ay, az, gx, gy, gz) {
	    fire('deviceorientation', { alpha: 0, beta: beta, gamma: gamma, absolute: false });
	    fire('devicemotion', {
	      acceleration: { x: ax, y: ay, z: az },
	      accelerationIncludingGravity: { x: ax + gx, y: ay + gy, z: az + gz },
	      rotationRate: null,
	      interval: 20
	    });
	  };
	  // Системный жест «встряхнуть»: запасной путь к тряске, если порог датчика не поймал рывок.
	  window.__nativeShake = function () {
	    fire('devicemotion', {
	      acceleration: { x: 30, y: 0, z: 0 },
	      accelerationIncludingGravity: { x: 30, y: -9.81, z: 0 },
	      rotationRate: null,
	      interval: 20
	    });
	  };
	  window.addEventListener('message', function (event) {
	    var data = event.data;
	    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (err) { return; } }
	    var type = data && (data.type || (data.data && data.data.type));
	    if (type === 'VIBRATION_EVENT') window.webkit.messageHandlers.haptic.postMessage(1);
	  });
	})();
	"""

	/// Углы как у браузера: beta — наклон вперёд-назад (±180, экраном вниз ≈ 180),
	/// gamma — наклон влево-вправо (правый край вниз — плюс). Ускорения в м/с².
	static func motionCall(_ data: CMDeviceMotion) -> String {
		let g = data.gravity
		let a = data.userAcceleration
		let earth = 9.81
		let beta = atan2(-g.y, -g.z) * 180 / .pi
		let gamma = asin(max(-1, min(1, g.x))) * 180 / .pi
		let values = [
			beta, gamma,
			a.x * earth, a.y * earth, a.z * earth,
			g.x * earth, g.y * earth, g.z * earth
		]
		return "window.__nativeMotion && window.__nativeMotion("
			+ values.map { String(format: "%.3f", $0) }.joined(separator: ",") + ")"
	}
}

/// Ловит системный жест «встряхнуть». Событие поднимается сюда по цепочке ответчиков от содержимого страницы.
private final class ShakeWebView: WKWebView {

	override var canBecomeFirstResponder: Bool { true }

	override func didMoveToWindow() {
		super.didMoveToWindow()
		if window != nil { becomeFirstResponder() }
	}

	override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
		guard motion == .motionShake else {
			super.motionEnded(motion, with: event)
			return
		}
		evaluateJavaScript("window.__nativeShake && window.__nativeShake()", completionHandler: nil)
	}
}

/// WKUserContentController держит обработчик сильной ссылкой — без прослойки координатор не освободится.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {

	private weak var target: WKScriptMessageHandler?

	init(_ target: WKScriptMessageHandler) {
		self.target = target
	}

	func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
		target?.userContentController(controller, didReceive: message)
	}
}
