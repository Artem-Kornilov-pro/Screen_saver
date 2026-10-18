package ru.sberkids.doodles

import android.app.Activity
import android.app.AlertDialog
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowInsets
import android.webkit.WebView
import android.window.OnBackInvokedDispatcher
import java.io.File

/**
 * Демо СберKids: нативный главный экран и слой праздников и дудлов поверх.
 *
 * Дата для демо: adb shell am start -n ru.sberkids.doodles/.MainActivity -e date 2026-12-31
 */
class MainActivity : Activity() {

    private lateinit var stage: Stage

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val debuggable = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        if (debuggable) {
            WebView.setWebContentsDebuggingEnabled(true)
            catchCrashes()
            // Телефон на показе у жюри: экран не гаснет
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        stage = Stage(this, getString(R.string.cdn_url), intent.getStringExtra("date"))
        stage.setOnApplyWindowInsetsListener { _, insets ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars())
                stage.setInsets(bars.top, bars.bottom)
            } else {
                @Suppress("DEPRECATION")
                stage.setInsets(insets.systemWindowInsetTop, insets.systemWindowInsetBottom)
            }
            insets
        }
        setContentView(stage)
        @Suppress("DEPRECATION")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) window.decorView.systemUiVisibility =
            android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE or android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        else window.setDecorFitsSystemWindows(false)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) {
                if (!stage.back()) finish()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        stage.resume()
    }

    override fun onPause() {
        stage.pause()
        super.onPause()
    }

    // Показ: громкость «+» — следующий дудл, «−» — предыдущий. Саму громкость не меняем.
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val dir = when (event.keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> 1
            KeyEvent.KEYCODE_VOLUME_DOWN -> -1
            else -> return super.dispatchKeyEvent(event)
        }
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) stage.step(dir)
        return true
    }

    // Отладочная сборка: падение записываем в файл и показываем при следующем запуске — без adb и logcat
    private fun catchCrashes() {
        val file = File(filesDir, "crash.txt")
        if (file.exists()) {
            val text = file.readText()
            file.delete()
            AlertDialog.Builder(this)
                .setTitle("Прошлый запуск упал")
                .setMessage(text.take(3000))
                .setPositiveButton("OK", null)
                .show()
        }
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching { file.writeText(error.stackTraceToString()) }
            previous?.uncaughtException(thread, error)
        }
    }

    // Ответ на запрос камеры для QR-сканера
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == QrScreen.REQUEST_CAMERA) {
            stage.qr.onCameraPermission(grantResults.firstOrNull() == android.content.pm.PackageManager.PERMISSION_GRANTED)
        }
    }

    @Deprecated("Android 12 и ниже")
    override fun onBackPressed() {
        if (!stage.back()) @Suppress("DEPRECATION") super.onBackPressed()
    }

    override fun onDestroy() {
        stage.destroy()
        super.onDestroy()
    }
}
