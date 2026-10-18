package ru.sberkids.doodles

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextUtils
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Space
import android.widget.TextView
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlin.math.roundToLong

/**
 * Главный экран СберKids — нативно, один в один с нашим веб-макетом (web/index.html, css/app.css):
 * тёмная тема, аватар-инициал, карта с балансом, плитки, история операций, плавающий таб-бар.
 * Ширина тянется по экрану, история прокручивается, таб-бар прибит к низу. Размеры — dp из CSS.
 *
 * Для слоя эффектов экран отдаёт зоны (zones): где аватар, шапка, баланс, плитки, операции, таб-бар.
 */
@SuppressLint("ViewConstructor")
class MainScreen(
    context: Context,
    private val onAction: (toast: String?, open: String?) -> Unit,
) : FrameLayout(context) {

    /** Зона для слоя эффектов: якорь дудла, место для снега, шапка стикера. */
    class Zone(val id: String, val view: View, val anchor: String? = null, val snow: Boolean = false, val dock: Boolean = false)

    private val dp = resources.displayMetrics.density
    private fun dp(v: Number) = (v.toFloat() * dp).toInt()

    private val money = DecimalFormat("#,##0", DecimalFormatSymbols(Locale.forLanguageTag("ru")).apply { groupingSeparator = ' ' })
    var kopecks = 3568800L
        private set
    private var balanceAnim: ValueAnimator? = null

    val scroll = ScrollView(context)
    private val column = LinearLayout(context)
    val header = FrameLayout(context)
    val avatar = avatarView()
    private val card = LinearLayout(context)
    private val balanceView = TextView(context)
    private val thumb = ImageView(context)
    private val tiles = mutableListOf<View>()
    private val ops = mutableListOf<View>()
    val tabbar = LinearLayout(context)
    private lateinit var savings: View
    private lateinit var paw: View

    val zones: List<Zone> by lazy {
        listOf(
            Zone("dock", header, dock = true),
            Zone("avatar", avatar, anchor = "avatar"),
            Zone("card", card, snow = true),
            Zone("balance", balanceView, anchor = "balance"),
            Zone("card-thumb", thumb, anchor = "card-thumb"),
        ) + tiles.mapIndexed { i, v -> Zone("tile-$i", v, snow = true) } +
            ops.mapIndexed { i, v -> Zone("op-$i", v, snow = true, anchor = if (i == 1) "income" else null) } +
            listOf(
                Zone("tabbar", tabbar, snow = true),
                Zone("tab-savings", savings, anchor = "savings"),
                Zone("tab-paw", paw, anchor = "paw"),
            )
    }

    init {
        background = GlowBackground()

        column.orientation = LinearLayout.VERTICAL
        scroll.isVerticalScrollBarEnabled = false
        scroll.clipToPadding = false
        scroll.overScrollMode = View.OVER_SCROLL_NEVER
        scroll.addView(column, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        addView(scroll, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        buildHeader()
        buildCard()
        buildTiles()
        buildHistory()
        buildTabbar()
        showBalance(kopecks)
        setInsets(0, 0)
    }

    /** Системные панели. Под статус-баром, как в вебе, остаётся 44 dp — там висит гирлянда. */
    fun setInsets(top: Int, bottom: Int) {
        column.setPadding(dp(16), top + dp(44), dp(16), 0)
        scroll.setPadding(0, 0, 0, bottom + dp(120))
        (tabbar.layoutParams as LayoutParams).bottomMargin = bottom + dp(22)
        requestLayout()
    }

    // ---------- Сборка экрана ----------

    // font-weight из CSS: 600 и 700/800
    private fun weight(w: Int): Typeface =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(Typeface.DEFAULT, w, false)
        else if (w >= 600) Typeface.DEFAULT_BOLD else Typeface.DEFAULT

    private fun text(value: CharSequence, size: Float, w: Int = 400, color: Int = TEXT) = TextView(context).apply {
        text = value
        // Размеры в dp, как px в CSS: крупный системный шрифт вёрстку не ломает
        setTextSize(TypedValue.COMPLEX_UNIT_DIP, size)
        setTextColor(color)
        includeFontPadding = false
        typeface = weight(w)
    }

    private fun oneLine(view: TextView) = view.apply {
        maxLines = 1
        isSingleLine = true
        ellipsize = TextUtils.TruncateAt.END
    }

    private fun rounded(color: Int, radius: Number) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius.toFloat() * dp
    }

    private fun circle(color: Int) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
    }

    // Нажатие: рябь, как у кнопок Android. Действие — тост или переход.
    private fun <T : View> T.action(toast: String? = null, open: String? = null, radius: Number = 20): T {
        isClickable = true
        foreground = RippleDrawable(ColorStateList.valueOf(Color.argb(40, 255, 255, 255)), null, rounded(Color.BLACK, radius))
        setOnClickListener { onAction(toast, open) }
        return this
    }

    private fun image(res: Int) = ImageView(context).apply { setImageResource(res) }

    // Глянцевый инициал ребёнка: персонажей и Сберкота по ТЗ использовать нельзя
    private fun avatarView() = TextView(context).apply {
        text = "М"
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_DIP, 20f)
        typeface = weight(800)
        includeFontPadding = false
        setShadowLayer(3 * dp, 0f, dp.toFloat(), Color.argb(115, 90, 20, 80))
        background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(Color.rgb(0xB1, 0x97, 0xFC), Color.rgb(0xF0, 0x65, 0x95), Color.rgb(0xFF, 0x92, 0x2B))).apply {
            shape = GradientDrawable.OVAL
        }
    }

    private fun buildHeader() {
        avatar.action("Открываем профиль", radius = 22)
        header.addView(avatar, LayoutParams(dp(44), dp(44), Gravity.START or Gravity.CENTER_VERTICAL))
        column.addView(header, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(60)))
    }

    private fun buildCard() {
        card.orientation = LinearLayout.VERTICAL
        card.background = rounded(SURFACE, 22)
        card.clipToOutline = true

        val main = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(16), dp(16), dp(16), dp(18))
        }
        val left = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        left.addView(text("СберКарта", 15f, 600, SOFT))
        balanceView.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 28f)
        balanceView.typeface = weight(700)
        balanceView.setTextColor(TEXT)
        balanceView.includeFontPadding = false
        balanceView.letterSpacing = -0.02f
        oneLine(balanceView)
        left.addView(balanceView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) })
        main.addView(left, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        thumb.setImageResource(R.drawable.card_thumb)
        thumb.action("Открываем «СберКарту»", radius = 10)
        main.addView(thumb, LinearLayout.LayoutParams(dp(76), dp(50)))
        card.addView(main)

        card.addView(View(context).apply { setBackgroundColor(Color.argb(15, 255, 255, 255)) }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1))

        val bonus = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(13), dp(16), dp(13))
        }
        bonus.addView(text("Бонусы Спасибо", 14f, color = SOFT), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        bonus.addView(text("55", 14f, 700, SOFT))
        bonus.addView(text("С", 12f, 700, Color.rgb(0x06, 0x21, 0x0F)).apply {
            gravity = Gravity.CENTER
            background = circle(GREEN)
        }, LinearLayout.LayoutParams(dp(20), dp(20)).apply { leftMargin = dp(6) })
        card.addView(bonus)

        column.addView(card, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) })
    }

    private fun buildTiles() {
        val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        fun tile(title: String, iconRes: Int, iconBg: Int, iconSize: Int, toast: String? = null, open: String? = null) = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(SURFACE, 20)
            setPadding(dp(12), dp(12), dp(12), dp(12))
            addView(text(title, 14f, 600).apply { setLineSpacing(0f, 1.2f) })
            addView(Space(context), LinearLayout.LayoutParams(0, 0, 1f))
            addView(FrameLayout(context).apply {
                background = circle(iconBg)
                addView(image(iconRes), LayoutParams(dp(iconSize), dp(iconSize), Gravity.CENTER))
            }, LinearLayout.LayoutParams(dp(34), dp(34)))
            action(toast, open)
            tiles.add(this)
        }
        row.addView(tile("QR", R.drawable.ic_qr, Color.rgb(0x6C, 0x4C, 0xF0), 18, open = "qr"), LinearLayout.LayoutParams(dp(64), dp(104)))
        row.addView(tile("Скинуть\nденег", R.drawable.ic_arrow, Color.rgb(0x1E, 0x88, 0xFF), 18, open = "transfer"),
            LinearLayout.LayoutParams(0, dp(104), 1f).apply { leftMargin = dp(8) })
        row.addView(tile("Пополнить\nмобилку", R.drawable.ic_phone, Color.rgb(0x0F, 0x8A, 0x45), 18, toast = "Открываем «Пополнить мобилку»"),
            LinearLayout.LayoutParams(0, dp(104), 1f).apply { leftMargin = dp(8) })
        column.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) })
    }

    private fun buildHistory() {
        column.addView(text("История", 20f, 700), LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(26); bottomMargin = dp(10)
        })
        val tones = mapOf(
            "green" to (Color.rgb(0x1F, 0x4D, 0x2F) to Color.rgb(0x7B, 0xE2, 0x9B)),
            "orange" to (Color.rgb(0x4D, 0x36, 0x1F) to Color.rgb(0xFF, 0xBE, 0x73)),
            "blue" to (Color.rgb(0x1F, 0x35, 0x50) to Color.rgb(0x7C, 0xB8, 0xFF)),
        )
        val items = listOf(
            listOf("", "", "Уведомление от банка", "Для безопасности ваших средств никому не сообщайте код", ""),
            listOf("М", "green", "Перевод от мамы", "Карманные деньги", "+500 ₽"),
            listOf("Ш", "orange", "Школьная столовая", "Покупка", "−120 ₽"),
            listOf("К", "blue", "Книжный магазин", "Покупка", "−390 ₽"),
            listOf("П", "green", "Перевод от папы", "На кино", "+300 ₽"),
            listOf("К", "orange", "Кинотеатр", "Покупка", "−450 ₽"),
            listOf("С", "blue", "Спортивная секция", "Оплата занятий", "−1 200 ₽"),
            listOf("Б", "green", "Перевод от бабушки", "На день рождения", "+1 000 ₽"),
            listOf("И", "orange", "Магазин игрушек", "Покупка", "−690 ₽"),
            listOf("Ц", "blue", "Цветочный магазин", "Подарок маме", "−350 ₽"),
        )
        for ((letter, tone, title, sub, sum) in items) {
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                background = rounded(SURFACE, 18)
                setPadding(dp(14), dp(12), dp(14), dp(12))
                action("Операция: " + title.lowercase(), radius = 18)
            }
            val (bg, fg) = tones[tone] ?: (Color.rgb(0x3B, 0x42, 0x50) to Color.rgb(0xC9, 0xD3, 0xE6))
            val icon = FrameLayout(context).apply { background = circle(bg) }
            if (letter.isEmpty()) icon.addView(image(R.drawable.ic_mail), LayoutParams(dp(20), dp(20), Gravity.CENTER))
            else icon.addView(text(letter, 15f, 700, fg).apply { gravity = Gravity.CENTER }, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
            row.addView(icon, LinearLayout.LayoutParams(dp(40), dp(40)))
            val body = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
            body.addView(oneLine(text(title, 15f, 600)))
            body.addView(oneLine(text(sub, 13f, color = TEXT_2)).apply { setPadding(0, dp(3), 0, 0) })
            row.addView(body, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(12) })
            if (sum.isNotEmpty()) row.addView(oneLine(text(sum, 15f, 600, if (sum.startsWith("+")) GREEN else TEXT)), LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(12) })
            ops.add(row)
            column.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
        }
    }

    private fun buildTabbar() {
        tabbar.orientation = LinearLayout.HORIZONTAL
        tabbar.gravity = Gravity.CENTER_VERTICAL
        tabbar.background = rounded(Color.argb(235, 28, 31, 30), 24)
        tabbar.elevation = dp(8).toFloat()
        // Каждая вкладка — ячейка равной ширины, внутри колонка 60 dp: иконка и подпись в одну строку
        fun cell(content: View, w: Int, h: Int) = FrameLayout(context).apply { addView(content, LayoutParams(w, h, Gravity.CENTER)) }
        fun tab(iconRes: Int, title: String, active: Boolean = false) = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            addView(image(iconRes), LinearLayout.LayoutParams(dp(22), dp(22)))
            addView(oneLine(text(title, 10f, 600, if (active) GREEN else Color.rgb(0x6F, 0x7A, 0x74))).apply { gravity = Gravity.CENTER },
                LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(3) })
            action(if (active) null else "Открываем: " + title.lowercase(), radius = 14)
        }
        val weight = { LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f) }
        tabbar.addView(cell(tab(R.drawable.ic_home, "Главный", active = true), dp(60), LayoutParams.WRAP_CONTENT), weight())
        savings = tab(R.drawable.ic_piggy, "Копилки")
        tabbar.addView(cell(savings, dp(60), LayoutParams.WRAP_CONTENT), weight())
        paw = FrameLayout(context).apply {
            background = circle(Color.rgb(0xF7, 0xE6, 0xEC))
            addView(image(R.drawable.ic_paw), LayoutParams(dp(28), dp(28), Gravity.CENTER))
            action("Центральная кнопка", radius = 24)
        }
        tabbar.addView(cell(paw, dp(48), dp(48)), weight())
        tabbar.addView(cell(tab(R.drawable.ic_tasks, "Дела"), dp(60), LayoutParams.WRAP_CONTENT), weight())
        tabbar.addView(cell(tab(R.drawable.ic_content, "Контент"), dp(60), LayoutParams.WRAP_CONTENT), weight())
        tabbar.setPadding(dp(4), 0, dp(4), 0)
        addView(tabbar, LayoutParams(LayoutParams.MATCH_PARENT, dp(64), Gravity.BOTTOM).apply {
            leftMargin = dp(12); rightMargin = dp(12); bottomMargin = dp(22)
        })
    }

    // ---------- Баланс ----------

    private fun showBalance(value: Long) {
        val rub = money.format(value / 100)
        balanceView.text = SpannableStringBuilder("$rub ₽").apply {
            setSpan(ForegroundColorSpan(TEXT_2), rub.length, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
    }

    /** Сумма досчитывается до нового значения, потом onDone — слой проверит, не «красивое» ли оно. */
    fun animateBalance(target: Long, onDone: (rubles: Long) -> Unit) {
        balanceAnim?.cancel()
        val from = kopecks
        kopecks = target
        balanceAnim = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 700
            interpolator = DecelerateInterpolator(1.5f)
            addUpdateListener { showBalance(from + ((target - from) * (it.animatedValue as Float)).roundToLong()) }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    if (kopecks == target) onDone(target / 100)
                }
            })
            start()
        }
    }

    /** Прямоугольник view в координатах этого экрана. */
    fun rectOf(view: View): Rect {
        val a = IntArray(2)
        val b = IntArray(2)
        view.getLocationInWindow(a)
        getLocationInWindow(b)
        return Rect(a[0] - b[0], a[1] - b[1], a[0] - b[0] + view.width, a[1] - b[1] + view.height)
    }

    /**
     * Фон экрана, как .screen в CSS: тёмный, сверху слева зелёное свечение
     * radial-gradient(120% 55% at 15% -8%, …) — эллипс, поэтому круговой градиент растягиваем матрицей.
     */
    private class GlowBackground : Drawable() {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        override fun onBoundsChange(bounds: Rect) {
            val w = bounds.width().toFloat()
            val h = bounds.height().toFloat()
            val shader = RadialGradient(0f, 0f, 1f,
                intArrayOf(Color.argb(102, 150, 210, 40), Color.argb(31, 70, 130, 30), Color.TRANSPARENT),
                floatArrayOf(0f, 0.45f, 0.72f), Shader.TileMode.CLAMP)
            shader.setLocalMatrix(Matrix().apply {
                setScale(w * 1.2f, h.coerceAtMost(w * 2.2f) * 0.55f)
                postTranslate(w * 0.15f, -h.coerceAtMost(w * 2.2f) * 0.08f)
            })
            paint.shader = shader
        }

        override fun draw(canvas: Canvas) {
            canvas.drawColor(BG)
            canvas.drawRect(bounds, paint)
        }

        override fun setAlpha(alpha: Int) {}
        override fun setColorFilter(colorFilter: ColorFilter?) {}
        @Deprecated("Deprecated in Java")
        override fun getOpacity() = PixelFormat.OPAQUE
    }

    companion object {
        // Переменные из css/app.css
        val BG = Color.rgb(0x0B, 0x0D, 0x0C)
        val SURFACE = Color.rgb(0x1A, 0x1D, 0x1C)
        val TEXT = Color.rgb(0xF2, 0xF5, 0xF3)
        val TEXT_2 = Color.rgb(0x95, 0x9E, 0x99)
        val SOFT = Color.rgb(0xDF, 0xE6, 0xE1)
        val GREEN = Color.rgb(0x21, 0xC2, 0x5E)
    }
}
