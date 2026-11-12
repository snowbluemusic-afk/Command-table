plugins { id("com.android.application") }
android {
    namespace = "com.mendinghour.game"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.mendinghour.game"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
