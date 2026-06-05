# Ceflot Site — Mobile Android Operations App
## Standard Native Android Project Wrapper

This directory contains the independent **Ceflot Site** mobile Android Studio project ready to be compiled to an `.apk` or `.aab` file and installed on physical Android mobile devices or emulation simulators.

---

### Folder Contents
1. **`app/src/main/assets/public/`**: Contains the pre-compiled, minified, high-performance production distribution asset files (HTML, compiled JavaScript, styles, graphics, icons, fonts) of the streamlined **Site Operations Terminal**.
2. **`web-src/`**: Contains the complete, editable, 100% transparent React-Vite web application source codebase representing the exact mobile terminal capabilities:
   - **Login Page**: Secured access powered directly by Supabase Auth with an eye-safe dark twilight display.
   - **Project Selection**: Real-time project query lists corresponding to user credentials and profiles.
   - **Site Operations Area**: Complete 4-role contextual views (Site Encoder, Storeman, Procurement Specialist, and Project Superintendent) supporting daily log wizards, GRN material inflows/outflows, alert logs, and operational reference libraries.
3. **`local.properties`**: Houses connections and credentials pointing directly to the production database matching your setup.

---

### Compile Process with Android Studio
Deploying this app onto physical devices is direct:
1. Launch **Android Studio** (Koala / Ladybug or later).
2. Press "Open An Existing Project" and select this folder (`Ceflot Site`).
3. Allow Android Studio to automatically index files, resolve references, and fetch the Gradle Wrapper (`gradle-8.2`).
4. Connect your Android handset via USB (ensure **Developer Options** and **USB Debugging** are active).
5. Look at the toolbar to verify your handset, then press the green **"Run"** button or go to:
   `Build -> Build Bundle(s) / APK(s) -> Build APK(s)`
6. Once built, Android Studio will output the installable package to:
   `app/build/outputs/apk/debug/app-debug.apk`

---

### Configuration
Your production settings are stored in `local.properties` and the bundled `web-src/.env` files.
To modify connection URLs or API keys, update `web-src/.env` and compile again:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
