import SwiftUI

/// Телефон для жюри: макет приложения с праздничным слоем и дудлами из папки web/.
/// Вся логика эффектов — в web/ (HTML, CSS, JS). Приложение только показывает страницу офлайн,
/// передаёт ей датчики телефона и не даёт экрану погаснуть.
@main
struct JuryPhoneApp: App {

	/// Раз во сколько секунд меняется праздник или дудл дня. Минимум 15.
	private static let rotationSeconds = 60

	var body: some Scene {
		WindowGroup {
			WebShell(startPath: "index.html?present=\(Self.rotationSeconds)")
				.ignoresSafeArea()
				.statusBarHidden(true)
				.onAppear { UIApplication.shared.isIdleTimerDisabled = true }
		}
	}
}
