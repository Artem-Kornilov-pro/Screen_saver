import Foundation
import WebKit

/// Отдаёт файлы папки web/ из приложения по адресам kids://app/<путь>.
/// Как обычный сервер: 200 с правильным типом или 404, поэтому код страницы не знает, что сети нет.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {

	static let scheme = "kids"

	private let root: URL

	init(root: URL) {
		self.root = root.standardizedFileURL
	}

	func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
		guard let url = task.request.url else {
			task.didFailWithError(URLError(.badURL))
			return
		}
		let path = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
		let file = root.appendingPathComponent(path).standardizedFileURL

		// Наружу из папки web/ не выпускаем
		guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
			respond(task, url: url, status: 404, type: "text/plain", data: Data())
			return
		}
		respond(task, url: url, status: 200, type: Self.mimeType(file.pathExtension), data: data)
	}

	func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

	private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, type: String, data: Data) {
		let headers = [
			"Content-Type": type,
			"Content-Length": String(data.count),
			"Cache-Control": "no-store"
		]
		guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
			task.didFailWithError(URLError(.cannotParseResponse))
			return
		}
		task.didReceive(response)
		task.didReceive(data)
		task.didFinish()
	}

	private static func mimeType(_ ext: String) -> String {
		switch ext.lowercased() {
		case "html": return "text/html; charset=utf-8"
		case "css": return "text/css; charset=utf-8"
		case "js": return "text/javascript; charset=utf-8"
		case "json": return "application/json; charset=utf-8"
		case "svg": return "image/svg+xml"
		case "png": return "image/png"
		case "jpg", "jpeg": return "image/jpeg"
		case "webp": return "image/webp"
		default: return "application/octet-stream"
		}
	}
}
