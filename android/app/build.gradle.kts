plugins {
    id("com.android.application")
}

android {
    namespace = "ru.sberkids.doodles"
    compileSdk = 36

    defaultConfig {
        applicationId = "ru.sberkids.doodles"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Распознавание QR с камеры: в Android SDK своего декодера нет (на iOS это делает AVFoundation)
    implementation("com.google.zxing:core:3.5.3")
}

// Слой эффектов (HTML + JS, конфиги и картинки по умолчанию) берётся прямо из web/ — тот же код,
// что и в браузерном прототипе. В APK он лежит в assets, CDN ложится поверх без релиза.
androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addStaticSourceDirectory(rootProject.file("../web").path)
    }
}
