package ru.sberkids.doodles

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader

/**
 * QR-сканер на весь экран — та же мастерская web/qr.html (qr.js), что в вебе и в iOS-версии:
 * пять сюжетов, пять рамок, демо без камеры и настоящая камера.
 * Камеру странице выдаём через WebChromeClient (с системным разрешением CAMERA),
 * кадр из рамки распознаёт ZXing (decodeQr) — встроенного BarcodeDetector в WebView может не быть.
 */
@SuppressLint("ViewConstructor", "SetJavaScriptEnabled")
class QrScreen(private val activity: Activity, private val onClose: () -> Unit) : FrameLayout(activity) {

    private var web: WebView? = null
    private var pendingCamera: PermissionRequest? = null

    fun open(theme: String? = null) {
        close(notify = false)
        val view = WebView(activity).apply {
            setBackgroundColor(Color.rgb(0x0B, 0x12, 0x0E))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            // video.play() камеры без отдельного жеста
            settings.mediaPlaybackRequiresUserGesture = false
            settings.textZoom = 100
            webViewClient = AssetClient(activity.assets)
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    activity.runOnUiThread { grantCamera(request) }
                }
            }
            addJavascriptInterface(Bridge(), "NativeBridge")
            loadUrl("https://${AssetClient.HOST}/qr.html" + (theme?.let { "?qr=$it" } ?: ""))
        }
        web = view
        addView(view, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        visibility = VISIBLE
    }

    /** Закрыть экран: камера освобождается вместе со страницей. */
    fun close(notify: Boolean = true) {
        pendingCamera?.deny()
        pendingCamera = null
        web?.let {
            removeView(it)
            it.destroy()
        }
        web = null
        visibility = GONE
        if (notify) onClose()
    }

    val isOpen get() = web != null

    fun pause() = web?.onPause()

    fun resume() = web?.onResume()

    // Странице нужна камера: системное разрешение есть — отдаём, нет — спрашиваем у ребёнка
    private fun grantCamera(request: PermissionRequest) {
        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE !in request.resources) {
            request.deny()
            return
        }
        if (activity.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
        } else {
            pendingCamera?.deny()
            pendingCamera = request
            activity.requestPermissions(arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA)
        }
    }

    /** Ответ на системный запрос камеры (из MainActivity.onRequestPermissionsResult). */
    fun onCameraPermission(granted: Boolean) {
        val request = pendingCamera ?: return
        pendingCamera = null
        if (granted) request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else request.deny()
    }

    private inner class Bridge {
        // Кадр из рамки (JPEG в base64) → текст QR или null. Синхронно: qr.js ждёт ответ на каждый кадр.
        @JavascriptInterface
        fun decodeQr(base64: String): String? = try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bitmap == null) null else {
                val pixels = IntArray(bitmap.width * bitmap.height)
                bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
                val source = RGBLuminanceSource(bitmap.width, bitmap.height, pixels)
                bitmap.recycle()
                QRCodeReader().decode(BinaryBitmap(HybridBinarizer(source)), mapOf(DecodeHintType.TRY_HARDER to true)).text
            }
        } catch (e: Exception) {
            null
        }

        @JavascriptInterface
        fun closeQr() {
            post { close() }
        }
    }

    companion object {
        const val REQUEST_CAMERA = 7
    }
}
