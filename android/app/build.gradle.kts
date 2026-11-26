plugins {
    id("com.android.application")
}

// 把仓库根目录的网页文件复制进 App 的 assets/www，网页更新后重新打包即可同步
val webRoot = rootProject.projectDir.parentFile
val webAssetsDir = layout.buildDirectory.dir("webassets")

val copyWeb by tasks.registering(Sync::class) {
    from(webRoot) {
        include("index.html", "style.css", "oraclelist.csv", "fonts/**", "js/**", "favicon.svg")
    }
    into(webAssetsDir.map { it.dir("www") })
}

// 从 version-history.md 第一个 # 标题读出版本号，例如「# 更新内容 v2.5.1」→「2.5.1」
fun latestVersionName(): String {
    // 注意：在 Gradle 脚本里 "java" 指的是 Java 插件设定，不能写 java.io.File，所以用 webRoot.resolve
    val historyFile = webRoot.resolve("version-history.md")
    if (!historyFile.exists()) return "0.0.0"
    val heading = historyFile.readLines(Charsets.UTF_8).firstOrNull { line -> line.trim().startsWith("#") } ?: return "0.0.0"
    val withV = Regex("""[vV]\s*(\d+(?:\.\d+)*)""").find(heading)
    val anyNumber = Regex("""(\d+(?:\.\d+)+)""").find(heading)
    return (withV ?: anyNumber)?.groupValues?.get(1) ?: "0.0.0"
}

android {
    namespace = "com.mrwengkb.oraclematch"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mrwengkb.oraclematch"
        minSdk = 26
        targetSdk = 35
        // 每次 GitHub Actions 构建自动递增版本号，方便覆盖安装
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        // 显示给用户看的版本名称，取自 version-history.md 的最新版本
        versionName = latestVersionName()
    }

    // 固定签名：每次构建签名一致，新版才能直接覆盖安装旧版
    signingConfigs {
        create("release") {
            // GitHub Secrets 里设了私有密钥就用它（构建时解码到 ANDROID_KEYSTORE_FILE），
            // 没设的话退回仓库里公开的 oraclematch.keystore
            val ksFile = System.getenv("ANDROID_KEYSTORE_FILE")
            if (!ksFile.isNullOrBlank() && file(ksFile).exists()) {
                storeFile = file(ksFile)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            } else {
                storeFile = file("oraclematch.keystore")
                storePassword = "android"
                keyAlias = "oraclematch"
                keyPassword = "android"
            }
        }
    }

    // 两个版本：
    //   github：放在 GitHub Releases 的 APK，启动时检查更新（用户选择下载安装或以后再说）
    //   play：上传 Google Play 的 AAB，由 Play 商店负责更新，不含自带的检查更新，也不需要网络权限
    flavorDimensions += "store"
    productFlavors {
        create("github") {
            dimension = "store"
            buildConfigField("boolean", "UPDATE_CHECK", "true")
        }
        create("play") {
            dimension = "store"
            buildConfigField("boolean", "UPDATE_CHECK", "false")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(webAssetsDir.get().asFile)
        }
    }
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
