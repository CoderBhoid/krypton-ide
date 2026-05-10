# Krypton IDE v3.0

> The next-generation mobile & web development environment built for coding anywhere.

Krypton IDE brings the power of a desktop-class development workflow directly to your phone, tablet, or browser.  
Built with performance, flexibility, and AI-first development in mind, Krypton allows developers to create, edit, run, and deploy projects from virtually anywhere.

With native-like performance, offline execution, real filesystem access, GitHub integration, and a deeply integrated AI assistant, Krypton transforms mobile development into a serious productivity experience.

<img src="icon.png" alt="Krypton IDE Logo" width="140"/>

---

# ✨ What's New in v3.0

Version 3.0 is the biggest Krypton update yet — rebuilt from the ground up with major improvements to:

- ⚡ Offline Execution
- 🤖 Real-Time AI Workflows
- 🐙 GitHub Integration
- 📁 File Management
- 🛠️ Developer Productivity
- ☁️ Storage & Synchronization

---

# ⚡ Execution & Language Support

## 🌐 Native React + Vite Preview

Run React, Vite, and lightweight Next.js projects entirely in-browser using CDN-powered React + Babel transforms.

No local servers. No configuration headaches.

Features:
- Instant live preview
- Offline-compatible runtime
- Fast refresh support
- Mobile-friendly execution

---

## ☕ Kotlin & Java Support

Integrated support for Kotlin and Java through official Playground APIs.

- Real-time execution
- Fast compilation
- Mobile-compatible runtime
- Playground-based sandboxing

---

## ⚙️ C / C++ Support

New native templates for:
- C
- C++
- Makefile projects

Designed for lightweight systems programming workflows directly on mobile devices.

---

## 🧩 Multi-Language Runtime

Execute projects in multiple languages using the Piston API.

Supported languages include:
- HTML
- JavaScript
- TypeScript
- Python
- Go
- Rust
- Ruby
- PHP
- Java
- Kotlin
- C
- C++

and more.

---

# 🤖 Larry AI Assistant

Larry is Krypton’s deeply integrated AI-powered coding assistant designed to accelerate development workflows.

---

## ⚡ Real-Time Token Streaming

Watch AI responses generate live, token-by-token for a faster and more natural coding experience.

No more waiting for long synchronous responses.

---

## 🛠️ Agentic Tool Calling

Larry can directly interact with your project files using structured actions.

Capabilities include:
- Creating files
- Editing existing files
- Refactoring code
- Applying patches
- Generating components
- Updating configurations

---

## 📂 Recursive Folder Creation

Generate entire project structures in a single action.

Example:

```txt
src/
 └── components/
     └── ui/
         └── Button.tsx
```

---

## 🧠 Context-Aware Conversations

Reference project data directly in chat using:
- `@filename`
- `@problems`
- image attachments
- diagnostics context

This allows Larry to understand your project structure and provide more accurate assistance.

---

## 🌌 Persistent Glow UI

AI message bubbles now retain their premium animated blue glow effect after generation completes.

Small detail. Big difference.

---

## 🔌 Multi-Provider AI Support

Choose from multiple AI providers dynamically.

Supported providers:
- Google Gemini
- OpenAI
- Anthropic Claude
- Groq
- Mistral
- OpenRouter

Includes:
- Dynamic model discovery
- API key management
- Provider switching
- Flexible configuration

---

# 🐙 GitHub Integration

Krypton includes a fully integrated GitHub workflow designed for mobile development.

---

## 🔐 GitHub Device Flow Login

Secure authentication using GitHub Device Flow.

Users authenticate through:
1. Verification code
2. Browser confirmation
3. Automatic token linking

No embedded webview login required.

---

## 🚀 Push & Pull Support

Manage repositories directly from Krypton.

Features:
- Push commits
- Pull changes
- Sync repositories
- Branch management

---

## 📦 Create & Publish Repositories

Create:
- Public repositories
- Private repositories

and automatically push projects after creation.

---

## 🔗 Link Existing Repositories

Search and connect any repository from your GitHub account directly inside the IDE.

---

## ⚙️ GitHub Actions APK Builds

Trigger GitHub Actions workflows such as:

```yaml
build.yml
```

directly from Krypton for CI/CD Android APK generation.

---

## 📥 Artifact Downloads

Download generated APK artifacts directly from GitHub Actions runs to your device.

---

# 📁 Advanced File Management

Krypton provides a complete file management system optimized for mobile devices.

---

## 📂 Open Files & Folders

Import files or entire folders directly from your native file manager.

Imported files become part of the editable project tree instantly.

---

## 📋 Whole-File Copy & Paste

Long press any file to:
- Copy
- Duplicate
- Paste into another folder

while preserving content and structure.

---

## 🤖 Send to Larry

Inject any file directly into AI chat context using:
> "Send to Larry"

Perfect for:
- debugging
- refactoring
- code explanations

---

## 🧰 Full File Operations

Available actions include:
- Rename
- Duplicate
- Share
- Download
- Delete
- Copy Path

---

## 🗜️ ZIP Export

Export entire projects as downloadable `.zip` archives.

---

# 🔐 Authentication

## 🟢 Google Sign-In

Native Google authentication with hardened crash-safe handling.

Fixes previous circular-reference crashes found in v2.x.

---

## 🐙 GitHub OAuth

GitHub authentication includes support for:
- `repo`
- `workflow`

permissions.

---

# 🛠️ Productivity Features

Krypton v3.0 introduces major productivity enhancements inspired by modern desktop IDEs.

---

## ⌨️ Advanced Command Palette

Quickly access all IDE actions using:

```txt
Ctrl + Shift + P
```

---

## 📍 Go To Line

Jump instantly to any line:

```txt
Ctrl + G
```

---

## 🔎 Find & Replace

Integrated Monaco search widget:

```txt
Ctrl + H
```

---

## 🌍 Search in Files

Global project-wide search support:

```txt
Ctrl + Shift + F
```

---

## 📱 Mobile Productivity Toolbar

Quick-access buttons above the keyboard:
- Undo
- Redo
- Paste
- Find

with haptic feedback support.

---

## 📐 Keyboard-Aware Layout

Bottom navigation automatically hides when the keyboard opens.

Includes multiple Android WebView compatibility fallbacks for maximum stability.

---

## 📊 Dynamic Status Bar

Track:
- Word count
- Character count
- File size

in real time.

---

## 🗂️ Explorer Improvements

New explorer features:
- Collapse All
- Expand All
- File size indicators
- Clipboard badges
- Improved navigation

---

## 🎨 Language Icons

Includes authentic SVG icons for:
- React
- Next.js
- Vue
- Angular
- Python
- Go
- Rust
- Java
- Kotlin
- C
- C++
- and more

---

# ☁️ Sync & Storage

## 💾 Real Filesystem Storage

Projects are stored as real files inside:

```txt
/storage/emulated/0/KryptonIDE/
```

No hidden blobs. No proprietary storage format.

---

## 📂 Accessible Everywhere

Projects remain accessible from:
- file managers
- external editors
- backup systems
- cloud sync services

---

## 🔄 Smart Auto-Save

Automatic saving includes:
- 30-second intervals
- on-blur saves
- visibility-change saves
- debounced write protection

to reduce crashes and prevent data loss.

---

## 🌿 Git Integration

Powered by:
- `isomorphic-git`
- GitHub REST API

for lightweight native Git operations.

---

# 🚀 Getting Started

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 📱 Android Deployment

```bash
# Sync Capacitor assets
npm run cap:sync

# Open Android Studio
npm run cap:android
```

---

# 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Framework | React 19 + Vite |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Terminal | xterm.js |
| Mobile Runtime | Capacitor v8 |
| Styling | Tailwind CSS v4 |
| Storage | Capacitor Filesystem |
| AI Integration | Gemini, OpenAI, Claude, Groq, Mistral, OpenRouter |
| Git | isomorphic-git + GitHub REST API |

---

# 🌌 Vision

Krypton IDE was built around a simple idea:

> Developers should be able to create powerful software from anywhere — without being tied to a desktop computer.

Whether you're:
- fixing production bugs from your phone
- experimenting with AI-assisted development
- building React apps on the go
- managing repositories remotely
- learning programming anywhere

Krypton is designed to make development feel fast, modern, and limitless.

---

# ❤️ Credits

Built with passion by **Sednium** and **Bhoid**.

---
