# Krypton IDE v3.0

Krypton IDE is a hyper-modern, fully native mobile & web development environment built for seamless productivity anywhere. It brings the power of desktop IDEs into your pocket, featuring offline execution, agentic AI assistance, and seamless cloud synchronization.

icon.png

## 🔥 What's New in v3.0

The 3.0 release is a massive overhaul focused on **Offline Execution, Real-Time AI, GitHub Integration, and Developer Productivity**.

### ⚡ Execution & Language Support
*   **Native React + Vite Preview**: Run React, Vite, and Next.js projects entirely in-browser via CDN React + Babel standalone transform — no server required.
*   **Kotlin & Java Support**: Fully integrated with the official Playground APIs.
*   **C / C++ Support**: New project templates with `Makefile` support for the C family.
*   **Multi-Language Runner**: HTML, JavaScript, Python, Go, Rust, Ruby, PHP, and more via Piston API.

### 🤖 Larry AI Assistant
*   **Real-Time Token Streaming**: Watch the AI write code line-by-line instantly — no more waiting for synchronous JSON generation.
*   **Agentic Tool Calling**: Larry can create, edit, and patch files directly in your project via structured tool calls.
*   **Recursive Subfolder Creation**: AI can now build deep folder hierarchies (e.g., `src/components/ui/Button.tsx`) in a single action.
*   **Multi-Provider Support**: Google Gemini, OpenAI, Anthropic Claude, Groq, Mistral, and OpenRouter — with dynamic model discovery.
*   **Context-Aware Chat**: Tag files with `@filename`, reference `@problems` for diagnostics, and attach images for multi-modal analysis.
*   **Persistent Glow UI**: AI message bubbles retain their premium blue glow effect after generation completes.

### 🐙 GitHub Integration
*   **GitHub Device Flow Login**: Securely authenticate with GitHub using device flow (code + browser verification).
*   **Push & Pull**: Push your project files to any GitHub repo and pull updates — all from within the IDE.
*   **Create & Publish**: Create new public/private repositories and auto-push on creation.
*   **Link Existing Repos**: Search and link any of your existing GitHub repositories to a project.
*   **GitHub Actions APK Build**: Trigger `build.yml` workflow dispatches for CI/CD APK builds directly from the IDE.
*   **Artifact Download**: Download build artifacts (APKs) from GitHub Actions runs to your device.

### 📁 File Management
*   **Open File / Open Folder**: Launch the native file manager to select files or entire folders — they're imported directly into the project tree for editing.
*   **Whole-File Copy/Paste**: Long-press a file → "Copy File" → navigate to another folder → "Paste File" — the entire file is duplicated.
*   **Send to AI**: Right-click any file → "Send to Larry" to inject it directly into the AI chat context.
*   **Duplicate, Download, Share**: Full file operations available from the context menu.
*   **ZIP Export**: Download the entire project as a `.zip` archive.

### 🔐 Authentication
*   **Google Sign-In**: Native Google authentication with crash-safe error handling (fixed circular reference crash from v2.x).
*   **GitHub OAuth**: Secure device-flow authentication with `repo` + `workflow` scopes.

### 🛠️ Productivity Utilities
*   **Advanced Command Palette** (`Ctrl+Shift+P`): Quick actions for all IDE features.
*   **Go to Line** (`Ctrl+G`): Jump to any line instantly.
*   **Find & Replace** (`Ctrl+H`): Integrated Monaco search widget.
*   **Search in Files** (`Ctrl+Shift+F`): Global project search from the sidebar.
*   **Mobile Toolbar**: Haptic-enabled Undo, Redo, Find, and Paste buttons above the keyboard.
*   **Keyboard-Aware Layout**: Bottom navigation hides when the keyboard opens (hardened with 10 redundant CSS rules for Android WebView compatibility).
*   **Dynamic Status Bar**: Real-time word count, character count, and file size tracking.
*   **Explorer Enhancements**: Collapse/Expand All, file size display, and visual "COPIED" badge for clipboard operations.
*   **14 Language Icons**: Brand-authentic SVG icons for React, Next.js, Vue, Angular, C, C++, Python, Go, Rust, Java, Kotlin, and more.

### ☁️ Sync & Storage
*   **Local Filesystem Storage**: All projects stored on visible external storage (`/storage/emulated/0/KryptonIDE/`) — users can browse and edit files directly.
*   **Real Files on Disk**: Projects are written as actual files and folders, not blobs — making them accessible from any file manager.
*   **Auto-Save**: 30-second interval + on-blur + on-visibility-change with debounced writes to prevent OOM crashes.
*   **Git Integration**: Push, pull, and commit using `isomorphic-git`.

---

## 🚀 Getting Started

### Local Development
```bash
# Install dependencies
npm install

# Run the development server (available on local network)
npm run dev

# Build the project
npm run build
```

### Android Deployment
```bash
# Sync Capacitor configuration and web assets
npm run cap:sync

# Open the project in Android Studio
npm run cap:android
```

## 🛠️ Tech Stack
*   **Framework**: React 19 + Vite
*   **Editor**: Monaco Editor (`@monaco-editor/react`)
*   **Terminal**: xterm.js
*   **Mobile Container**: Capacitor v8
*   **Styling**: Tailwind CSS v4
*   **Storage**: Capacitor Filesystem (ExternalStorage) + localStorage fallback
*   **AI**: Multi-provider LLM integration (Gemini, OpenAI, Claude, Groq, Mistral, OpenRouter)
*   **Git**: isomorphic-git + GitHub REST API



---
*Built by Sednium and Bhoid with ❤️*
