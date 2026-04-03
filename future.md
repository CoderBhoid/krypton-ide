# Krypton IDE — Future Improvements

## 🔥 High Impact

- [ ] **Real Google Drive Sync** — OAuth2 with `drive.file` scope to upload/download projects to Drive (currently localStorage backup)
- [ ] **Native Terminal (Phase 2b)** — Capacitor plugin bridge to Android `ProcessBuilder` for real shell (needs native Kotlin)
- [ ] **Native File System** — `@capacitor/filesystem` to read/write device storage (`/KryptonIDE/`) (needs native Kotlin)
- [x] **Code Splitting** — Vite manual chunks: Monaco, xterm, vendor, tools split into separate bundles
- [x] **Streaming AI Responses** — All providers now use SSE streaming (Gemini, OpenAI, Anthropic)

## 🎨 UI/UX Polish

- [x] **Tab Close Animation** — `animate-tab-close` CSS class wired into CodeEditor tab removal with 200ms delay
- [ ] **Swipe Gestures** — Swipe right → open sidebar, swipe down → close preview (needs touch event handling)
- [ ] **Pull-to-Refresh on Projects** — Native-feel refresh on the projects dashboard
- [x] **Theme Persistence** — Extension theme re-applied on app restart via useEffect + interval polling for Monaco
- [ ] **Light Mode Polish** — Light theme needs its own CSS var overrides for full consistency

## 🛠️ Developer Experience

- [ ] **Custom Project Templates** — Let users save and reuse their own starter templates
- [ ] **Git Diff Viewer** — Show inline diffs when the AI suggests code changes
- [ ] **Search & Replace** — Global find-and-replace across all project files
- [ ] **Emmet Support** — HTML/CSS abbreviation expansion in the editor
- [x] **Console Log Capture** — `console.log/warn/error` from preview iframe captured and displayed in Console tab

## 📱 Native Features (require Android Studio / Kotlin)

- [ ] **Share Intent** — Accept shared files/text from other Android apps (needs AndroidManifest + Kotlin)
- [ ] **Deep Links** — Open `krypton://project/id` URLs from external apps (needs AndroidManifest)
- [x] **Auto-Save** — 30-second interval auto-save for all unsaved files
- [ ] **Offline Mode** — Cache everything for airplane coding
- [ ] **Play Store Listing** — Screenshots, description, feature graphic, privacy policy

## ✅ Completed This Session

- [x] Multi-session AI chat with history, create/delete/switch sessions
- [x] Chat sessions persist to localStorage across app restarts
- [x] Streaming responses for Gemini (SSE), OpenAI-compatible (SSE), Anthropic (SSE)
- [x] Abort/cancel streaming requests
- [x] Auto-generated session titles from first message
- [x] Tab close animation with CSS spring curves
- [x] Auto-save every 30 seconds
- [x] Theme persistence (restored on app restart)
- [x] Console log capture from preview iframe → Console tab in BottomPanel
- [x] Code splitting (Monaco, xterm, vendor, tools in separate chunks)
- [x] Luminous.txt completely rewritten for browser-only context
- [x] Global extension themes via CSS custom properties
- [x] Custom font upload in Settings
- [x] Projects backup button in Settings
