package ru.sberkids.doodles

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Главный экран (нативный, MainScreen) и поверх — прозрачный WebView со слоем эффектов.
 *
 * Касания разводим сами, потому что WebView лежит сверху и иначе съел бы всё:
 *  - в шапке, где ходит стикер дня, и на шестерёнке отладки касание целиком у WebView;
 *  - открыта отладка слоя — тоже целиком у WebView;
 *  - везде остальное касание получают оба: экран (кнопки, прокрутка, протяжка вниз),
 *    а слой — копию, чтобы лопать снежинки. Кнопка приложения или прокрутка гасит эффект.
 *
 * Якоря: после каждой раскладки и при прокрутке отдаём слою прямоугольники элементов экрана,
 * по ним он ставит невидимые якоря — шапка на аватаре и снег на плитках едут вместе со списком.
 */
@SuppressLint("ViewConstructor", "SetJavaScriptEnabled")
class Stage(context: Context, private val cdnUrl: String, private val demoDate: String?) : FrameLayout(context) {

    private val density = resources.displayMetrics.density
    private val main = MainScreen(context, ::onAction)
    private val web = WebView(context)
    private val spinner = ProgressBar(context)
    private val toast = TextView(context)
    private val transfer = buildTransfer()

    private var loaded = false
    private var pageReady = false
    private var modal = false
    private var webOnly = false
    private var downX = 0f
    private var downY = 0f
    private var pulled = false
    private var skipScrollY = 0

    private fun dp(v: Number) = (v.toFloat() * density).toInt()

    init {
        addView(main, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        web.setBackgroundColor(Color.TRANSPARENT)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.settings.mediaPlaybackRequiresUserGesture = true
        // Слой свёрстан в px экрана: системный крупный шрифт его не масштабирует
        web.settings.textZoom = 100
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.webViewClient = AssetClient(context.assets)
        web.addJavascriptInterface(Bridge(), "NativeBridge")
        addView(web, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        spinner.visibility = View.GONE
        spinner.indeterminateTintList = ColorStateList.valueOf(MainScreen.GREEN)
        spinner.background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.rgb(0x24, 0x28, 0x26)) }
        spinner.setPadding(dp(6), dp(6), dp(6), dp(6))
        addView(spinner, LayoutParams(dp(32), dp(32), Gravity.CENTER_HORIZONTAL))

        transfer.visibility = View.GONE
        addView(transfer, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        // Тост как в вебе: светлая плашка над таб-баром, поверх всего
        toast.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 14f)
        toast.typeface = Typeface.DEFAULT_BOLD
        toast.setTextColor(Color.rgb(0x11, 0x11, 0x11))
        toast.background = GradientDrawable().apply { setColor(Color.argb(245, 240, 244, 242)); cornerRadius = 14 * density }
        toast.setPadding(dp(16), dp(10), dp(16), dp(10))
        toast.maxLines = 1
        toast.alpha = 0f
        addView(toast, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM))

        main.viewTreeObserver.addOnGlobalLayoutListener { sendZones() }
        main.scroll.setOnScrollChangeListener { _, _, y, _, _ ->
            sendZones()
            // Начали листать — игра уступает делу
            if (abs(y - skipScrollY) > 24 * density) {
                skipScrollY = y
                js("Overlay.skip()")
            }
        }
    }

    /** Системные панели: экран и слой эффектов между ними. */
    fun setInsets(top: Int, bottom: Int) {
        main.setInsets(top, bottom)
        (toast.layoutParams as LayoutParams).bottomMargin = bottom + dp(100)
        (web.layoutParams as LayoutParams).apply { topMargin = top; bottomMargin = bottom }
        (spinner.layoutParams as LayoutParams).topMargin = top + (12 * density).toInt()
        transfer.setPadding(transfer.paddingLeft, top, transfer.paddingRight, bottom)
        requestLayout()
        if (!loaded) {
            loaded = true
            val query = listOfNotNull(
                cdnUrl.takeIf { it.isNotBlank() }?.let { "cdn=" + Uri.encode(it) },
                demoDate?.let { "date=" + Uri.encode(it) },
            )
            web.loadUrl("https://${AssetClient.HOST}/overlay.html" + if (query.isEmpty()) "" else "?" + query.joinToString("&"))
        }
    }

    // Отступы от системы приходят сразу при показе; если нет — грузим слой без них
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        postDelayed({ if (!loaded) setInsets(0, 0) }, 500)
    }

    // ---------- Зоны для слоя ----------

    private fun rect(view: View) = main.rectOf(view)

    // Шапка, где ходит стикер, — как в вебе, вся строка с аватаром
    private fun dockRect() = rect(main.header)

    // Шестерёнка отладки — как в вебе: слева, чуть выше таб-бара
    private fun gearRect(): Rect {
        val tab = rect(main.tabbar)
        val size = (40 * density).toInt()
        val left = (16 * density).toInt()
        val bottom = tab.top - (12 * density).toInt()
        return Rect(left, bottom - size, left + size, bottom)
    }

    private fun sendZones() {
        if (!pageReady || main.width == 0) return
        val zones = JSONArray()
        fun put(id: String, r: Rect, fill: JSONObject.() -> Unit = {}) {
            val top = web.top
            zones.put(JSONObject().apply {
                put("id", id)
                put("rect", JSONArray(listOf(r.left / density, (r.top - top) / density, r.right / density, (r.bottom - top) / density).map { (it * 10).roundToLong() / 10.0 }))
                fill()
            })
        }
        for (z in main.zones) {
            val r = if (z.dock) dockRect() else rect(z.view)
            put(z.id, r) {
                z.anchor?.let { put("anchor", it) }
                if (z.snow) put("snow", true)
                if (z.dock) put("dock", true)
            }
        }
        put("gear", gearRect()) { put("debug", true) }
        js("Overlay.setZones($zones)")
    }

    // ---------- Касания ----------

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (transfer.visibility == View.VISIBLE) return super.dispatchTouchEvent(ev)
        if (ev.actionMasked == MotionEvent.ACTION_DOWN) {
            val x = ev.x.toInt()
            val y = ev.y.toInt()
            webOnly = modal || gearRect().contains(x, y) || (dockRect().contains(x, y) && !rect(main.avatar).contains(x, y))
        }
        toWeb(ev)
        if (!webOnly) {
            main.dispatchTouchEvent(ev)
            trackPull(ev)
        }
        return true
    }

    private fun toWeb(ev: MotionEvent) {
        val copy = MotionEvent.obtain(ev)
        copy.offsetLocation(-web.left.toFloat(), -web.top.toFloat())
        web.dispatchTouchEvent(copy)
        copy.recycle()
    }

    // Pull-to-refresh — жест приложения: индикатор наш, дудл только подписан на 'pull'
    private fun trackPull(ev: MotionEvent) {
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = ev.x; downY = ev.y; pulled = false
            }
            MotionEvent.ACTION_MOVE -> {
                val dy = ev.y - downY
                if (!pulled && main.scroll.scrollY == 0 && dy > 80 * density && dy > 2 * abs(ev.x - downX)) {
                    pulled = true
                    spinner.visibility = View.VISIBLE
                    js("Overlay.pull()")
                    postDelayed({ spinner.visibility = View.GONE }, 900)
                }
            }
        }
    }

    // Кнопка экрана: эффект гаснет, дальше — тост или переход
    private fun onAction(toast: String?, open: String?) {
        js("Overlay.skip()")
        when {
            open == "transfer" -> openTransfer(true)
            toast != null -> showToast(toast)
        }
    }

    private fun showToast(text: String) {
        toast.text = text
        toast.animate().cancel()
        toast.translationY = dp(12).toFloat()
        toast.animate().alpha(1f).translationY(0f).setStartDelay(0).setDuration(200).withEndAction {
            toast.animate().alpha(0f).translationY(dp(12).toFloat()).setStartDelay(1400).setDuration(200).start()
        }.start()
    }

    // ---------- Перевод: критичный экран, эффектов нет ----------

    private fun openTransfer(open: Boolean) {
        transfer.visibility = if (open) View.VISIBLE else View.GONE
        web.visibility = if (open) View.INVISIBLE else View.VISIBLE
        js("Overlay.setSuppressed($open)")
    }

    /** Системное «назад»: закрывает перевод. false — закрывать нечего. */
    fun back(): Boolean {
        if (transfer.visibility != View.VISIBLE) return false
        openTransfer(false)
        return true
    }

    // Как #screen-transfer в вебе: кнопка «назад», заголовок, карточка с полями, зелёная кнопка
    private fun buildTransfer(): LinearLayout {
        fun text(value: String, size: Float, bold: Boolean = false, color: Int = MainScreen.TEXT) = TextView(context).apply {
            text = value
            setTextSize(TypedValue.COMPLEX_UNIT_DIP, size)
            setTextColor(color)
            includeFontPadding = false
            if (bold) typeface = Typeface.DEFAULT_BOLD
        }
        fun shape(color: Int, radius: Number, stroke: Int? = null) = GradientDrawable().apply {
            setColor(color)
            cornerRadius = radius.toFloat() * density
            stroke?.let { setStroke(dp(1), it) }
        }
        val full = { LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT) }
        fun field(label: String, hint: String, type: Int) = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(text(label, 13f, color = MainScreen.TEXT_2))
            addView(EditText(context).apply {
                this.hint = hint
                inputType = type
                setSingleLine()
                setTextSize(TypedValue.COMPLEX_UNIT_DIP, 17f)
                setTextColor(MainScreen.TEXT)
                setHintTextColor(Color.rgb(0x6F, 0x7A, 0x74))
                background = shape(Color.rgb(0x11, 0x14, 0x13), 14, Color.rgb(0x2F, 0x35, 0x32))
                setPadding(dp(14), dp(14), dp(14), dp(14))
            }, full().apply { topMargin = dp(6) })
        }
        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(MainScreen.BG)
            isClickable = true
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), 0, dp(16), 0)
            }
            addView(content, full())
            content.addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                addView(FrameLayout(context).apply {
                    background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(MainScreen.SURFACE) }
                    addView(ImageView(context).apply { setImageResource(R.drawable.ic_back) }, LayoutParams(dp(22), dp(22), Gravity.CENTER))
                    setOnClickListener { openTransfer(false) }
                }, LinearLayout.LayoutParams(dp(44), dp(44)))
                addView(text("Скинуть денег", 22f, bold = true), LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(12) })
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(60)).apply { topMargin = dp(44) })
            content.addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                background = shape(MainScreen.SURFACE, 22)
                setPadding(dp(16), dp(16), dp(16), dp(16))
                addView(field("Кому", "Номер телефона", InputType.TYPE_CLASS_PHONE), full())
                addView(field("Сумма", "0 ₽", InputType.TYPE_CLASS_NUMBER), full().apply { topMargin = dp(12) })
                addView(text("Перевести", 17f, bold = true, color = Color.rgb(0x04, 0x17, 0x0B)).apply {
                    gravity = Gravity.CENTER
                    background = shape(MainScreen.GREEN, 16)
                    setPadding(0, dp(16), 0, dp(16))
                    setOnClickListener { showToast("Это макет, деньги не уходят") }
                }, full().apply { topMargin = dp(16) })
            }, full().apply { topMargin = dp(8) })
            content.addView(text("На экранах оплаты, перевода, реквизитов и лимитов праздничный слой и дудлы не показываются.", 13f, color = MainScreen.TEXT_2).apply {
                setLineSpacing(0f, 1.4f)
            }, full().apply { topMargin = dp(14) })
        }
    }

    // ---------- Мост ----------

    private fun js(code: String) = web.evaluateJavascript("window.Overlay && $code", null)

    // Датчики: переворот, наклон и тряска — считаем нативно, слой получает готовые числа
    private val sensors = Sensors(context) { code -> if (pageReady && transfer.visibility != View.VISIBLE) js(code) }

    // Свернули и вернулись: страница получает visibilitychange — слой сверяет дату телефона
    fun resume() {
        web.onResume()
        sensors.start()
    }

    fun pause() {
        sensors.stop()
        web.onPause()
    }

    /** Показ: кнопки громкости листают дудлы. */
    fun step(dir: Int) {
        if (pageReady && transfer.visibility != View.VISIBLE) js("Overlay.step($dir)")
    }

    private fun setBalance(kopecks: Long) = main.animateBalance(kopecks) { rubles -> js("Overlay.balance($rubles)") }

    fun destroy() {
        web.destroy()
    }

    /** Вызовы из overlay.js. Приходят не в главном потоке — переносим в него. */
    private inner class Bridge {
        // Слой загрузился и ждёт зоны экрана
        @JavascriptInterface
        fun requestZones() = post { pageReady = true; sendZones() }

        @JavascriptInterface
        fun setModal(open: Boolean) = post { modal = open }

        @JavascriptInterface
        fun setBalance(rubles: Double) = post { setBalance((rubles * 100).roundToLong()) }

        @JavascriptInterface
        fun addBalance(rubles: Double) = post { setBalance(main.kopecks + (rubles * 100).roundToLong()) }
    }
}
