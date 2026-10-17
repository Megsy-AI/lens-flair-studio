# Lumen Android app
Wraps https://photo.megsyai.com with Capacitor (appId com.megsyai.lumen).
Steps: `bun add @capacitor/core @capacitor/cli @capacitor/android && bunx cap add android`, then copy icons, then `bunx cap sync android` and build in Android Studio.
Clean permissions — AndroidManifest.xml must contain only:
- android.permission.INTERNET
- android.permission.CAMERA
- android.permission.READ_MEDIA_IMAGES (Android 13+) / READ_EXTERNAL_STORAGE maxSdkVersion=32
No location, microphone, contacts, or phone permissions.
