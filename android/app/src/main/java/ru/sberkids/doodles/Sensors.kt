package ru.sberkids.doodles

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import java.util.Locale
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.asin
import kotlin.math.sqrt

/**
 * Датчики для слоя эффектов. В WebView на Android deviceorientation приходит не всегда,
 * поэтому считаем сами по акселерометру и отдаём слою готовые числа:
 *  - onTilt(angle, tilt): angle — на сколько градусов экран отвёрнут от неба (0 — экраном вверх,
 *    180 — экраном вниз), tilt — наклон влево-вправо −1 … 1 (ветер для снега). Не чаще 10 раз в секунду.
 *  - onMotion(force): встряска, м/с² без гравитации. Только заметные толчки, порог решает конфиг слоя.
 */
class Sensors(context: Context, private val send: (String) -> Unit) : SensorEventListener {

    private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accel: Sensor? = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val gravity = FloatArray(3)
    private var hasGravity = false
    private var lastTiltAt = 0L
    private var lastMotionAt = 0L
    private var lastAngle = -1f
    private var lastTilt = 0f

    fun start() {
        accel?.let { manager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    fun stop() {
        manager.unregisterListener(this)
        hasGravity = false
    }

    override fun onSensorChanged(event: SensorEvent) {
        val v = event.values
        if (!hasGravity) {
            v.copyInto(gravity, 0, 0, 3)
            hasGravity = true
        }
        // Гравитация — медленная часть сигнала, всё остальное — толчки руки
        for (i in 0..2) gravity[i] = GRAVITY_SMOOTH * gravity[i] + (1 - GRAVITY_SMOOTH) * v[i]
        val lx = v[0] - gravity[0]
        val ly = v[1] - gravity[1]
        val lz = v[2] - gravity[2]
        val force = sqrt(lx * lx + ly * ly + lz * lz)
        val now = SystemClock.uptimeMillis()

        if (force > MOTION_MIN && now - lastMotionAt > MOTION_EVERY_MS) {
            lastMotionAt = now
            send(String.format(Locale.ROOT, "Overlay.motion(%.1f)", force))
        }

        val g = sqrt(gravity[0] * gravity[0] + gravity[1] * gravity[1] + gravity[2] * gravity[2])
        if (g < 1f || now - lastTiltAt < TILT_EVERY_MS) return
        val angle = Math.toDegrees(acos((gravity[2] / g).coerceIn(-1f, 1f).toDouble())).toFloat()
        // Как gamma в браузере: правый край вниз — плюс; 45° — полный ветер
        val tilt = (Math.toDegrees(asin((-gravity[0] / g).coerceIn(-1f, 1f).toDouble())).toFloat() / 45f).coerceIn(-1f, 1f)
        if (abs(angle - lastAngle) < 1f && abs(tilt - lastTilt) < 0.02f) return
        lastTiltAt = now
        lastAngle = angle
        lastTilt = tilt
        send(String.format(Locale.ROOT, "Overlay.sensors(%.1f, %.3f)", angle, tilt))
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    companion object {
        private const val GRAVITY_SMOOTH = 0.85f
        private const val MOTION_MIN = 6f          // м/с²: слабее — точно не тряска, слою не шлём
        private const val MOTION_EVERY_MS = 60L
        private const val TILT_EVERY_MS = 100L
    }
}
