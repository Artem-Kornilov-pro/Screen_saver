import XCTest
@MainActor final class FlowTests:XCTestCase {
    func testHomeTransferAndQRRetry()throws {
        let app=XCUIApplication();app.launch()
        app.buttons["home.transfer"].tap();XCTAssertTrue(app.textFields["transfer.recipient"].waitForExistence(timeout:3));app.buttons["Назад"].tap()
        app.buttons["home.qr"].tap();XCTAssertTrue(app.buttons["qr.catch"].waitForExistence(timeout:3));app.buttons["qr.catch"].tap()
        XCTAssertTrue(app.staticTexts["Дело раскрыто!"].waitForExistence(timeout:3))
        let shot=XCTAttachment(screenshot:app.screenshot());shot.name="QR-success";shot.lifetime = .keepAlways;add(shot)
        app.buttons["qr.catch"].tap();XCTAssertTrue(app.staticTexts["Готовы поймать код?"].exists)
        app.buttons["qr.close"].tap();XCTAssertTrue(app.buttons["home.qr"].exists)
    }
    func testThemeFrameAndError()throws {
        let app=XCUIApplication();app.launchArguments=["--qr"];app.launch()
        app.buttons["qr.settings"].tap();app.buttons["qr.theme.rocket"].tap();app.buttons["qr.catch"].tap();XCTAssertTrue(app.staticTexts["Код найден. Поехали!"].waitForExistence(timeout:3))
        app.buttons["qr.frame"].tap();app.buttons["Портал"].tap();XCTAssertTrue(app.staticTexts["Код найден. Поехали!"].exists)
        app.buttons["qr.settings"].tap();app.swipeUp();app.buttons["qr.error"].tap();XCTAssertTrue(app.staticTexts["Код пока не читается"].waitForExistence(timeout:3));app.buttons["qr.close"].tap()
    }
    func testDeniedCameraAndImmediateClose() {
        let app=XCUIApplication();app.launchArguments=["--qr","--camera-denied"];app.launch();app.buttons["qr.camera"].tap()
        XCTAssertTrue(app.staticTexts["Код пока не читается"].waitForExistence(timeout:3));app.buttons["qr.close"].tap();XCTAssertTrue(app.buttons["home.qr"].exists)
    }
    func testAll25QRCombinations() {
        let themes=["detective","fishing","magic","rocket","chase"],frames=["classic","loupe","portal","porthole","cat"]
        for theme in themes {for frame in frames {
            let app=XCUIApplication();app.launchArguments=["--qr","--qr-theme",theme,"--qr-frame",frame,"--reduced"];app.launch()
            XCTAssertTrue(app.buttons["qr.catch"].waitForExistence(timeout:3));app.buttons["qr.catch"].tap();XCTAssertTrue(app.buttons["qr.catch"].waitForExistence(timeout:2))
            let predicate=NSPredicate(format:"label CONTAINS %@","Сканировать ещё")
            expectation(for:predicate,evaluatedWith:app.buttons["qr.catch"]);waitForExpectations(timeout:3)
            let shot=XCTAttachment(screenshot:app.screenshot());shot.name="QR-"+theme+"-"+frame;shot.lifetime = .keepAlways;add(shot)
            app.buttons["qr.close"].tap();XCTAssertTrue(app.buttons["home.qr"].exists);app.terminate()
        }}
    }

    func testMovingDoodleDoesNotBlockProfile() {
        let app=XCUIApplication();app.launch();let doodle=app.buttons["doodle.capsule"]
        XCTAssertTrue(doodle.waitForExistence(timeout:3));doodle.tap();app.buttons["Профиль"].tap()
        XCTAssertTrue(app.staticTexts["Открываем профиль"].waitForExistence(timeout:2))
        app.buttons["home.transfer"].tap();XCTAssertFalse(doodle.exists)
    }

}
