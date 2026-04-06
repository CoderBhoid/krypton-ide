// Multi-language code execution
// - JavaScript: runs in sandboxed iframe (no API needed)
// - Python: Pyodide WebAssembly (no API needed, loaded from CDN)
// - Other languages: Piston API with fallback endpoints

export interface ExecutionResult {
  success: boolean;
  output: string;
  stderr: string;
  exitCode: number | null;
  language: string;
  version: string;
}

// Piston API fallback endpoints
const PISTON_ENDPOINTS = [
  'https://emkc.org/api/v2/piston',
  'https://piston.e68.me/api/v2',
];

const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  'python': { language: 'python', version: '3.10.0' },
  'javascript': { language: 'javascript', version: '18.15.0' },
  'typescript': { language: 'typescript', version: '5.0.3' },
  'java': { language: 'java', version: '15.0.2' },
  'cpp': { language: 'c++', version: '10.2.0' },
  'c': { language: 'c', version: '10.2.0' },
  'go': { language: 'go', version: '1.16.2' },
  'rust': { language: 'rust', version: '1.68.2' },
  'ruby': { language: 'ruby', version: '3.0.1' },
  'php': { language: 'php', version: '8.2.3' },
  'swift': { language: 'swift', version: '5.3.3' },
  'kotlin': { language: 'kotlin', version: '1.9.21' },
  'dart': { language: 'dart', version: '2.19.6' },
  'shell': { language: 'bash', version: '5.2.0' },
  'lua': { language: 'lua', version: '5.4.4' },
  'perl': { language: 'perl', version: '5.36.0' },
  'r': { language: 'r', version: '4.1.1' },
};

export function canExecuteLanguage(language: string): boolean {
  return language in LANGUAGE_MAP || language === 'html';
}

export function getExecutableLanguages(): string[] {
  return ['html', ...Object.keys(LANGUAGE_MAP)];
}

// ─── JavaScript: Execute in sandboxed iframe ───
function executeJavaScript(code: string): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const outputs: string[] = [];
    const errors: string[] = [];

    const html = `<!DOCTYPE html><html><head><script>
      const __outputs = [];
      const __errors = [];
      const origLog = console.log;
      const origError = console.error;
      const origWarn = console.warn;
      console.log = (...args) => __outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      console.error = (...args) => __errors.push(args.map(a => String(a)).join(' '));
      console.warn = (...args) => __outputs.push('[warn] ' + args.map(a => String(a)).join(' '));
      
      window.addEventListener('error', (e) => __errors.push(e.message));
      
      try {
        ${code}
      } catch(e) {
        __errors.push(String(e));
      }
      
      parent.postMessage({ type: 'exec-result', outputs: __outputs, errors: __errors }, '*');
    </script></head><body></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.add('allow-scripts');
    
    const timeout = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        output: outputs.join('\n'),
        stderr: 'Execution timed out (5s limit)',
        exitCode: 1,
        language: 'javascript',
        version: 'Browser',
      });
    }, 5000);

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'exec-result') {
        cleanup();
        const out = event.data.outputs || [];
        const err = event.data.errors || [];
        resolve({
          success: err.length === 0,
          output: out.join('\n'),
          stderr: err.join('\n'),
          exitCode: err.length === 0 ? 0 : 1,
          language: 'javascript',
          version: 'Browser ES2022',
        });
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      iframe.remove();
      URL.revokeObjectURL(url);
    };

    window.addEventListener('message', handler);
    document.body.appendChild(iframe);
    iframe.src = url;
  });
}

// ─── Python: Pyodide WebAssembly ───
let pyodidePromise: Promise<any> | null = null;

function loadPyodide(): Promise<any> {
  if (pyodidePromise) return pyodidePromise;
  
  pyodidePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
    script.onload = async () => {
      try {
        const pyodide = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
        });
        resolve(pyodide);
      } catch (err) {
        pyodidePromise = null;
        reject(err);
      }
    };
    script.onerror = () => {
      pyodidePromise = null;
      reject(new Error('Failed to load Pyodide from CDN'));
    };
    document.head.appendChild(script);
  });

  return pyodidePromise;
}

async function executePython(code: string): Promise<ExecutionResult> {
  try {
    const pyodide = await loadPyodide();
    
    // Capture stdout/stderr
    pyodide.runPython(`
import sys, io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
    `);

    try {
      pyodide.runPython(code);
    } catch (err: any) {
      const stderr = pyodide.runPython('sys.stderr.getvalue()') || '';
      return {
        success: false,
        output: pyodide.runPython('sys.stdout.getvalue()') || '',
        stderr: stderr || String(err),
        exitCode: 1,
        language: 'python',
        version: 'Pyodide 0.24.1 (CPython 3.11)',
      };
    }

    const stdout = pyodide.runPython('sys.stdout.getvalue()') || '';
    const stderr = pyodide.runPython('sys.stderr.getvalue()') || '';

    return {
      success: !stderr,
      output: stdout,
      stderr: stderr,
      exitCode: stderr ? 1 : 0,
      language: 'python',
      version: 'Pyodide 0.24.1 (CPython 3.11)',
    };
  } catch (err: any) {
    return {
      success: false,
      output: '',
      stderr: `Failed to initialize Python runtime: ${err.message}\n\nPyodide (WebAssembly Python) is being loaded from CDN. Please check your internet connection.`,
      exitCode: 1,
      language: 'python',
      version: '',
    };
  }
}

// ─── Kotlin/Java: Official Kotlin Playground API ───
// This is the "Industry Standard" for browser-based Kotlin execution.
async function executeKotlinPlayground(code: string, target: 'java' | 'js' | 'wasm' = 'java'): Promise<ExecutionResult> {
  const KOTLIN_VERSION = '2.1.0'; // Using a stable version
  
  try {
    // JVM uses 'run', while JS/WASM uses 'translate'
    const isTranslation = target === 'js' || target === 'wasm';
    const endpoint = isTranslation 
      ? `https://api.kotlinlang.org/api/${KOTLIN_VERSION}/compiler/translate?ir=true${target === 'wasm' ? '&compiler=wasm' : ''}`
      : `https://api.kotlinlang.org/api/${KOTLIN_VERSION}/compiler/run`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'https://play.kotlinlang.org',
        'Referer': 'https://play.kotlinlang.org/'
      },
      body: JSON.stringify({
        args: "",
        files: [{ name: "File.kt", text: code, publicId: "" }],
        confType: target, // java = JVM, js = JavaScript, wasm = WebAssembly
      }),
    });

    if (!response.ok) {
      throw new Error(`Kotlin Engine [${target.toUpperCase()}] returned ${response.status}`);
    }

    const data = await response.json();
    
    // Kotlin playground returns errors in a specific field
    const errors = data.errors?.["File.kt"] || [];
    const compilerStderr = errors
      .map((err: any) => `${err.severity}: ${err.message} (${err.interval.start.line}, ${err.interval.start.ch})`)
      .join('\n');

    let output = '';
    if (isTranslation) {
      output = data.jsCode ? `Translation successful. Code ready for execution in browser.` : '';
    } else {
      // Standard JVM output is in the 'text' field
      output = data.text || '';
    }

    const isSuccess = !compilerStderr && !data.exception;

    return {
      success: isSuccess,
      output: output,
      stderr: compilerStderr || (data.exception ? data.exception.message : ''),
      exitCode: isSuccess ? 0 : 1,
      language: 'kotlin',
      version: `Kotlin ${KOTLIN_VERSION} (${target.toUpperCase()})`,
    };
  } catch (err: any) {
    console.error("Kotlin Playground API error", err);
    throw new Error(`Could not connect to Kotlin Engine: ${err.message}`);
  }
}

// ─── Other languages: Piston API with fallbacks ───
async function executePistonAPI(code: string, language: string, filename?: string): Promise<ExecutionResult> {
  const mapping = LANGUAGE_MAP[language];
  
  if (!mapping) {
    return {
      success: false,
      output: '',
      stderr: `Language "${language}" is not supported for execution.\nSupported: ${Object.keys(LANGUAGE_MAP).join(', ')}`,
      exitCode: 1,
      language,
      version: '',
    };
  }

  const body = JSON.stringify({
    language: mapping.language,
    version: mapping.version,
    files: [{
      name: filename || getDefaultFilename(language),
      content: code,
    }],
    stdin: '',
    args: [],
    compile_timeout: 10000,
    run_timeout: 10000,
  });

  const errors: string[] = [];

  // Try each endpoint
  for (const baseUrl of PISTON_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        errors.push(`Endpoint [${baseUrl}] returned ${response.status}: ${errText}`);
        continue;
      }

      const data = await response.json();
      const run = data.run || {};
      const compile = data.compile || {};

      if (compile.code !== undefined && compile.code !== 0 && compile.stderr) {
        return {
          success: false,
          output: compile.output || '',
          stderr: compile.stderr,
          exitCode: compile.code,
          language: data.language || language,
          version: data.version || mapping.version,
        };
      }

      return {
        success: run.code === 0,
        output: run.output || '',
        stderr: run.stderr || '',
        exitCode: run.code ?? null,
        language: data.language || language,
        version: data.version || mapping.version,
      };
    } catch (err: any) {
      console.error(`Piston execution failed for endpoint ${baseUrl}:`, err);
      errors.push(`Endpoint [${baseUrl}] error: ${err.message || String(err)}`);
    }
  }

  // If all endpoints fail
  return {
    success: false,
    output: '',
    stderr: `Could not connect to code execution servers.\n\nDetails:\n${errors.join('\n')}\n\nFor Python and JavaScript, Krypton IDE runs code directly in your browser. For other languages (${language}), a stable internet connection and access to emkc.org is required.`,
    exitCode: 1,
    language,
    version: '',
  };
}

// ─── Main entry point ───
export async function executeCode(language: string, code: string, filename?: string, target?: string): Promise<ExecutionResult> {
  if (language === 'html') {
    return { success: true, output: 'HTML content previewed in Live Preview.', stderr: '', exitCode: 0, language: 'html', version: '' };
  }
  
  if (language === 'javascript') {
    return executeJavaScript(code);
  }
  
  if (language === 'python') {
    return executePython(code);
  }

  if (language === 'kotlin' || language === 'java') {
    try {
      // Use provided target (jvm/wasm/js) or default to java (JVM)
      const ktTarget = (target === 'wasm' || target === 'js') ? target : 'java';
      return await executeKotlinPlayground(code, ktTarget);
    } catch (err: any) {
      // For Kotlin/Java, we no longer fallback to Piston as it's whitelist-only
      // Instead, we return a clear error about the playground connection
      return {
        success: false,
        output: '',
        stderr: `Kotlin Execution Error: ${err.message}\n\nPlease check your internet connection or the Kotlin Playground status.`,
        exitCode: 1,
        language: 'kotlin',
        version: '',
      };
    }
  }
  
  return executePistonAPI(code, language, filename);
}

function getDefaultFilename(language: string): string {
  const map: Record<string, string> = {
    'python': 'main.py',
    'javascript': 'index.js',
    'typescript': 'index.ts',
    'java': 'Main.java',
    'cpp': 'main.cpp',
    'c': 'main.c',
    'go': 'main.go',
    'rust': 'main.rs',
    'ruby': 'main.rb',
    'php': 'index.php',
    'swift': 'main.swift',
    'kotlin': 'main.kt',
    'dart': 'main.dart',
    'shell': 'script.sh',
    'lua': 'main.lua',
    'perl': 'main.pl',
    'r': 'main.r',
  };
  return map[language] || 'main.txt';
}
