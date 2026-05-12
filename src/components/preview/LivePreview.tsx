import React, { useMemo, useState, useEffect } from 'react';
import { X, RefreshCw, ExternalLink, Loader2, CheckCircle2, XCircle, Terminal as TerminalIcon, Package, Wifi, WifiOff, AlertTriangle, TerminalSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useIdeStore } from '../../store/useIdeStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { executeCode, canExecuteLanguage } from '../../lib/codeRunner';
import type { ExecutionResult } from '../../lib/codeRunner';

interface LivePreviewProps {
  onClose: () => void;
}

export function LivePreview({ onClose }: LivePreviewProps) {
  const { files, activeFileId } = useIdeStore();
  const { currentProjectId, projects } = useProjectsStore();
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<{ type: string; args: string }[]>([]);
  const [showInternetWarning, setShowInternetWarning] = useState(false);
  const [internetWarningAccepted, setInternetWarningAccepted] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [unreadLogs, setUnreadLogs] = useState(0);
  
  const project = currentProjectId ? projects[currentProjectId] : null;

  // Listen for console messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'krypton-console') {
        setConsoleLogs(prev => [...prev.slice(-200), { type: e.data.level, args: e.data.args }]);
        setUnreadLogs(prev => prev + 1);
        // Also dispatch to bottom panel terminal
        window.dispatchEvent(new CustomEvent('krypton-console-log', { detail: e.data }));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (showConsole) setUnreadLogs(0);
  }, [showConsole]);

  const activeFile = activeFileId ? files[activeFileId] : null;

  // Determine project type
  const hasHtmlFile = Object.values(files).some(
    f => f.type === 'file' && f.name.toLowerCase() === 'index.html'
  );
  
  const jsxFiles = Object.values(files).filter(
    f => f.type === 'file' && (f.name.endsWith('.jsx') || f.name.endsWith('.tsx'))
  );

  // Also gather .js files that contain JSX syntax (e.g. Next.js page.js files)
  const jsFilesWithJsx = Object.values(files).filter(
    f => f.type === 'file' && f.name.endsWith('.js') && f.content && 
    (f.content.includes('<div') || f.content.includes('<main') || f.content.includes('<h1') || f.content.includes('React.createElement') || f.content.includes('return ('))
  );

  const allReactFiles = [...jsxFiles, ...jsFilesWithJsx];

  // Detect Vite/Next.js projects: they have index.html with <script type="module"> which can't work in blob URLs
  const isViteOrModuleProject = useMemo(() => {
    if (!hasHtmlFile) return false;
    const htmlFile = Object.values(files).find(f => f.type === 'file' && f.name.toLowerCase() === 'index.html');
    if (!htmlFile?.content) return false;
    // Check if the HTML references module scripts that point to source files (e.g. /src/main.jsx)
    return /type=["']module["']/.test(htmlFile.content) && /src=["']\/?(src\/|\.\/src)/.test(htmlFile.content);
  }, [files, hasHtmlFile]);

  // React project = has JSX/React content AND (no HTML file OR is a Vite/module project OR is Next.js)
  // Detect Next.js: has page.js/tsx
  const isNextProject = useMemo(() => {
    return Object.values(files).some(f => f.type === 'file' && (f.name === 'page.js' || f.name === 'page.tsx' || f.name === 'page.jsx'));
  }, [files]);

  const hasReactProject = ((!hasHtmlFile || isViteOrModuleProject || isNextProject) && allReactFiles.length > 0 && allReactFiles.some(
    f => f.content?.includes('React') || f.content?.includes('react') || f.content?.includes('jsx') || f.content?.includes('useState') || f.content?.includes('export default function')
  ));

  // Detect package.json and parse dependencies for importmap generation
  const packageJsonDeps = useMemo(() => {
    const pkgFile = Object.values(files).find(
      f => f.type === 'file' && f.name === 'package.json'
    );
    if (!pkgFile?.content) return null;

    try {
      const pkg = JSON.parse(pkgFile.content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      // Filter out non-CDN-resolvable deps (local paths, workspaces)
      const filtered: Record<string, string> = {};
      for (const [name, version] of Object.entries(deps)) {
        if (typeof version === 'string' && !version.startsWith('file:') && !version.startsWith('link:') && !version.startsWith('workspace:')) {
          filtered[name] = version as string;
        }
      }
      return Object.keys(filtered).length > 0 ? filtered : null;
    } catch {
      return null;
    }
  }, [files]);

  // Build esm.sh importmap from package.json dependencies
  const importMapScript = useMemo(() => {
    if (!packageJsonDeps) return '';

    const imports: Record<string, string> = {};
    for (const [name, version] of Object.entries(packageJsonDeps)) {
      // Clean version string (remove ^, ~, >= etc.)
      const cleanVer = (version as string).replace(/^[\^~>=<]+/, '');
      imports[name] = `https://esm.sh/${name}@${cleanVer}`;
      // Also add subpath imports (e.g., react-dom/client)
      imports[`${name}/`] = `https://esm.sh/${name}@${cleanVer}/`;
    }

    return `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n<\/script>`;
  }, [packageJsonDeps]);

  const hasCdnDependencies = !!packageJsonDeps && Object.keys(packageJsonDeps).length > 0;

  const isMarkdownPreview = activeFile?.type === 'file' && (activeFile.name.endsWith('.md') || activeFile.language === 'markdown');

  const isSvgPreview = activeFile?.type === 'file' && activeFile.name.endsWith('.svg');
  
  const isAndroidCode = useMemo(() => {
    if (!activeFile?.content) return false;
    return activeFile.content.includes('import android.') || 
           activeFile.content.includes('import androidx.') ||
           project?.template?.startsWith('android-');
  }, [activeFile?.content, project?.template]);

  const isCodeExecution = !hasHtmlFile && !hasReactProject && !isNextProject && !isMarkdownPreview && !isSvgPreview && activeFile?.type === 'file' && activeFile.language && activeFile.language !== 'html' && activeFile.language !== 'xml' && !isAndroidCode;

  // For HTML projects, build the preview
  const previewSrc = useMemo(() => {
    if (!hasHtmlFile) return null;

    const htmlFile = Object.values(files).find(
      f => f.type === 'file' && f.name.toLowerCase() === 'index.html'
    );

    if (!htmlFile?.content) return null;

    let html = htmlFile.content;

    // Inline CSS files
    const cssFiles = Object.values(files).filter(
      f => f.type === 'file' && f.name.endsWith('.css')
    );
    for (const cssFile of cssFiles) {
      if (cssFile.content) {
        const linkPattern = new RegExp(
          `<link[^>]*href=["']${escapeRegex(cssFile.name)}["'][^>]*>`, 'gi'
        );
        html = html.replace(linkPattern, `<style>\n${cssFile.content}\n</style>`);
      }
    }

    // Inline JS files
    const jsFiles = Object.values(files).filter(
      f => f.type === 'file' && (f.name.endsWith('.js') || f.name.endsWith('.jsx'))
    );
    for (const jsFile of jsFiles) {
      if (jsFile.content) {
        const babelPattern = new RegExp(
          `<script[^>]*type=["']text/babel["'][^>]*src=["']${escapeRegex(jsFile.name)}["'][^>]*>\s*</script>`, 'gi'
        );
        const scriptPattern = new RegExp(
          `<script[^>]*src=["']${escapeRegex(jsFile.name)}["'][^>]*>\s*</script>`, 'gi'
        );
        
        if (babelPattern.test(html)) {
          html = html.replace(babelPattern, `<script type="text/babel">\n${jsFile.content}\n</script>`);
        } else {
          html = html.replace(scriptPattern, `<script>\n${jsFile.content}\n</script>`);
        }
      }
    }

    // Inject console capture bridge
    const consoleCapture = `<script>
(function(){
  var _log=console.log,_warn=console.warn,_error=console.error,_info=console.info;
  function send(level,args){
    try{parent.postMessage({type:'krypton-console',level:level,args:Array.from(args).map(function(a){try{return typeof a==='object'?JSON.stringify(a):String(a)}catch(e){return String(a)}}).join(' ')},'*')}catch(e){}
  }
  console.log=function(){send('log',arguments);_log.apply(console,arguments)};
  console.warn=function(){send('warn',arguments);_warn.apply(console,arguments)};
  console.error=function(){send('error',arguments);_error.apply(console,arguments)};
  console.info=function(){send('info',arguments);_info.apply(console,arguments)};
  window.onerror=function(m,s,l,c,e){send('error',[m+' at '+s+':'+l+':'+c])};
})();
</script>`;
    html = html.replace('</head>', consoleCapture + '\n</head>');

    // Inject importmap for CDN dependencies if package.json exists
    if (importMapScript) {
      html = html.replace('<head>', '<head>\n' + importMapScript);
    }

    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [files, hasHtmlFile, importMapScript]);

  // For code execution, run on mount
  useEffect(() => {
    if (isCodeExecution && activeFile?.content && activeFile.language) {
      runCode();
    }
  }, []);

  const runCode = async () => {
    if (!activeFile?.content || !activeFile.language) return;
    
    setIsExecuting(true);
    setExecutionResult(null);
    
    const result = await executeCode(activeFile.language, activeFile.content, activeFile.name);
    setExecutionResult(result);
    setIsExecuting(false);
  };

  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    if (isCodeExecution) {
      runCode();
    } else {
      setRefreshKey(k => k + 1);
    }
  };

  // Build React project preview
  const reactPreviewSrc = useMemo(() => {
    if (!hasReactProject) return null;

    // Gather all CSS files
    const allCss = Object.values(files)
      .filter(f => f.type === 'file' && f.name.endsWith('.css') && f.content)
      .map(f => f.content)
      .join('\n');

    // Find main entry: App.jsx/tsx first, then page.js for Next.js, then first file
    const appFile = allReactFiles.find(f => f.name.toLowerCase().startsWith('app.')) 
      || allReactFiles.find(f => f.name.toLowerCase() === 'page.js' || f.name.toLowerCase() === 'page.jsx' || f.name.toLowerCase() === 'page.tsx')
      || allReactFiles[0];
    if (!appFile?.content) return null;

    // Collect all component files (non-App files first, then App last)
    const otherFiles = allReactFiles.filter(f => f.id !== appFile.id);
    
    // Process user code: strip import/export since React/ReactDOM are UMD globals
    const processCode = (code: string) => {
      return code
        .replace(/^\s*import\s+.*?from\s+['"]react['"].*?;?\s*$/gm, '')
        .replace(/^\s*import\s+.*?from\s+['"]react-dom['"].*?;?\s*$/gm, '')
        .replace(/^\s*import\s+.*?from\s+['"]react-dom\/client['"].*?;?\s*$/gm, '')
        .replace(/^\s*import\s+.*?from\s+['"]react\/jsx-runtime['"].*?;?\s*$/gm, '')
        // Strip Next.js-specific imports
        .replace(/^\s*import\s+.*?from\s+['"]next\/.*?['"].*?;?\s*$/gm, '// (next import stripped)')
        .replace(/^\s*import\s+(\w+)\s+from\s+['"]\.\/.*?['"].*?;?\s*$/gm, '// (resolved: $1)')
        .replace(/^\s*import\s+\{([^}]+)\}\s+from\s+['"]\.\/.*?['"].*?;?\s*$/gm, '// (resolved: {$1})')
        .replace(/^\s*import\s+['"]\.\/.*?\.css['"].*?;?\s*$/gm, '// (css imported via style tag)')
        // Strip Next.js metadata export
        .replace(/^\s*export\s+const\s+metadata\s*=\s*\{[\s\S]*?\};?\s*$/gm, '// (metadata stripped)')
        .replace(/^\s*export\s+default\s+function\s+/gm, 'function ')
        .replace(/^\s*export\s+default\s+class\s+/gm, 'class ')
        .replace(/^\s*export\s+default\s+(\w+)\s*;?\s*$/gm, '// (default: $1)')
        .replace(/^\s*export\s+function\s+/gm, 'function ')
        .replace(/^\s*export\s+const\s+/gm, 'const ')
        .replace(/^\s*export\s+class\s+/gm, 'class ')
        .replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, '');
    };

    // Build component scripts (other files loaded first)
    const componentBlocks = otherFiles
      .filter(f => f.content)
      .map(f => {
        const processed = processCode(f.content!);
        return '<script type="text/babel" data-presets="react">\n// === ' + f.name + ' ===\n' + processed + '\n<\/script>';
      })
      .join('\n');
    
    const processedAppCode = processCode(appFile.content);

    // Detect the main component name
    const componentMatch = appFile.content.match(/(?:export\s+default\s+)?(?:function|class)\s+(\w+)/);
    const mainComponent = componentMatch?.[1] || 'App';

    // Gather SVG files for inline use
    const svgFiles = Object.values(files)
      .filter(f => f.type === 'file' && f.name.endsWith('.svg') && f.content);

    const svgDefs = svgFiles.map(f => {
      const varName = f.name.replace(/\.svg$/, '').replace(/[^a-zA-Z0-9]/g, '_');
      const svgContent = (f.content || '').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      return 'window.__SVG_' + varName + ' = `' + svgContent + '`;';
    }).join('\n');

    // If we have package.json deps, use specific React versions from esm.sh
    const reactVersion = packageJsonDeps?.['react']?.replace(/^[\^~>=<]+/, '') || '18';
    const reactDomVersion = packageJsonDeps?.['react-dom']?.replace(/^[\^~>=<]+/, '') || reactVersion;

    const html = '<!DOCTYPE html>\n<html>\n<head>\n' +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body { font-family: system-ui, -apple-system, sans-serif; }\n    ' + allCss + '\n  </style>\n' +
      '  <script src="https://unpkg.com/react@' + reactVersion + '/umd/react.development.js" crossorigin><\/script>\n' +
      '  <script src="https://unpkg.com/react-dom@' + reactDomVersion + '/umd/react-dom.development.js" crossorigin><\/script>\n' +
      '  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>\n' +
      (importMapScript ? '  ' + importMapScript + '\n' : '') +
      '</head>\n<body>\n  <div id="root"></div>\n\n' +
      '  <script>\n' +
      '    var { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext, Fragment } = React;\n' +
      '    ' + svgDefs + '\n' +
      '    window.addEventListener("error", function(e) {\n' +
      '      var r = document.getElementById("root");\n' +
      '      if (r) r.innerHTML = \'<div style="padding:20px;color:#ff6b6b;font-family:monospace;white-space:pre-wrap;background:#1a1a2e;min-height:100vh;"><h3 style="color:#ff6b6b;margin-bottom:12px;">Error</h3><pre style="color:#ffa0a0;font-size:13px;">\' + e.message + \'</pre></div>\';\n' +
      '    });\n' +
      '    window.addEventListener("unhandledrejection", function(e) { console.error("Promise rejection:", e.reason); });\n' +
      '  <\/script>\n\n' +
      componentBlocks + '\n\n' +
      '  <script type="text/babel" data-presets="react">\n' +
      '    // === ' + appFile.name + ' (entry) ===\n' +
      '    ' + processedAppCode + '\n\n' +
      '    try {\n' +
      '      var _rootEl = document.getElementById("root");\n' +
      '      if (!_rootEl._reactRoot) { _rootEl._reactRoot = ReactDOM.createRoot(_rootEl); }\n' +
      '      var _root = _rootEl._reactRoot;\n' +
      '      if (typeof ' + mainComponent + ' === "function" || typeof ' + mainComponent + ' === "object") {\n' +
      '        _root.render(React.createElement(' + mainComponent + '));\n' +
      '      } else if (typeof App === "function" || typeof App === "object") {\n' +
      '        _root.render(React.createElement(App));\n' +
      '      } else {\n' +
      '        _rootEl.innerHTML = \'<div style="padding:40px;text-align:center;color:#888;"><h3>No component found</h3><p style="margin-top:8px;font-size:14px;">Define a function App() in your code.</p></div>\';\n' +
      '      }\n' +
      '    } catch(err) {\n' +
      '      document.getElementById("root").innerHTML = \'<div style="padding:20px;color:#ff6b6b;font-family:monospace;white-space:pre-wrap;background:#1a1a2e;min-height:100vh;"><h3>Mount Error</h3>\' + err.message + \'</div>\';\n' +
      '    }\n' +
      '  <\/script>\n' +
      '</body>\n</html>';

    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [files, hasReactProject, refreshKey, importMapScript, packageJsonDeps]);

  // Build Markdown preview 
  const markdownPreviewSrc = useMemo(() => {
    if (!isMarkdownPreview || !activeFile?.content) return null;
    
    // Use a simple inline HTML renderer for md
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body { margin:0; padding:24px; background:#0d1117; color:#c9d1d9; font-family:'Inter',system-ui,sans-serif; font-size:15px; line-height:1.7; }
    h1,h2,h3,h4,h5,h6 { color:#f0f6fc; margin:1.2em 0 0.5em; }
    h1 { font-size:2em; border-bottom:1px solid #21262d; padding-bottom:.3em; }
    h2 { font-size:1.5em; border-bottom:1px solid #21262d; padding-bottom:.3em; }
    a { color:#58a6ff; text-decoration:none; }
    a:hover { text-decoration:underline; }
    code { background:#161b22; border:1px solid #30363d; border-radius:6px; padding:.15em .4em; font-family:'JetBrains Mono',monospace; font-size:.88em; }
    pre { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:16px; overflow-x:auto; }
    pre code { background:transparent; border:none; padding:0; }
    blockquote { border-left:4px solid #3b82f6; padding:.5em 1em; margin:1em 0; color:#8b949e; background:#161b22; border-radius:0 8px 8px 0; }
    table { width:100%; border-collapse:collapse; margin:1em 0; }
    th { background:#161b22; font-weight:600; color:#f0f6fc; text-align:left; padding:8px 12px; border:1px solid #30363d; }
    td { padding:8px 12px; border:1px solid #30363d; }
    img { max-width:100%; border-radius:8px; }
    hr { border:none; border-top:1px solid #21262d; margin:2em 0; }
    ul,ol { padding-left:2em; }
    strong { color:#f0f6fc; }
    #content { max-width:720px; margin:0 auto; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script>
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(activeFile.content)});
  </script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [isMarkdownPreview, activeFile?.content, refreshKey]);

  // ─── Internet Warning Dialog ───
  if (hasCdnDependencies && !internetWarningAccepted && (hasReactProject || hasHtmlFile)) {
    if (!showInternetWarning) {
      // Auto-show the warning
      return (
        <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col animate-fade-in">
          <PreviewHeader onClose={onClose} onRefresh={handleRefresh} isCodeMode={false} fileName="Preview" />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-[#161b22] border border-amber-500/30 rounded-3xl p-8 text-center shadow-2xl shadow-amber-500/10">
              <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                <Wifi size={40} className="text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Internet Required</h3>
              <p className="text-gray-400 mb-4 leading-relaxed text-sm">
                This project has a <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">package.json</code> with 
                <span className="text-amber-400 font-semibold"> {Object.keys(packageJsonDeps!).length} dependencies</span> that 
                will be loaded from the internet via <span className="text-emerald-400 font-mono text-xs">esm.sh</span> CDN.
              </p>
              <div className="bg-black/30 rounded-xl p-3 mb-6 border border-[#30363d] text-left">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Dependencies</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(packageJsonDeps!).slice(0, 12).map(([name, ver]) => (
                    <span key={name} className="text-[10px] font-mono px-2 py-1 bg-blue-500/10 text-blue-300 rounded-md border border-blue-500/20">
                      {name}@{(ver as string).replace(/^[\^~>=<]+/, '')}
                    </span>
                  ))}
                  {Object.keys(packageJsonDeps!).length > 12 && (
                    <span className="text-[10px] text-gray-500 px-2 py-1">+{Object.keys(packageJsonDeps!).length - 12} more</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-6">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-300/80 text-left">
                  Preview won't work without an active internet connection. First load may be slow.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={onClose}
                  className="flex-1 bg-[#21262d] hover:bg-[#30363d] text-gray-300 py-3 rounded-xl font-semibold transition-all text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setInternetWarningAccepted(true)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/30 active:scale-95 text-sm"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // ─── React Project Preview ───
  if (hasReactProject && reactPreviewSrc) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
        <PreviewHeader onClose={onClose} onRefresh={handleRefresh} isCodeMode={false} fileName="React App" previewUrl={reactPreviewSrc} showConsole={showConsole} onToggleConsole={() => setShowConsole(!showConsole)} unreadLogs={unreadLogs} />
        <div className="flex-1 bg-white relative">
          <iframe
            key={refreshKey}
            src={reactPreviewSrc}
            title="React Preview"
            sandbox="allow-scripts allow-modals allow-forms"
            className="w-full h-full border-none"
          />
          <ConsoleOverlay logs={consoleLogs} isOpen={showConsole} />
        </div>
      </div>
    );
  }

  // ─── Markdown Preview ───
  if (isMarkdownPreview && markdownPreviewSrc) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col animate-fade-in">
        <PreviewHeader onClose={onClose} onRefresh={handleRefresh} isCodeMode={false} fileName={activeFile?.name} previewUrl={markdownPreviewSrc} />
        <div className="flex-1 relative">
          <iframe
            key={refreshKey}
            src={markdownPreviewSrc}
            title="Markdown Preview"
            sandbox="allow-scripts"
            className="w-full h-full border-none"
          />
        </div>
      </div>
    );
  }

  // ─── SVG Preview ───
  if (isSvgPreview && activeFile?.content) {
    const svgHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1117;} svg{max-width:90vw;max-height:90vh;}</style></head><body>${activeFile.content}</body></html>`;
    const svgBlob = new Blob([svgHtml], { type: 'text/html' });
    const svgUrl = URL.createObjectURL(svgBlob);
    return (
      <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col animate-fade-in">
        <PreviewHeader onClose={onClose} onRefresh={handleRefresh} isCodeMode={false} fileName={activeFile.name} previewUrl={svgUrl} />
        <div className="flex-1 relative">
          <iframe
            key={refreshKey}
            src={svgUrl}
            title="SVG Preview"
            sandbox="allow-scripts"
            className="w-full h-full border-none"
          />
        </div>
      </div>
    );
  }

  // ─── Android Code View (Specific Error/Guide) ───
  if (isAndroidCode) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col animate-fade-in">
        <PreviewHeader onClose={onClose} onRefresh={handleRefresh} isCodeMode={true} fileName={activeFile?.name} language={activeFile?.language} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-[#161b22] border border-[#21262d] rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <Package size={40} className="text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Android Build Required</h3>
            <p className="text-gray-400 mb-8 leading-relaxed">
              This file contains Android-specific libraries (UI components, Activities) that cannot be run as a console script.
            </p>
            
            <div className="space-y-4 text-left mb-8 bg-black/30 rounded-2xl p-4 border border-[#30363d]">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                  <span className="text-[10px] text-blue-400 font-bold">1</span>
                </div>
                <p className="text-xs text-gray-300">Open the <span className="text-blue-400 font-semibold">Build APK</span> tab in the bottom panel</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                  <span className="text-[10px] text-blue-400 font-bold">2</span>
                </div>
                <p className="text-xs text-gray-300">Push your changes to trigger the Android pipeline</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                  <span className="text-[10px] text-blue-400 font-bold">3</span>
                </div>
                <p className="text-xs text-gray-300">Download and install the APK on your device</p>
              </div>
            </div>

            <button 
              onClick={() => {
                onClose();
                // We'll rely on the user manually switching, as we don't have a direct dispatch for TopBar -> BottomPanel tabs here easily yet
                // but this message provides the clear path forward.
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If it's neither HTML nor executable code
  if (!hasHtmlFile && !isCodeExecution) {
    // Try to find any executable file
    const executableFile = Object.values(files).find(
      f => f.type === 'file' && f.language && canExecuteLanguage(f.language)
    );

    if (executableFile) {
      return (
        <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col animate-fade-in">
          <PreviewHeader onClose={onClose} onRefresh={handleRefresh} isCodeMode={true} previewUrl={null} />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <TerminalIcon size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 mb-4">Open a file and press Run to execute it</p>
              <p className="text-xs text-gray-600">Supported: Python, JavaScript, TypeScript, Java, C++, Go, Rust, and more</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col animate-fade-in">
        <PreviewHeader onClose={onClose} onRefresh={handleRefresh} isCodeMode={false} previewUrl={null} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <XCircle size={48} className="mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No Runnable File</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Create an <code className="text-blue-400">index.html</code> for web preview, or open a code file (Python, JS, etc.) to execute it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Code Execution View
  if (isCodeExecution) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col animate-fade-in">
        <PreviewHeader 
          onClose={onClose} 
          onRefresh={handleRefresh} 
          isCodeMode={true}
          fileName={activeFile?.name}
          language={activeFile?.language}
        />
        
        <div className="flex-1 overflow-y-auto">
          {isExecuting ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 size={32} className="mx-auto mb-4 text-blue-400 animate-spin" />
                <p className="text-gray-400">Running {activeFile?.name}...</p>
                <p className="text-xs text-gray-600 mt-1">Using Piston API • {activeFile?.language}</p>
              </div>
            </div>
          ) : executionResult ? (
            <div className="p-4 space-y-3">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {executionResult.success ? (
                    <CheckCircle2 size={18} className="text-green-400" />
                  ) : (
                    <XCircle size={18} className="text-red-400" />
                  )}
                  <span className={`text-sm font-medium ${executionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {executionResult.success ? 'Success' : 'Error'}
                    {executionResult.exitCode !== null && ` (exit ${executionResult.exitCode})`}
                  </span>
                </div>
                <span className="text-xs text-gray-600">
                  {executionResult.language} {executionResult.version}
                </span>
              </div>

              {/* Output */}
              {executionResult.output && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wider">Output</div>
                  <pre className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 text-sm text-green-300 font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-[60vh]">
                    {executionResult.output}
                  </pre>
                </div>
              )}

              {/* Stderr */}
              {executionResult.stderr && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wider">Errors</div>
                  <pre className="bg-[#1a0000] border border-red-900/30 rounded-xl p-4 text-sm text-red-300 font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-[40vh]">
                    {executionResult.stderr}
                  </pre>
                </div>
              )}

              {/* No output */}
              {!executionResult.output && !executionResult.stderr && (
                <div className="text-center py-8 text-gray-500">
                  <p>Program produced no output</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Press the refresh button to run</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // HTML Preview View
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
      <PreviewHeader onClose={onClose} onRefresh={handleRefresh} isCodeMode={false} previewUrl={previewSrc} showConsole={showConsole} onToggleConsole={() => setShowConsole(!showConsole)} unreadLogs={unreadLogs} />
      <div className="flex-1 bg-white relative">
        {previewSrc ? (
          <iframe
            key={refreshKey}
            src={previewSrc}
            title="Live Preview"
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            className="w-full h-full border-none"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-[#0d1117]">
            <p className="text-gray-500">Could not build preview</p>
          </div>
        )}
        <ConsoleOverlay logs={consoleLogs} isOpen={showConsole} />
      </div>
    </div>
  );
}

function PreviewHeader({ onClose, onRefresh, isCodeMode, fileName, language, previewUrl, showConsole, onToggleConsole, unreadLogs }: { 
  onClose: () => void; 
  onRefresh: () => void; 
  isCodeMode: boolean;
  fileName?: string;
  language?: string;
  previewUrl?: string | null;
  showConsole?: boolean;
  onToggleConsole?: () => void;
  unreadLogs?: number;
}) {

  const handleOpenInBrowser = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  return (
    <div 
      className="flex items-center justify-between bg-[#161b22] border-b border-[#21262d] px-3 flex-shrink-0"
      style={{ height: 'calc(3rem + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center space-x-2 text-sm text-gray-300">
        <div className={`w-3 h-3 rounded-full ${isCodeMode ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`} />
        <span className="font-medium">{isCodeMode ? 'Output' : 'Preview'}</span>
        {fileName && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-md">{fileName}</span>
        )}
        {language && (
          <span className="text-xs text-gray-600">{language}</span>
        )}
      </div>
      <div className="flex items-center space-x-1">
        {onToggleConsole && (
          <button 
            onClick={onToggleConsole}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors relative ${showConsole ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
            title="Toggle Console"
          >
            <TerminalSquare size={16} />
            <span className="text-xs font-semibold">Console</span>
            {unreadLogs !== undefined && unreadLogs > 0 && !showConsole && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                {unreadLogs > 99 ? '99+' : unreadLogs}
              </span>
            )}
            {showConsole ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        )}
        {previewUrl && (
          <button 
            onClick={handleOpenInBrowser}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors"
            title="Open in Browser"
          >
            <ExternalLink size={18} />
          </button>
        )}
        <button 
          onClick={onRefresh}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors"
          title={isCodeMode ? 'Re-run' : 'Refresh'}
        >
          <RefreshCw size={18} />
        </button>
        <button 
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ConsoleOverlay({ logs, isOpen }: { logs: { type: string, args: string }[], isOpen: boolean }) {
  const endRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView();
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-[#1e1e1e]/95 backdrop-blur-md border-t border-[#3c3c3c] shadow-2xl z-20 flex flex-col animate-overlay-up">
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] md:text-xs">
        {logs.map((log, i) => (
          <div key={i} className={`px-2 py-1.5 mb-1 rounded border-l-2 ${
            log.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500' : 
            log.type === 'warn' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500' : 
            log.type === 'info' ? 'bg-blue-500/10 text-blue-400 border-blue-500' :
            'text-gray-300 border-gray-600 hover:bg-white/5'
          }`}>
            <span className="opacity-50 mr-2 shrink-0">[{log.type}]</span>
            <span className="whitespace-pre-wrap break-all">{log.args}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-gray-500 text-center py-8 italic flex flex-col items-center">
            <TerminalSquare size={32} className="mb-2 opacity-20" />
            <span>Console is empty</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
