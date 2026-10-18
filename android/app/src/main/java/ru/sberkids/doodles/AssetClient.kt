package ru.sberkids.doodles

import android.content.res.AssetManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.ByteArrayInputStream
import java.io.IOException

/**
 * Раздаёт слой эффектов из assets по https-адресу, как WebViewAssetLoader, но без androidx.
 * С file:// не работают fetch конфигов и localStorage, а со своего https-адреса — работают,
 * и CDN поверх грузится обычными запросами в сеть.
 */
class AssetClient(private val assets: AssetManager) : WebViewClient() {

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val url = request.url
        if (url.host != HOST) return null
        val path = url.path.orEmpty().trimStart('/').ifEmpty { "overlay.html" }
        val mime = MIME[path.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"
        return try {
            WebResourceResponse(mime, if (mime.startsWith("image/") && mime != "image/svg+xml") null else "utf-8", assets.open(path)).apply {
                responseHeaders = mapOf("Cache-Control" to "no-cache")
            }
        } catch (e: IOException) {
            WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
        }
    }

    // Слой эффектов никуда не уходит со своей страницы
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = request.url.host != HOST

    companion object {
        const val HOST = "appassets.androidplatform.net"

        private val MIME = mapOf(
            "html" to "text/html",
            "js" to "text/javascript",
            "css" to "text/css",
            "json" to "application/json",
            "svg" to "image/svg+xml",
            "png" to "image/png",
            "webp" to "image/webp",
            "jpg" to "image/jpeg",
        )
    }
}
