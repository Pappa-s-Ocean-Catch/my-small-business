plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.pappas.menudisplay"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.pappas.menudisplay"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "0.2.0"
        
        val apiUrl = System.getenv("MENU_DISCOVERY_API_URL") ?: project.findProperty("MENU_DISCOVERY_API_URL") as? String ?: "https://ocean-catch.vercel.app/api/tv-menus"
        buildConfigField("String", "MENU_DISCOVERY_API_URL", "\"${apiUrl}\"")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    
    buildFeatures {
        buildConfig = true
    }
    
    signingConfigs {
        getByName("debug") {
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
            enableV4Signing = true
        }
    }
    
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    
    testOptions { unitTests.isIncludeAndroidResources = true }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("com.google.zxing:core:3.5.3")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.14.1")
}
