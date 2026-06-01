# APK Compilation & Direct Database Sourcing Guide
## Ceflot Mobile Site Operations App

This guide outlines the system architecture, graphic asset requirements, toolchains, and exact compilation steps to assemble and release the native Android APK (`.apk`) or Android App Bundle (`.aab`) of the Ceflot Mobile Operations App.

---

## 1. Zero Demo / Direct Database Integration

The mobile application running in the native Android WebView is configured to bypass all mock placeholders and connect **directly** to the production PostgreSQL database via the Supabase Client SDK.

### A. Environment Configuration (`.env` vs System Envs)
When building the Android app, Capacitor packages the web assets compiled via Vite. Since Capacitor runs client-side inside the Android WebView, sensitive environment variables must **never** contain master database secrets. Instead:
1. **Public Keys**: Use public access keys with **Row-Level Security (RLS)** fully enabled on your Supabase Postgres tables.
2. **Setup File**: Create a solid `.env.production` file at the root level before building:
   ```env
   VITE_SUPABASE_URL=https://pshyzvhr2h3mubieqwsdie.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-key-here
   ```
3. **Parity**: The client-side database connections are initialized inside `src/lib/supabase.ts` and fetch real-time state seamlessly across both mobile and web builds.

---

## 2. Graphic Asset Requirements

To ensure a highly pixel-dense and premium visual presence on standard mobile displays, prepare and place the following image assets prior to compilation:

| Asset Type | File Name | Target Resolution / Density | Vector/Format | Path Location in Android Project |
| :--- | :--- | :--- | :--- | :--- |
| **Launcher Icon (Standard)** | `ic_launcher.png` | 48x48 (mdpi) to 192x192 (xxxhdpi) | PNG / adaptive | `android/app/src/main/res/mipmap-*/` |
| **Launcher Icon (Round)** | `ic_launcher_round.png`| 48x48 (mdpi) to 192x192 (xxxhdpi) | PNG / adaptive | `android/app/src/main/res/mipmap-*/` |
| **Notification Silhouette**| `ic_notification.png` | 24x24 (mdpi) to 96x96 (xxxhdpi) | White-only XML Vector | `android/app/src/main/res/drawable-*/` |
| **Splash Screen Backdrop** | `splash.png` | 2732x2732 px (Unscaled canvas) | Optimized PNG | `android/app/src/main/res/drawable/` |

### Setting up Custom Icons dynamically
You can generate adaptive launcher icons and assets by running:
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --android
```
This automatically scales a single source `assets/icon-only.png` and `assets/splash.png` file into all target Android density subfolders (`drawable-hdpi`, `drawable-xhdpi`, etc.).

---

## 3. Toolchain & Runtime Requirements

Ensure your local workstation has the following compilers registered:
* **Java Development Kit (JDK)**: JDK 17 (Required by Gradle 8+)
* **Android SDK**: Build-Tools version `34.0.0` or greater with SDK platform active.
* **Gradle Wrapper**: Set to pre-configured version `8.2.1` inside `/android/gradle/wrapper/gradle-wrapper.properties`.
* **Capacitor CLI**: `@capacitor/cli` v6.x (installed in root project).

---

## 4. Step-by-Step Compilation Workflow

Follow this step-by-step pipeline to build, synchronize, and compile the final mobile APK:

### Step A: Complete Web Compilation
First, compile the React + Vite asset bundles from TypeScript into compressed Javascript/HTML/CSS assets.
```bash
# Run tests and build statically to dist/
npm run build
```

### Step B: Sync Web Bundles to Android Assets
Transfer the compiled web distribution files (`/dist`) into the local Android project container.
```bash
npx cap sync
```
*Note: This command copies all assets from `/dist` into `android/app/src/main/assets/public/` and updates any registered Capacitor plugins.*

### Step C: Build the Debug APK in CLI
You can compile a test development APK directly from your command terminal without opening an editor:
```bash
cd android
./gradlew assembleDebug
```
Once completed, the resulting compilations are written to:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Step D: Build the Signed Release APK or Bundle (AAB)
To generate a production-ready package optimized for release:
```bash
./gradlew assembleRelease
```
To generate an AAB for uploading to the Google Play Console:
```bash
./gradlew bundleRelease
```
*Outputs will be located under:*
* **APK**: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
* **Bundle**: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 5. Testing and Android Emulation

To test and preview the application inside an Android Simulator or on a physical USB-connected smartphone:

1. **Open the Project in Android Studio**:
   ```bash
   npx cap open android
   ```
2. **Run live HMR Emulation (Optional)**:
   You can bridge host dev server logs to your phone's webview using the live server option in `capacitor.config.ts`:
   ```typescript
   server: {
     url: "http://10.0.2.2:3000", // Android Emulator local loopback port
     cleartext: true
   }
   ```
3. Run the project in Android Studio by pressing the green **"Play"** button mapped to your emulator. All database reads and writes execute directly with zero latency!
