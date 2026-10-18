import SwiftUI

struct RootView:View {
    @ObservedObject var model:AppModel
    var body:some View {
        ZStack {
            Design.bg.ignoresSafeArea()
            if model.screen == "qr" {QRView(model:model)}
            else if model.screen == "transfer" {TransferView(model:model)}
            else { HomeView(model:model,engine:model.effects) }
            if !model.toast.isEmpty {Text(model.toast).font(.system(size:13,weight:.medium)).padding(14).background(Design.surface,in:Capsule()).padding(.bottom,100).frame(maxHeight:.infinity,alignment:.bottom).allowsHitTesting(false)}
        }.foregroundColor(Design.text).buttonStyle(PressStyle())
            .sheet(isPresented:$model.demo) {DemoPanel(model:model,engine:model.effects)}
    }
}
struct HomeView:View {
    @ObservedObject var model:AppModel
    @ObservedObject var engine:EffectEngine
    private let operations:[(String,String,String,String,String)] = [
        ("envelope","Уведомление от банка","Для безопасности ваших средств никому не сообщайте код","","neutral"),
        ("М","Перевод от мамы","Карманные деньги","+500 ₽","green"),
        ("Ш","Школьная столовая","Покупка","−120 ₽","orange"),
        ("К","Книжный магазин","Покупка","−390 ₽","blue"),
        ("П","Перевод от папы","На кино","+300 ₽","green"),
        ("К","Кинотеатр","Покупка","−450 ₽","orange"),
        ("С","Спортивная секция","Оплата занятий","−1 200 ₽","blue"),
        ("Б","Перевод от бабушки","На день рождения","+1 000 ₽","green"),
        ("И","Магазин игрушек","Покупка","−690 ₽","orange"),
        ("Ц","Цветочный магазин","Подарок маме","−350 ₽","blue")]
    var body:some View {
        GeometryReader { outer in
            ZStack(alignment:.bottom) {
                RadialGradient(colors:[Color(hex:"96d228").opacity(0.4),Color(hex:"46821e").opacity(0.12),Design.bg],center:UnitPoint(x:0.15,y:-0.08),startRadius:0,endRadius:outer.size.height*0.55).ignoresSafeArea()
                ScrollView {
                    VStack(alignment:.leading,spacing:0) {
                        header.frame(height:60)
                        card.padding(.top,8).effectAnchor("snow.card")
                        tiles.padding(.top,10)
                        Text("История").font(.system(size:20,weight:.bold)).padding(.top,26).padding(.bottom,10)
                        ForEach(Array(operations.enumerated()),id:\.offset) { index,op in operation(op).padding(.bottom,8).effectAnchor(index == 1 ? "income":"snow.op.\(index)") }
                    }.padding(.horizontal,16).padding(.top,44).padding(.bottom,120)
                }.refreshable {await MainActor.run {model.pull()}}
                tabbar.padding(.horizontal,12).padding(.bottom,22)
                Button {model.demo=true} label: {Art.image("ui/gear").resizable().scaledToFit().frame(width:20,height:20).frame(width:40,height:40).background(Design.surface,in:Circle())}.accessibilityLabel("Демопанель").accessibilityIdentifier("demo.open").padding(.trailing,12).padding(.bottom,100).frame(maxWidth:.infinity,alignment:.trailing)
            }
            .overlayPreferenceValue(AnchorKey.self) { anchors in
                GeometryReader { proxy in
                    let rects=anchors.mapValues{proxy[$0]}
                    ZStack { EffectLayer(engine:engine); skins(rects:rects); trace; if engine.showHint {GestureHint(kind:engine.hintKind).position(x:proxy.size.width/2,y:proxy.size.height*0.44)} }
                        .onAppear {engine.anchors=rects;engine.size=proxy.size}
                        .onChange(of:rects) {engine.anchors=$0;engine.size=proxy.size}
                }
            }
            .simultaneousGesture(DragGesture(minimumDistance:0).onEnded {value in if abs(value.translation.height)<8,abs(value.translation.width)<8 {engine.pop(at:value.location)}})
        }
    }
    private var header:some View {
        HStack(spacing:12) {
            Button {model.showToast("Открываем профиль")} label: {
                Text("М").font(.system(size:20,weight:.heavy)).foregroundColor(.white).frame(width:44,height:44).background(LinearGradient(colors:[Color(hex:"b197fc"),Color(hex:"f06595"),Color(hex:"ff922b")],startPoint:.topLeading,endPoint:.bottomTrailing),in:Circle()).overlay(Circle().fill(RadialGradient(colors:[.white.opacity(0.6),.clear],center:.top,startRadius:0,endRadius:30)))
            }.accessibilityLabel("Профиль").effectAnchor("avatar")
            Spacer(minLength:0)
        }.overlay {if engine.selected != .null {DoodleDock(engine:engine)}}
    }
    private var card:some View {
        VStack(spacing:0) {
            HStack(alignment:.top) {
                VStack(alignment:.leading,spacing:6) {Text("СберКарта").font(.system(size:15,weight:.semibold)).foregroundColor(Color(hex:"dfe6e1"));HStack(spacing:5) {Text(model.balance.formatted(.number.locale(Locale(identifier:"ru_RU")))) ;Text("₽").foregroundColor(Design.secondary)}.font(.system(size:28,weight:.bold)).effectAnchor("balance")}
                Spacer()
                Button {model.showToast("Открываем «СберКарту»")} label: {CardThumbnail().frame(width:76,height:50).clipShape(RoundedRectangle(cornerRadius:10))}.accessibilityLabel("Карта").effectAnchor("card-thumb")
            }.padding(EdgeInsets(top:16,leading:16,bottom:18,trailing:16))
            Rectangle().fill(Color.white.opacity(0.06)).frame(height:1)
            HStack {Text("Бонусы Спасибо");Spacer();Text("55").bold();Text("С").font(.system(size:12,weight:.bold)).foregroundColor(Color(hex:"06210f")).frame(width:20,height:20).background(Design.green,in:Circle())}.font(.system(size:14)).foregroundColor(Color(hex:"dfe6e1")).padding(.horizontal,16).padding(.vertical,13)
        }.background(Design.surface,in:RoundedRectangle(cornerRadius:22))
    }
    private var tiles:some View {
        HStack(spacing:8) {
            tile("QR",icon:"ui/qr",color:"6c4cf0") {model.screen="qr"}.frame(width:64).accessibilityIdentifier("home.qr")
            tile("Скинуть\nденег",icon:"ui/arrow",color:"1e88ff") {model.screen="transfer"}.accessibilityIdentifier("home.transfer")
            tile("Пополнить\nмобилку",icon:"ui/mobile",color:"0f8a45") {model.showToast("Открываем «Пополнить мобилку»")}
        }
    }
    private func tile(_ text:String,icon:String,color:String,action:@escaping()->Void)->some View {
        Button(action:action) {VStack(alignment:.leading,spacing:0) {Text(text).font(.system(size:14,weight:.semibold)).multilineTextAlignment(.leading);Spacer(minLength:0);Art.image(icon).resizable().scaledToFit().frame(width:18,height:18).frame(width:34,height:34).background(Color(hex:color),in:Circle())}.padding(12).frame(maxWidth:.infinity,alignment:.leading).frame(height:104).background(Design.surface,in:RoundedRectangle(cornerRadius:20))}
    }
    private func operation(_ op:(String,String,String,String,String))->some View {
        let colors:[String:(String,String)] = ["green":("1f4d2f","7be29b"),"orange":("4d361f","ffbe73"),"blue":("1f3550","7cb8ff"),"neutral":("3b4250","c9d3e6")]
        let c=colors[op.4]!
        return HStack(spacing:12) {
            Group {if op.0 == "envelope" {Art.image("ui/envelope").resizable().scaledToFit().frame(width:20,height:20)}else{Text(op.0).font(.system(size:15,weight:.bold))}}.foregroundColor(Color(hex:c.1)).frame(width:40,height:40).background(Color(hex:c.0),in:Circle())
            VStack(alignment:.leading,spacing:2) {Text(op.1).font(.system(size:15,weight:.semibold));Text(op.2).font(.system(size:13)).foregroundColor(Design.secondary).lineLimit(1)}.frame(maxWidth:.infinity,alignment:.leading)
            if !op.3.isEmpty {Text(op.3).font(.system(size:15,weight:.semibold)).foregroundColor(op.3.hasPrefix("+") ? Design.green:Design.text).fixedSize()}
        }.padding(.horizontal,14).padding(.vertical,12).background(Design.surface,in:RoundedRectangle(cornerRadius:18))
    }
    private var tabbar:some View {
        HStack(spacing:0) {
            tab("Главный",icon:"home",index:0)
            tab("Копилки",icon:"savings",index:1).effectAnchor("savings")
            Button {model.showToast("Центральная кнопка")} label:{Art.image("ui/paw").resizable().scaledToFit().frame(width:28,height:28).foregroundColor(Color(hex:"f2a7bd")).frame(width:48,height:48).background(Color(hex:"f7e6ec"),in:Circle())}.accessibilityLabel("Центральная кнопка").effectAnchor("paw").frame(maxWidth:.infinity)
            tab("Дела",icon:"done",index:3)
            tab("Контент",icon:"content",index:4)
        }.frame(height:64).background(Color(hex:"1c1f1e").opacity(0.96),in:RoundedRectangle(cornerRadius:24))
    }
    private func tab(_ title:String,icon:String,index:Int)->some View {Button {model.tab=index} label:{VStack(spacing:3) {Art.image("ui/"+icon+(model.tab == index ? "_active":"")).resizable().scaledToFit().frame(width:22,height:22);Text(title).font(.system(size:10,weight:.semibold))}.foregroundColor(model.tab == index ? Design.green:Color(hex:"6f7a74")).frame(maxWidth:.infinity).frame(height:48)}.accessibilityAddTraits(model.tab == index ? .isSelected:[])}
    private func skins(rects:[String:CGRect])->some View {ForEach(Array(engine.skins.keys),id:\.self) {key in if let rect=rects[key],let source=engine.skins[key] {Sticker(source:source).frame(width:rect.width*1.5,height:rect.width*1.5).position(x:rect.midX,y:rect.minY+2).allowsHitTesting(false)}}}
    @ViewBuilder private var trace:some View {
        if engine.combo.level == 1,engine.selected["effect"]["combo"]["mode"].string == "trace" {TraceView(engine:engine)}
        if !engine.fact.isEmpty {Text(engine.fact).font(.system(size:12)).padding(12).background(Design.surface,in:RoundedRectangle(cornerRadius:16)).padding(.horizontal,24).frame(maxHeight:.infinity,alignment:.bottom).padding(.bottom,100).allowsHitTesting(false)}
    }
}
struct CardThumbnail:View {
    var body:some View {Canvas {context,size in context.fill(Path(CGRect(origin:.zero,size:size)),with:.color(Color(hex:"8ad62a")));for i in 0..<3 {var p=Path();p.move(to:CGPoint(x:-4,y:12+i*16));p.addCurve(to:CGPoint(x:34,y:12+i*16),control1:CGPoint(x:10,y:2+i*16),control2:CGPoint(x:20,y:22+i*16));p.addCurve(to:CGPoint(x:80,y:12+i*16),control1:CGPoint(x:48,y:2+i*16),control2:CGPoint(x:58,y:2+i*16));context.stroke(p,with:.color(Color(hex:i == 1 ? "c9f54a":"3fa31a")),lineWidth:6)}}}
}
struct TransferView:View {
    @ObservedObject var model:AppModel
    @State private var recipient=""
    @State private var amount=""
    var body:some View {VStack(alignment:.leading,spacing:24) {HStack {Button {model.screen="main"} label:{Image(systemName:"arrow.left").frame(width:44,height:44).background(Design.surface,in:Circle())}.accessibilityLabel("Назад");Text("Скинуть денег").font(.system(size:22,weight:.bold))}.padding(.top,44)
        VStack(alignment:.leading,spacing:18) {Text("Кому").foregroundColor(Design.secondary);TextField("Номер телефона",text:$recipient).keyboardType(.phonePad).accessibilityIdentifier("transfer.recipient");Divider();Text("Сумма").foregroundColor(Design.secondary);TextField("0 ₽",text:$amount).keyboardType(.decimalPad);Button {model.showToast("Это макет, деньги не уходят")} label:{Text("Перевести").bold().frame(maxWidth:.infinity).padding().background(Design.green,in:RoundedRectangle(cornerRadius:14)).foregroundColor(Color(hex:"06210f"))}}.padding(18).background(Design.surface,in:RoundedRectangle(cornerRadius:22))
        Text("На экранах оплаты, перевода, реквизитов и лимитов праздничный слой и дудлы не показываются.").font(.system(size:13)).foregroundColor(Design.secondary);Spacer()}.padding(.horizontal,16)}
}
struct TraceView:View {
    @ObservedObject var engine:EffectEngine
    @State private var next=0
    var body:some View {
        GeometryReader {g in
            let points=engine.selected["effect"]["combo"]["trace"]["path"].array.map{CGPoint(x:$0.array[0].number*g.size.width,y:$0.array[1].number*g.size.height)}
            ZStack {path(points).stroke(Color.white.opacity(0.5),style:StrokeStyle(lineWidth:4,lineCap:.round,dash:[5,8]));path(Array(points.prefix(next))).stroke(Design.lime,style:StrokeStyle(lineWidth:5,lineCap:.round));if next<points.count {Circle().fill(Design.lime).frame(width:20,height:20).position(points[next])}}
                .contentShape(Rectangle()).gesture(DragGesture(minimumDistance:0).onChanged {v in if next<points.count,hypot(v.location.x-points[next].x,v.location.y-points[next].y)<engine.settings.num("traceRadius",30) {next+=1;if next == points.count {engine.traceFinished()}}})
        }.frame(height:230).padding(.horizontal,32).frame(maxHeight:.infinity,alignment:.center).accessibilityLabel("Обведи узор по точкам").accessibilityAction {engine.traceFinished()}
    }
    func path(_ points:[CGPoint])->Path {Path {p in guard let first=points.first else{return};p.move(to:first);for point in points.dropFirst(){p.addLine(to:point)}}}
}
