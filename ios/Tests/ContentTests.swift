import XCTest
@testable import SberKids
final class ContentTests:XCTestCase {
    func json(_ text:String)throws->JSON {try JSONDecoder().decode(JSON.self,from:Data(text.utf8))}
    var cal:Calendar {var c=Calendar(identifier:.gregorian);c.timeZone=TimeZone(identifier:"Europe/Moscow")!;return c}
    func date(_ y:Int,_ m:Int,_ d:Int,_ h:Int=12,_ minute:Int=0)->Date {cal.date(from:DateComponents(year:y,month:m,day:d,hour:h,minute:minute))!}
    func testCrossYearAndMidnight()throws {
        let range=try json(#"{"type":"range","from":"12-20","to":"01-10"}"#)
        for d in [date(2026,12,20),date(2026,12,31,23,59),date(2027,1,1,0),date(2027,1,10)] {XCTAssertTrue(ContentRules.matches(range,date:d,calendar:cal))}
        XCTAssertFalse(ContentRules.matches(range,date:date(2027,1,11,0),calendar:cal))
        let nth=try json(#"{"type":"nth_weekday","month":10,"weekday":7,"n":-1}"#)
        XCTAssertTrue(ContentRules.matches(nth,date:date(2026,10,25),calendar:cal))
        XCTAssertFalse(ContentRules.matches(nth,date:date(2026,10,18),calendar:cal))
    }
    func testDeepMergeByIDAndKillSwitch()throws {
        let base=try json(#"{"schema":1,"items":[{"id":"a","effect":{"type":"combo","combo":{"taps":3}},"enabled":true}],"events":[]}"#)
        let p=try json(#"{"schema":1,"items":[{"id":"a","enabled":false,"effect":{"combo":{"taps":5}}},{"id":"future","effect":{"type":"unknown"}}]}"#)
        let m=try ContentRules.merge(base,p)
        XCTAssertEqual(m["items"].array.count,1);XCTAssertEqual(m["items"].array[0]["effect"]["type"].string,"combo");XCTAssertEqual(m["items"].array[0]["effect"]["combo"]["taps"].number,5);XCTAssertEqual(m["items"].array[0]["enabled"],.bool(false))
        XCTAssertThrowsError(try ContentRules.merge(base,json(#"{"schema":2}"#)))
    }
    func testComboIntervalsAndFinalGesture()throws {
        let effect=try json(#"{"trigger":["tap"],"combo":{"taps":3,"windowMs":2500,"finale":"flip"}}"#)
        var c=ComboState();XCTAssertTrue(c.trigger("tap",at:0,effect:effect,settings:.null));XCTAssertEqual(c.level,1)
        for t in [1.0,1.3,1.6] {_=c.trigger("tap",at:t,effect:effect,settings:.null)}
        XCTAssertEqual(c.level,2);XCTAssertFalse(c.trigger("shake",at:2,effect:effect,settings:.null));XCTAssertTrue(c.trigger("flip",at:3,effect:effect,settings:.null));XCTAssertEqual(c.level,3)
        var slow=ComboState();for t in [0.0,1,4,7] {_=slow.trigger("tap",at:t,effect:effect,settings:.null)};XCTAssertEqual(slow.level,1)
    }
    func testQRFrameDoesNotResetAndDuplicateReadLatch() {
        var qr=QRState();XCTAssertTrue(qr.read("safe text"));XCTAssertFalse(qr.read("duplicate"));qr.phase = .found
        for frame in QRFrame.all {qr.selectFrame(frame.id);XCTAssertEqual(qr.phase,.found);XCTAssertEqual(qr.payload,"safe text")}
        qr.reset();XCTAssertTrue(qr.read("again"));qr.selectTheme("rocket");XCTAssertEqual(qr.phase,.search)
        XCTAssertEqual(QRTheme.all.count*QRFrame.all.count,25)
    }
    func testWeightsAndRules()throws {
        let v=try json(#"[{"weight":75,"id":"a"},{"weight":25,"id":"b"}]"#).array
        XCTAssertEqual(ContentRules.weighted(v,random:0.74)?["id"].string,"a");XCTAssertEqual(ContentRules.weighted(v,random:0.75)?["id"].string,"b")
        for (type,value) in [("repeat",7777),("sequence",12345),("mirror",12321)] {XCTAssertTrue(ContentRules.matchRule(try json("{\"type\":\"\(type)\"}"),value:value))}
        XCTAssertTrue(ContentRules.matchRule(try json(#"{"type":"contains","value":"67"}"#),value:1067))
    }
    func testClockAndBirthdayPriority()throws {
        let m=try json(#"{"schema":1,"items":[{"id":"birthday","when":{"type":"birthday"},"effect":{"type":"combo"}},{"id":"ordinary","pool":true,"effect":{"type":"combo"}}]}"#)
        XCTAssertEqual(ContentRules.pick(m,date:date(2026,10,18),calendar:cal,birthday:"2017-10-18")?["id"].string,"birthday")
        let rule=try json(#"{"day":6,"hour":19}"#)
        XCTAssertTrue(ContentRules.clockMatches(rule,date:date(2026,10,6,19),calendar:cal));XCTAssertFalse(ContentRules.clockMatches(rule,date:date(2026,10,6,20),calendar:cal))
    }
    func testAllManifestResourcesAndRenderers()throws {
        let bundle=Bundle.main,url=try XCTUnwrap(bundle.url(forResource:"manifest",withExtension:"json")),m=try JSONDecoder().decode(JSON.self,from:Data(contentsOf:url))
        XCTAssertEqual(m["items"].array.count,25)
        XCTAssertEqual(m["items"].array.filter{$0["enabled"] != .bool(false)}.count,19)
        XCTAssertFalse(m["items"].array.contains{$0["id"].string == "april-fools"})
        func check(_ j:JSON) {if !j["type"].string.isEmpty {XCTAssertTrue(ContentRules.renderers.contains(j["type"].string))};for s in j["steps"].array {check(s)};if j["combo"]["effect"] != .null {check(j["combo"]["effect"])}}
        for item in m["items"].array+m["events"].array {check(item["effect"])}
    }
    func testConfigurationCacheAndFallback()async throws {
        let b=try json(#"{"schema":1,"enabled":true,"items":[],"events":[]}"#),url=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("content.json")
        let bundle=ContentSnapshot(manifest:b,seasonal:.object([:]),native:.object([:]),source:"bundle",revision:"1"),store=ConfigurationStore(bundle:bundle,cacheURL:url)
        let cached=await store.cached();XCTAssertEqual(cached.source,"bundle")
        let data=Data(#"{"schema":1,"revision":"test","doodles":{"enabled":false}}"#.utf8)
        let valid=try await store.local(data);XCTAssertEqual(valid.manifest["enabled"],.bool(false));XCTAssertEqual(valid.source,"local fixture")
        do {_=try await store.local(Data("bad".utf8));XCTFail()}catch{}
        try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true);try data.write(to:url)
        let cache=await store.cached();XCTAssertEqual(cache.source,"cache");XCTAssertEqual(cache.revision,"test")
    }
    @MainActor func testCriticalScreenSuppression() {
        let engine=EffectEngine();engine.setSuppressed(true);engine.event("topup",amount:500);engine.showSeason(date:Date(),force:true,id:"winter");XCTAssertFalse(engine.gesture("tap"));XCTAssertTrue(engine.nodes.isEmpty)
    }
    func testTrajectoryEndpoints() {XCTAssertEqual(Trajectory.spring(0),0);let p=Trajectory.pose("arc",t:1,W:375,H:812,w:30,h:30,from:(20,400),to:(180,150));XCTAssertEqual(p.x,165,accuracy:0.001);XCTAssertEqual(p.y,135,accuracy:0.001)}
    @MainActor func testClosingDuringPermissionCannotStartCamera()async {
        let camera=CameraModel()
        var response:CheckedContinuation<Bool,Never>?
        camera.requestPermission={await withCheckedContinuation{response=$0}}
        let request=Task {await camera.start()}
        await Task.yield();camera.stop();response?.resume(returning:true);await request.value
        XCTAssertFalse(camera.active);XCTAssertFalse(camera.hasTorch)
        camera.receive(1,"ready","torch");XCTAssertFalse(camera.hasTorch)
    }
    func testSettingsClampAndVersionGate()throws {
        let m=try ContentRules.merge(json(#"{"schema":1,"items":[],"events":[]}"#),json(#"{"schema":1,"settings":{"goldChance":9,"maxParticles":100000,"flipHoldMs":-1}}"#))
        XCTAssertEqual(m["settings"]["goldChance"].number,1);XCTAssertEqual(m["settings"]["maxParticles"].number,150);XCTAssertEqual(m["settings"]["flipHoldMs"].number,300)
        XCTAssertFalse(ContentRules.versionGte("1.0.0","1.1.0"));XCTAssertTrue(ContentRules.versionGte("1.2.0","1.1.9"))
    }

    func testMainSyncSeasonParticlesOptInAndCenter()throws {
        let url=try XCTUnwrap(Bundle.main.url(forResource:"manifest",withExtension:"json")),m=try JSONDecoder().decode(JSON.self,from:Data(contentsOf:url))
        let gems=try XCTUnwrap(m["items"].array.first{$0["id"].string == "gems"})
        let dressed=ContentRules.dressed(gems,manifest:m,date:date(2026,10,18),calendar:cal)
        XCTAssertEqual(dressed["effect"]["steps"].array.count,gems["effect"]["steps"].array.count)
        XCTAssertEqual(dressed["effect"]["buddy"]["wearFit"]["clip"].number,0.48)
        XCTAssertEqual(dressed["effect"]["combo"]["effect"]["steps"].array[1]["at"].string,"center")
        let june=try XCTUnwrap(m["items"].array.first{$0["id"].string == "june1-balloons"})
        XCTAssertEqual(june["effect"]["combo"]["finale"].string,"shake")
        let disabled=Set(m["items"].array.filter{$0["enabled"] == .bool(false)}.map{$0["id"].string})
        XCTAssertEqual(disabled,Set(["snake","pong","carpet","bmx","levelup","dice"]))
    }

}
