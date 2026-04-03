<div align="center">
  <img src="public/icon.png" alt="Krypton IDE" width="120" height="120" style="border-radius: 24px;" />
  
  # ⚡ Krypton IDE

  **The Ultimate Mobile Code Editor**

  *A powerful, native Android IDE built with Monaco Editor — code anywhere, anytime.*

  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-Android-green.svg)]()
  [![Built with](https://img.shields.io/badge/built%20with-Capacitor-blue.svg)](https://capacitorjs.com)
  [![Editor](https://img.shields.io/badge/editor-Monaco-purple.svg)](https://microsoft.github.io/monaco-editor/)

</div>

---

## 🎯 What is Krypton?

Krypton IDE brings the power of a desktop code editor to your Android device. Built on **Monaco Editor** (the same engine behind VS Code), it delivers a true IDE experience — syntax highlighting, IntelliSense, multi-file editing, an integrated terminal, and an AI assistant — all in your pocket.

> 🚀 **No server required.** Everything runs locally on your device.

---

## ✨ Features

### 🖥️ Professional Code Editor
- **Monaco Editor** with full syntax highlighting for 50+ languages
- **IntelliSense** — auto-completions, parameter hints, bracket matching
- **Multi-tab editing** with unsaved file indicators
- **Command Palette** (`Ctrl+Shift+P`) for quick actions
- **Markdown Preview** with live split-view editing

### 📁 Project Management
- Create, rename, and delete projects
- **Template system** — React, HTML/CSS/JS, Node.js, Python, and more
- Import/export projects as `.zip`
- Project backup & restore

### 🤖 Luminous AI Agent
- **6 AI providers** — Gemini, OpenAI, Claude, Groq, Mistral, OpenRouter
- **Multi-session chat** — Create unlimited conversations, auto-saved
- **Streaming responses** — Real-time token-by-token output
- **@file context tagging** — Tag any file for precise code assistance
- **1-click Apply** — Apply AI-suggested code edits instantly

### 💻 Integrated Terminal
- Full terminal emulator powered by **xterm.js**
- **Problems panel** with live error/warning diagnostics
- **Output panel** for build logs
- **Console panel** — captures `console.log` from live preview

### 👁️ Live Preview
- **HTML/CSS/JS** instant preview
- **React/JSX** with Babel transpilation
- **SVG rendering** support
- **Code execution** for JavaScript, TypeScript, Python, and more

### 🎨 Extensions & Themes
- **Theme extensions** — Dracula, Nord, Monokai, One Dark, Solarized, and more
- **Global theming** — Extension themes apply to the entire IDE shell
- **Custom fonts** — Upload your own coding fonts (.ttf, .otf, .woff2)
- **Productivity extensions** — TODO Highlight, Bracket Colorizer, and more

### 📱 Native Android Experience
- **Capacitor-powered** native Android app
- **Haptic feedback** on interactions
- **Touch-optimized** toolbar with quick-access actions
- **Immersive mode** — Full-screen editing with status bar integration
- **Auto-save** — Files saved automatically every 30 seconds

---

## 🛠️ Tech Stack

| Layer | Technology |
|:---|:---|
| **Editor** | Monaco Editor |
| **UI Framework** | React 19 + TypeScript |
| **Styling** | Tailwind CSS v4 |
| **State** | Zustand |
| **Terminal** | xterm.js |
| **Native Shell** | Capacitor 7 |
| **Build** | Vite 6 |
| **AI** | Multi-provider (Gemini, OpenAI, Anthropic, Groq, Mistral, OpenRouter) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 20+
- **Android Studio** (for native builds)

### Development
```bash
# Clone the repo
git clone https://github.com/CoderBhoid/krypton-ide.git
cd krypton-ide

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Build for Android
```bash
# Build web assets
npm run build

# Sync to native project
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Environment Variables
```bash
cp .env.example .env
# Edit .env with your Google Client ID (optional, for Google Sign-In)
```

---

## 📂 Project Structure

```
krypton-ide/
├── src/
│   ├── components/
│   │   ├── editor/        # Monaco editor, code toolbar
│   │   ├── layout/        # IDE layout shell
│   │   ├── preview/       # Live preview engine
│   │   ├── projects/      # Project dashboard
│   │   ├── sidebar/       # File explorer, AI chat, settings, extensions
│   │   └── terminal/      # Terminal, console, problems, output panels
│   ├── store/             # Zustand state management
│   └── lib/               # Utilities, code runner, formatter
├── android/               # Capacitor Android project
├── public/                # Static assets
├── Luminous.txt           # AI agent system prompt
└── future.md              # Roadmap & planned features
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. **Fork** the repository
2. Create a **feature branch** (`git checkout -b feature/awesome`)
3. **Commit** your changes (`git commit -m 'Add awesome feature'`)
4. **Push** to the branch (`git push origin feature/awesome`)
5. Open a **Pull Request**

---

## 📋 Roadmap

See [`future.md`](future.md) for the full list of planned features including:
- 🔄 Google Drive sync
- 📲 Share intents & deep links
- 🔍 Global search & replace
- 🌙 Light mode polish
- 🏪 Play Store listing

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  
  **Built with ❤️ by [Bhoid](https://github.com/CoderBhoid) and [Sednium](sednium.vercel.app)**

  ⭐ Star this repo if you find it useful!

</div>
