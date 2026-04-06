import type { FileNode } from '../store/useIdeStore';

export type ProjectTemplate = 
  | 'blank' 
  | 'html-css-js' 
  | 'react' 
  | 'python' 
  | 'markdown' 
  | 'android-java' 
  | 'android-kotlin' 
  | 'android-compose' 
  | 'rust-cli' 
  | 'java-cli' 
  | 'kotlin-cli'
  | 'vite-react'
  | 'nextjs'
  | 'python-fastapi'
  | 'nodejs-express';

export function getTemplateFiles(template: ProjectTemplate): Record<string, FileNode> {
  const root: FileNode = {
    id: 'root',
    name: 'Project',
    type: 'folder',
    parentId: null,
    children: [],
  };

  const getWorkflowConfig = (projectType: string) => `name: Krypton Build
on:
  workflow_dispatch:
    inputs:
      build_type:
        description: 'Build type'
        default: 'debug'
        type: choice
        options: [debug, release]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'gradle'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Build APK
        run: |
          chmod +x gradlew
          ./gradlew assemble\${{ inputs.build_type == 'release' && 'Release' || 'Debug' }}

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: krypton-apk
          path: app/build/outputs/apk/**/*.apk
          retention-days: 7
`;

  switch (template) {
    case 'html-css-js': {
      root.children = ['index_html', 'style_css', 'app_js'];
      return {
        root,
        index_html: {
          id: 'index_html',
          name: 'index.html',
          type: 'file',
          content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="app">\n    <h1>Hello World!</h1>\n    <p>Start coding your app here.</p>\n    <button id="btn">Click Me</button>\n  </div>\n  <script src="app.js"></script>\n</body>\n</html>',
          parentId: 'root',
          language: 'html',
        },
        style_css: {
          id: 'style_css',
          name: 'style.css',
          type: 'file',
          content: '* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  background: #0f0f0f;\n  color: #e0e0e0;\n  min-height: 100vh;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n\n#app {\n  text-align: center;\n  padding: 2rem;\n  background: #1a1a2e;\n  border-radius: 16px;\n  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);\n}\n\nh1 {\n  background: linear-gradient(135deg, #667eea, #764ba2);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  margin-bottom: 0.5rem;\n}\n\nbutton {\n  margin-top: 1rem;\n  padding: 12px 32px;\n  background: linear-gradient(135deg, #667eea, #764ba2);\n  color: white;\n  border: none;\n  border-radius: 8px;\n  font-size: 1rem;\n  cursor: pointer;\n  transition: transform 0.2s, box-shadow 0.2s;\n}\n\nbutton:hover {\n  transform: translateY(-2px);\n  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);\n}\n',
          parentId: 'root',
          language: 'css',
        },
        app_js: {
          id: 'app_js',
          name: 'app.js',
          type: 'file',
          content: 'document.addEventListener("DOMContentLoaded", () => {\n  const btn = document.getElementById("btn");\n  let count = 0;\n\n  btn.addEventListener("click", () => {\n    count++;\n    btn.textContent = `Clicked ${count} time${count !== 1 ? "s" : ""}`;\n  });\n\n  console.log("App initialized!");\n});\n',
          parentId: 'root',
          language: 'javascript',
        },
      };
    }

    case 'react': {
      root.children = ['index_html_r', 'app_jsx', 'style_css_r'];
      return {
        root,
        index_html_r: {
          id: 'index_html_r',
          name: 'index.html',
          type: 'file',
          content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>React App</title>\n  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>\n  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>\n  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="root"></div>\n  <script type="text/babel" src="app.jsx"></script>\n</body>\n</html>',
          parentId: 'root',
          language: 'html',
        },
        app_jsx: {
          id: 'app_jsx',
          name: 'app.jsx',
          type: 'file',
          content: 'const { useState } = React;\n\nfunction App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className="app">\n      <h1>React App</h1>\n      <p>You clicked {count} times</p>\n      <button onClick={() => setCount(c => c + 1)}>\n        Click me\n      </button>\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById("root")).render(<App />);\n',
          parentId: 'root',
          language: 'javascript',
        },
        style_css_r: {
          id: 'style_css_r',
          name: 'style.css',
          type: 'file',
          content: 'body {\n  font-family: system-ui, sans-serif;\n  background: #0f0f0f;\n  color: #e0e0e0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n  margin: 0;\n}\n\n.app {\n  text-align: center;\n  padding: 2rem;\n  background: #1a1a2e;\n  border-radius: 16px;\n  box-shadow: 0 20px 60px rgba(0,0,0,0.5);\n}\n\nh1 {\n  color: #61dafb;\n}\n\nbutton {\n  margin-top: 1rem;\n  padding: 12px 32px;\n  background: #61dafb;\n  color: #000;\n  border: none;\n  border-radius: 8px;\n  font-size: 1rem;\n  cursor: pointer;\n}\n',
          parentId: 'root',
          language: 'css',
        },
      };
    }

    case 'vite-react': {
      root.children = ['pkg_json_vr', 'vite_config', 'index_html_vr', 'src_vr'];
      return {
        root,
        pkg_json_vr: { id: 'pkg_json_vr', name: 'package.json', type: 'file', parentId: 'root', language: 'json', content: '{\n  "name": "vite-react",\n  "private": true,\n  "version": "0.0.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.2.1",\n    "vite": "^5.0.8"\n  }\n}\n' },
        vite_config: { id: 'vite_config', name: 'vite.config.js', type: 'file', parentId: 'root', language: 'javascript', content: 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n});\n' },
        index_html_vr: { id: 'index_html_vr', name: 'index.html', type: 'file', parentId: 'root', language: 'html', content: '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vite + React</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n' },
        src_vr: { id: 'src_vr', name: 'src', type: 'folder', parentId: 'root', children: ['main_jsx', 'App_jsx_vr'] },
        main_jsx: { id: 'main_jsx', name: 'main.jsx', type: 'file', parentId: 'src_vr', language: 'javascript', content: 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App.jsx";\n\nReactDOM.createRoot(document.getElementById("root")).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n' },
        App_jsx_vr: { id: 'App_jsx_vr', name: 'App.jsx', type: 'file', parentId: 'src_vr', language: 'javascript', content: 'import { useState } from "react";\n\nfunction App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div style={{ textAlign: "center", marginTop: "50px" }}>\n      <h1>Vite + React</h1>\n      <button onClick={() => setCount((count) => count + 1)}>\n        count is {count}\n      </button>\n    </div>\n  );\n}\n\nexport default App;\n' }
      };
    }

    case 'nextjs': {
      root.children = ['pkg_json_nx', 'next_config', 'app_nx'];
      return {
        root,
        pkg_json_nx: { id: 'pkg_json_nx', name: 'package.json', type: 'file', parentId: 'root', language: 'json', content: '{\n  "name": "nextjs-app",\n  "version": "0.1.0",\n  "private": true,\n  "scripts": {\n    "dev": "next dev",\n    "build": "next build",\n    "start": "next start"\n  },\n  "dependencies": {\n    "react": "^18",\n    "react-dom": "^18",\n    "next": "14"\n  }\n}\n' },
        next_config: { id: 'next_config', name: 'next.config.js', type: 'file', parentId: 'root', language: 'javascript', content: '/** @type {import(\'next\').NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;\n' },
        app_nx: { id: 'app_nx', name: 'app', type: 'folder', parentId: 'root', children: ['layout_js', 'page_js'] },
        layout_js: { id: 'layout_js', name: 'layout.js', type: 'file', parentId: 'app_nx', language: 'javascript', content: 'export const metadata = {\n  title: "Next.js",\n  description: "Generated by Krypton"\n};\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n' },
        page_js: { id: 'page_js', name: 'page.js', type: 'file', parentId: 'app_nx', language: 'javascript', content: 'export default function Home() {\n  return (\n    <main style={{ padding: "2rem", textAlign: "center" }}>\n      <h1>Welcome to Next.js</h1>\n      <p>Edit app/page.js to save changes.</p>\n    </main>\n  );\n}\n' }
      };
    }

    case 'python-fastapi': {
      root.children = ['main_py_fa', 'req_txt_fa'];
      return {
        root,
        main_py_fa: { id: 'main_py_fa', name: 'main.py', type: 'file', parentId: 'root', language: 'python', content: 'from fastapi import FastAPI\nimport uvicorn\n\napp = FastAPI(title="Krypton API")\n\n@app.get("/")\ndef read_root():\n    return {"Hello": "World"}\n\n@app.get("/items/{item_id}")\ndef read_item(item_id: int, q: str = None):\n    return {"item_id": item_id, "q": q}\n\nif __name__ == "__main__":\n    uvicorn.run(app, host="0.0.0.0", port=8000)\n' },
        req_txt_fa: { id: 'req_txt_fa', name: 'requirements.txt', type: 'file', parentId: 'root', language: 'plaintext', content: 'fastapi\nuvicorn\n' }
      };
    }

    case 'nodejs-express': {
      root.children = ['pkg_json_ex', 'index_js_ex'];
      return {
        root,
        pkg_json_ex: { id: 'pkg_json_ex', name: 'package.json', type: 'file', parentId: 'root', language: 'json', content: '{\n  "name": "express-api",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  },\n  "dependencies": {\n    "express": "^4.18.2"\n  }\n}\n' },
        index_js_ex: { id: 'index_js_ex', name: 'index.js', type: 'file', parentId: 'root', language: 'javascript', content: 'const express = require("express");\nconst app = express();\nconst port = 3000;\n\napp.use(express.json());\n\napp.get("/", (req, res) => {\n  res.send("Hello World from Express!");\n});\n\napp.get("/api/data", (req, res) => {\n  res.json({ message: "Success", data: [1, 2, 3] });\n});\n\napp.listen(port, () => {\n  console.log(`Example app listening on port ${port}`);\n});\n' }
      };
    }

    case 'python': {
      root.children = ['main_py', 'readme_md_p'];
      return {
        root,
        main_py: {
          id: 'main_py',
          name: 'main.py',
          type: 'file',
          content: '# Krypton IDE - Python Project\n\ndef greet(name: str) -> str:\n    """Return a greeting message."""\n    return f"Hello, {name}! Welcome to Krypton IDE."\n\ndef main():\n    print(greet("Developer"))\n    \n    # Example: Simple calculator\n    numbers = [1, 2, 3, 4, 5]\n    total = sum(numbers)\n    average = total / len(numbers)\n    \n    print(f"Numbers: {numbers}")\n    print(f"Sum: {total}")\n    print(f"Average: {average}")\n\nif __name__ == "__main__":\n    main()\n',
          parentId: 'root',
          language: 'python',
        },
        readme_md_p: {
          id: 'readme_md_p',
          name: 'README.md',
          type: 'file',
          content: '# Python Project\n\nA Python project created with Krypton IDE.\n\n## Getting Started\n\nEdit `main.py` to start coding!\n',
          parentId: 'root',
          language: 'markdown',
        },
      };
    }

    case 'markdown': {
      root.children = ['readme_md_m', 'notes_md'];
      return {
        root,
        readme_md_m: {
          id: 'readme_md_m',
          name: 'README.md',
          type: 'file',
          content: '# My Document\n\nStart writing your markdown content here.\n\n## Features\n\n- Easy to write\n- Supports formatting\n- Great for documentation\n\n## Code Example\n\n```javascript\nconsole.log("Hello from Krypton!");\n```\n',
          parentId: 'root',
          language: 'markdown',
        },
        notes_md: {
          id: 'notes_md',
          name: 'notes.md',
          type: 'file',
          content: '# Notes\n\n- [ ] First task\n- [ ] Second task\n- [x] Completed task\n',
          parentId: 'root',
          language: 'markdown',
        },
      };
    }

    case 'android-java': {
      root.children = ['app_folder', 'build_gradle', 'settings_gradle', 'github_folder'];
      return {
        root,
        app_folder: {
          id: 'app_folder',
          name: 'app',
          type: 'folder',
          parentId: 'root',
          children: ['src_folder', 'app_build_gradle'],
        },
        src_folder: {
          id: 'src_folder',
          name: 'src',
          type: 'folder',
          parentId: 'app_folder',
          children: ['main_folder'],
        },
        main_folder: {
          id: 'main_folder',
          name: 'main',
          type: 'folder',
          parentId: 'src_folder',
          children: ['java_folder', 'res_folder', 'android_manifest'],
        },
        java_folder: {
          id: 'java_folder',
          name: 'java',
          type: 'folder',
          parentId: 'main_folder',
          children: ['com_folder'],
        },
        com_folder: {
          id: 'com_folder',
          name: 'com',
          type: 'folder',
          parentId: 'java_folder',
          children: ['example_folder'],
        },
        example_folder: {
          id: 'example_folder',
          name: 'example',
          type: 'folder',
          parentId: 'com_folder',
          children: ['app_folder_src'],
        },
        app_folder_src: {
          id: 'app_folder_src',
          name: 'app',
          type: 'folder',
          parentId: 'example_folder',
          children: ['MainActivity_java'],
        },
        MainActivity_java: {
          id: 'MainActivity_java',
          name: 'MainActivity.java',
          type: 'file',
          parentId: 'app_folder_src',
          language: 'java',
          content: 'package com.example.app;\n\nimport android.os.Bundle;\nimport androidx.appcompat.app.AppCompatActivity;\n\npublic class MainActivity extends AppCompatActivity {\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        setContentView(R.layout.activity_main);\n    }\n}\n'
        },
        res_folder: {
          id: 'res_folder',
          name: 'res',
          type: 'folder',
          parentId: 'main_folder',
          children: ['layout_folder', 'values_folder'],
        },
        layout_folder: {
          id: 'layout_folder',
          name: 'layout',
          type: 'folder',
          parentId: 'res_folder',
          children: ['activity_main_xml'],
        },
        activity_main_xml: {
          id: 'activity_main_xml',
          name: 'activity_main.xml',
          type: 'file',
          parentId: 'layout_folder',
          language: 'xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"\n    android:layout_width="match_parent"\n    android:layout_height="match_parent"\n    android:gravity="center"\n    android:orientation="vertical">\n    <TextView\n        android:layout_width="wrap_content"\n        android:layout_height="wrap_content"\n        android:text="Hello Android from Krypton IDE!"\n        android:textSize="24sp" />\n</LinearLayout>\n'
        },
        values_folder: {
          id: 'values_folder',
          name: 'values',
          type: 'folder',
          parentId: 'res_folder',
          children: ['strings_xml'],
        },
        strings_xml: {
          id: 'strings_xml',
          name: 'strings.xml',
          type: 'file',
          parentId: 'values_folder',
          language: 'xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">Android Java App</string>\n</resources>\n'
        },
        android_manifest: {
          id: 'android_manifest',
          name: 'AndroidManifest.xml',
          type: 'file',
          parentId: 'main_folder',
          language: 'xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    package="com.example.app">\n    <application\n        android:allowBackup="true"\n        android:icon="@mipmap/ic_launcher"\n        android:label="@string/app_name"\n        android:roundIcon="@mipmap/ic_launcher_round"\n        android:supportsRtl="true"\n        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">\n        <activity\n            android:name=".MainActivity"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n'
        },
        app_build_gradle: {
          id: 'app_build_gradle',
          name: 'build.gradle',
          type: 'file',
          parentId: 'app_folder',
          language: 'groovy',
          content: 'plugins {\n    id \'com.android.application\'\n}\n\nandroid {\n    compileSdk 34\n\n    defaultConfig {\n        applicationId "com.example.app"\n        minSdk 24\n        targetSdk 34\n        versionCode 1\n        versionName "1.0"\n    }\n\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n}\n\ndependencies {\n    implementation \'androidx.appcompat:appcompat:1.6.1\'\n    implementation \'com.google.android.material:material:1.10.0\'\n}\n'
        },
        build_gradle: {
          id: 'build_gradle',
          name: 'build.gradle',
          type: 'file',
          parentId: 'root',
          language: 'groovy',
          content: 'buildscript {\n    repositories {\n        google()\n        mavenCentral()\n    }\n    dependencies {\n        classpath \'com.android.tools.build:gradle:8.1.0\'\n    }\n}\n\nallprojects {\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\n'
        },
        settings_gradle: {
          id: 'settings_gradle',
          name: 'settings.gradle',
          type: 'file',
          parentId: 'root',
          language: 'groovy',
          content: 'rootProject.name = "AndroidApp"\ninclude \':app\'\n'
        },
        github_folder: {
          id: 'github_folder',
          name: '.github',
          type: 'folder',
          parentId: 'root',
          children: ['workflows_folder']
        },
        workflows_folder: {
          id: 'workflows_folder',
          name: 'workflows',
          type: 'folder',
          parentId: 'github_folder',
          children: ['build_yml']
        },
        build_yml: {
          id: 'build_yml',
          name: 'build.yml',
          type: 'file',
          parentId: 'workflows_folder',
          language: 'yaml',
          content: getWorkflowConfig('android')
        }
      };
    }

    case 'android-kotlin': {
      root.children = ['app_folder', 'build_gradle_kts', 'settings_gradle_kts', 'github_folder'];
      return {
        root,
        app_folder: {
          id: 'app_folder',
          name: 'app',
          type: 'folder',
          parentId: 'root',
          children: ['src_folder', 'app_build_gradle_kts'],
        },
        src_folder: {
          id: 'src_folder',
          name: 'src',
          type: 'folder',
          parentId: 'app_folder',
          children: ['main_folder'],
        },
        main_folder: {
          id: 'main_folder',
          name: 'main',
          type: 'folder',
          parentId: 'src_folder',
          children: ['java_folder', 'res_folder', 'android_manifest'],
        },
        java_folder: {
          id: 'java_folder',
          name: 'java',
          type: 'folder',
          parentId: 'main_folder',
          children: ['com_folder'],
        },
        com_folder: {
          id: 'com_folder',
          name: 'com',
          type: 'folder',
          parentId: 'java_folder',
          children: ['example_folder'],
        },
        example_folder: {
          id: 'example_folder',
          name: 'example',
          type: 'folder',
          parentId: 'com_folder',
          children: ['app_folder_src'],
        },
        app_folder_src: {
          id: 'app_folder_src',
          name: 'app',
          type: 'folder',
          parentId: 'example_folder',
          children: ['MainActivity_kt'],
        },
        MainActivity_kt: {
          id: 'MainActivity_kt',
          name: 'MainActivity.kt',
          type: 'file',
          parentId: 'app_folder_src',
          language: 'kotlin',
          content: 'package com.example.app\n\nimport android.os.Bundle\nimport androidx.appcompat.app.AppCompatActivity\n\nclass MainActivity : AppCompatActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        setContentView(R.layout.activity_main)\n    }\n}\n'
        },
        res_folder: {
          id: 'res_folder',
          name: 'res',
          type: 'folder',
          parentId: 'main_folder',
          children: ['layout_folder', 'values_folder'],
        },
        layout_folder: {
          id: 'layout_folder',
          name: 'layout',
          type: 'folder',
          parentId: 'res_folder',
          children: ['activity_main_xml'],
        },
        activity_main_xml: {
          id: 'activity_main_xml',
          name: 'activity_main.xml',
          type: 'file',
          parentId: 'layout_folder',
          language: 'xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"\n    android:layout_width="match_parent"\n    android:layout_height="match_parent"\n    android:gravity="center"\n    android:orientation="vertical">\n    <TextView\n        android:layout_width="wrap_content"\n        android:layout_height="wrap_content"\n        android:text="Hello Android from Kotlin!"\n        android:textSize="24sp" />\n</LinearLayout>\n'
        },
        values_folder: {
          id: 'values_folder',
          name: 'values',
          type: 'folder',
          parentId: 'res_folder',
          children: ['strings_xml'],
        },
        strings_xml: {
          id: 'strings_xml',
          name: 'strings.xml',
          type: 'file',
          parentId: 'values_folder',
          language: 'xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">Android Kotlin App</string>\n</resources>\n'
        },
        android_manifest: {
          id: 'android_manifest',
          name: 'AndroidManifest.xml',
          type: 'file',
          parentId: 'main_folder',
          language: 'xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    package="com.example.app">\n    <application\n        android:allowBackup="true"\n        android:icon="@mipmap/ic_launcher"\n        android:label="@string/app_name"\n        android:roundIcon="@mipmap/ic_launcher_round"\n        android:supportsRtl="true"\n        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">\n        <activity\n            android:name=".MainActivity"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n'
        },
        app_build_gradle_kts: {
          id: 'app_build_gradle_kts',
          name: 'build.gradle.kts',
          type: 'file',
          parentId: 'app_folder',
          language: 'groovy',
          content: 'plugins {\n    id("com.android.application")\n    id("org.jetbrains.kotlin.android")\n}\n\nandroid {\n    compileSdk = 34\n\n    defaultConfig {\n        applicationId = "com.example.app"\n        minSdk = 24\n        targetSdk = 34\n        versionCode = 1\n        versionName = "1.0"\n    }\n\n    buildTypes {\n        release {\n            isMinifyEnabled = false\n        }\n    }\n}\n\ndependencies {\n    implementation("androidx.core:core-ktx:1.12.0")\n    implementation("androidx.appcompat:appcompat:1.6.1")\n    implementation("com.google.android.material:material:1.10.0")\n}\n'
        },
        build_gradle_kts: {
          id: 'build_gradle_kts',
          name: 'build.gradle.kts',
          type: 'file',
          parentId: 'root',
          language: 'groovy',
          content: 'buildscript {\n    repositories {\n        google()\n        mavenCentral()\n    }\n    dependencies {\n        classpath("com.android.tools.build:gradle:8.1.0")\n        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.0")\n    }\n}\n\nallprojects {\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\n'
        },
        settings_gradle_kts: {
          id: 'settings_gradle_kts',
          name: 'settings.gradle.kts',
          type: 'file',
          parentId: 'root',
          language: 'groovy',
          content: 'rootProject.name = "AndroidApp"\ninclude(":app")\n'
        },
        github_folder: {
          id: 'github_folder',
          name: '.github',
          type: 'folder',
          parentId: 'root',
          children: ['workflows_folder']
        },
        workflows_folder: {
          id: 'workflows_folder',
          name: 'workflows',
          type: 'folder',
          parentId: 'github_folder',
          children: ['build_yml']
        },
        build_yml: {
          id: 'build_yml',
          name: 'build.yml',
          type: 'file',
          parentId: 'workflows_folder',
          language: 'yaml',
          content: getWorkflowConfig('android')
        }
      };
    }

    case 'android-compose': {
      // Compose template is similar to Kotlin but with compose dependencies
      root.children = ['app_folder', 'build_gradle_kts', 'settings_gradle_kts', 'github_folder'];
      return {
        root,
        app_folder: {
          id: 'app_folder',
          name: 'app',
          type: 'folder',
          parentId: 'root',
          children: ['src_folder', 'app_build_gradle_kts'],
        },
        src_folder: {
          id: 'src_folder',
          name: 'src',
          type: 'folder',
          parentId: 'app_folder',
          children: ['main_folder'],
        },
        main_folder: {
          id: 'main_folder',
          name: 'main',
          type: 'folder',
          parentId: 'src_folder',
          children: ['java_folder', 'res_folder', 'android_manifest'],
        },
        java_folder: {
          id: 'java_folder',
          name: 'java',
          type: 'folder',
          parentId: 'main_folder',
          children: ['com_folder'],
        },
        com_folder: {
          id: 'com_folder',
          name: 'com',
          type: 'folder',
          parentId: 'java_folder',
          children: ['example_folder'],
        },
        example_folder: {
          id: 'example_folder',
          name: 'example',
          type: 'folder',
          parentId: 'com_folder',
          children: ['app_folder_src'],
        },
        app_folder_src: {
          id: 'app_folder_src',
          name: 'app',
          type: 'folder',
          parentId: 'example_folder',
          children: ['MainActivity_kt'],
        },
        MainActivity_kt: {
          id: 'MainActivity_kt',
          name: 'MainActivity.kt',
          type: 'file',
          parentId: 'app_folder_src',
          language: 'kotlin',
          content: 'package com.example.app\n\nimport android.os.Bundle\nimport androidx.activity.ComponentActivity\nimport androidx.activity.compose.setContent\nimport androidx.compose.foundation.layout.fillMaxSize\nimport androidx.compose.material3.MaterialTheme\nimport androidx.compose.material3.Surface\nimport androidx.compose.material3.Text\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.Modifier\n\nclass MainActivity : ComponentActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        setContent {\n            MaterialTheme {\n                Surface(modifier = Modifier.fillMaxSize()) {\n                    Greeting("Android")\n                }\n            }\n        }\n    }\n}\n\n@Composable\nfun Greeting(name: String) {\n    Text(text = "Hello $name!")\n}\n'
        },
        res_folder: {
          id: 'res_folder',
          name: 'res',
          type: 'folder',
          parentId: 'main_folder',
          children: ['values_folder'],
        },
        values_folder: {
          id: 'values_folder',
          name: 'values',
          type: 'folder',
          parentId: 'res_folder',
          children: ['strings_xml'],
        },
        strings_xml: {
          id: 'strings_xml',
          name: 'strings.xml',
          type: 'file',
          parentId: 'values_folder',
          language: 'xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">Android Compose App</string>\n</resources>\n'
        },
        android_manifest: {
          id: 'android_manifest',
          name: 'AndroidManifest.xml',
          type: 'file',
          parentId: 'main_folder',
          language: 'xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    package="com.example.app">\n    <application\n        android:allowBackup="true"\n        android:icon="@mipmap/ic_launcher"\n        android:label="@string/app_name"\n        android:roundIcon="@mipmap/ic_launcher_round"\n        android:supportsRtl="true"\n        android:theme="@android:style/Theme.Material.Light.NoActionBar">\n        <activity\n            android:name=".MainActivity"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n'
        },
        app_build_gradle_kts: {
          id: 'app_build_gradle_kts',
          name: 'build.gradle.kts',
          type: 'file',
          parentId: 'app_folder',
          language: 'groovy',
          content: 'plugins {\n    id("com.android.application")\n    id("org.jetbrains.kotlin.android")\n}\n\nandroid {\n    compileSdk = 34\n\n    defaultConfig {\n        applicationId = "com.example.app"\n        minSdk = 24\n        targetSdk = 34\n        versionCode = 1\n        versionName = "1.0"\n    }\n\n    buildFeatures {\n        compose = true\n    }\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.0"\n    }\n    buildTypes {\n        release {\n            isMinifyEnabled = false\n        }\n    }\n}\n\ndependencies {\n    implementation("androidx.core:core-ktx:1.12.0")\n    implementation("androidx.activity:activity-compose:1.8.0")\n    implementation(platform("androidx.compose:compose-bom:2023.10.01"))\n    implementation("androidx.compose.ui:ui")\n    implementation("androidx.compose.material3:material3")\n}\n'
        },
        build_gradle_kts: {
          id: 'build_gradle_kts',
          name: 'build.gradle.kts',
          type: 'file',
          parentId: 'root',
          language: 'groovy',
          content: 'buildscript {\n    repositories {\n        google()\n        mavenCentral()\n    }\n    dependencies {\n        classpath("com.android.tools.build:gradle:8.1.0")\n        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.0")\n    }\n}\n\nallprojects {\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\n'
        },
        settings_gradle_kts: {
          id: 'settings_gradle_kts',
          name: 'settings.gradle.kts',
          type: 'file',
          parentId: 'root',
          language: 'groovy',
          content: 'rootProject.name = "ComposeApp"\ninclude(":app")\n'
        },
        github_folder: {
          id: 'github_folder',
          name: '.github',
          type: 'folder',
          parentId: 'root',
          children: ['workflows_folder']
        },
        workflows_folder: {
          id: 'workflows_folder',
          name: 'workflows',
          type: 'folder',
          parentId: 'github_folder',
          children: ['build_yml']
        },
        build_yml: {
          id: 'build_yml',
          name: 'build.yml',
          type: 'file',
          parentId: 'workflows_folder',
          language: 'yaml',
          content: getWorkflowConfig('android')
        }
      };
    }

    case 'rust-cli': {
      root.children = ['src_folder', 'cargo_toml'];
      return {
        root,
        src_folder: {
          id: 'src_folder',
          name: 'src',
          type: 'folder',
          parentId: 'root',
          children: ['main_rs'],
        },
        main_rs: {
          id: 'main_rs',
          name: 'main.rs',
          type: 'file',
          parentId: 'src_folder',
          language: 'rust',
          content: 'fn main() {\n    println!("Hello, Rust from Krypton IDE!");\n}\n'
        },
        cargo_toml: {
          id: 'cargo_toml',
          name: 'Cargo.toml',
          type: 'file',
          parentId: 'root',
          language: 'toml',
          content: '[package]\nname = "rust_cli"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n'
        }
      };
    }

    case 'java-cli': {
      root.children = ['Main_java'];
      return {
        root,
        Main_java: {
          id: 'Main_java',
          name: 'Main.java',
          type: 'file',
          parentId: 'root',
          language: 'java',
          content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello Java!");\n    }\n}\n'
        }
      };
    }

    case 'kotlin-cli': {
      root.children = ['main_kt'];
      return {
        root,
        main_kt: {
          id: 'main_kt',
          name: 'main.kt',
          type: 'file',
          parentId: 'root',
          language: 'kotlin',
          content: 'fun main() {\n    println("Hello Kotlin!")\n}\n'
        }
      };
    }

    case 'blank':
    default: {
      return { root };
    }
  }
}
