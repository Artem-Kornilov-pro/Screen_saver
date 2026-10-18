import SwiftUI

struct DemoPanel:View {
    @ObservedObject var model:AppModel
    @ObservedObject var engine:EffectEngine
    @Environment(\.dismiss) private var dismiss
    var body:some View {
        NavigationView {Form {
            Section(header:Text("СберKids · Приколы")) {
                Text("Нативная демонстрация · вымышленные данные").font(.footnote)
                Button("Открыть QR-сканер") {model.screen="qr";dismiss()}.accessibilityIdentifier("demo.qr")
            }
            Section(header:Text("Дата и профиль")) {
                Toggle("Подменить дату",isOn:$model.overrideDate).onChange(of:model.overrideDate){_ in model.refreshDate()}
                if model.overrideDate {DatePicker("Дата",selection:$model.date).onChange(of:model.date){_ in model.refreshDate()}}
                TextField("День рождения: ГГГГ-ММ-ДД",text:$model.birthday).onChange(of:model.birthday){_ in model.refreshDate()}
            }
            Section(header:Text("Праздничный слой")) {
                ForEach(model.snapshot.seasonal["effects"].array) {effect in
                    Button(effect["title"].string) {engine.showSeason(date:model.effectiveDate,force:true,id:effect["id"].string);dismiss()}
                }
                Slider(value:Binding(get:{engine.wind},set:{engine.wind=$0}),in:-1...1) {Text("Наклон")}
                Button("Тряхнуть") {model.shake();dismiss()}.accessibilityIdentifier("demo.shake")
            }
            Section(header:Text("Комбо и доступность")) {
                Toggle("Золотой финал всегда",isOn:$model.forceGold).onChange(of:model.forceGold){engine.forceGold=$0}
                Toggle("Меньше движения",isOn:$model.reduced).onChange(of:model.reduced){engine.reduced=$0 || UIAccessibility.isReduceMotionEnabled}
                Button("Потянуть список") {model.pull();dismiss()}
                Button("Перевернуть экраном вниз и обратно") {model.flip();dismiss()}.accessibilityIdentifier("demo.flip")
                Text("Комбо: нажми стикер, затем три быстрых тапа или обводка. Финал — тряска, переворот или pull-to-refresh по подсказке.").font(.footnote)
            }
            Section(header:Text("Активные дудлы · \(model.snapshot.manifest["items"].array.filter{$0["enabled"] != .bool(false)}.count)")) {
                ForEach(model.snapshot.manifest["items"].array.filter{$0["enabled"] != .bool(false)}) {item in
                    Button {engine.select(item);model.screen="main";dismiss()} label:{HStack {Art.image(buddy(item)).resizable().scaledToFit().frame(width:34,height:34);Text(item["title"].string);Spacer();if UserDefaults.standard.bool(forKey:"found."+item["id"].string){Image(systemName:"checkmark.circle.fill").foregroundColor(Design.green)}}}.accessibilityIdentifier("demo.doodle."+item["id"].string)
                }
            }
            Section(header:Text("События")) {
                Button("Пополнение +500 ₽") {model.topup();dismiss()}
                ForEach([7777,40000,12345,1067],id:\.self) {n in Button("Баланс \(n)") {model.setBalance(n);dismiss()}}
                Button("6-е число, 19:00") {var c=Calendar.current.dateComponents([.year,.month],from:model.effectiveDate);c.day=6;c.hour=19;engine.event("clock",date:Calendar.current.date(from:c)!,debug:true);dismiss()}
            }
            Section(header:Text("Конфигурация")) {
                Text("Источник: \(model.source) · ревизия \(model.revision)").accessibilityIdentifier("config.source")
                Text("A/B — локальные фикстуры, не подтверждение CDN-загрузки.").font(.footnote)
                Button("Конфиг A") {Task {await model.fixture("config-a")}}
                Button("Конфиг B") {Task {await model.fixture("config-b")}}
                Button("Битый JSON") {Task {await model.fixture("config-broken")}}
                Button("Несовместимая схема") {Task {await model.fixture("config-incompatible")}}
                Button("Отсутствующий ресурс") {Task {await model.fixture("config-missing")}}
                TextField("HTTPS URL конфигурации",text:$model.cdnURL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabledCompat()
                Button("Обновить с CDN") {Task {await model.updateCDN()}}
                if !model.configError.isEmpty {Text(model.configError).font(.footnote).foregroundColor(.orange)}
            }
            Section(header:Text("Диагностика")) {
                Text("Swift 6 · iOS 15+ · AVFoundation · CoreMotion\nКамера и датчики требуют iPhone.\nПараметры кадров не передаются в сеть.").font(.footnote)
                Text("Активных объектов: \(engine.nodes.count)").font(.footnote)
                Button("Сбросить локальные показы") {for key in UserDefaults.standard.dictionaryRepresentation().keys where key.hasPrefix("skin.") || key.hasPrefix("found.") || key.hasPrefix("season.") || key.hasPrefix("clock."){UserDefaults.standard.removeObject(forKey:key)};engine.clear();model.refreshDate()}
            }
        }.navigationTitle("Демопанель").toolbar {ToolbarItem(placement:.confirmationAction){Button("Готово"){dismiss()}}}}
    }
    private func buddy(_ item:JSON)->String {let e=item["effect"],pack=item["pack"].string;let image=e["buddy"].text("image",e["hint"].text("image",e["steps"].array.first(where:{!$0["image"].string.isEmpty})?["image"].string ?? ""));return "effects/doodles/"+pack+image}
}
extension View {func autocorrectionDisabledCompat()->some View {disableAutocorrection(true)}}
