import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ShellEngine } from '../../lib/shellEngine';

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const shellRef = useRef<ShellEngine>(new ShellEngine());

  useEffect(() => {
    if (!terminalRef.current) return;

    // Wait for the container to have actual dimensions before opening xterm
    const container = terminalRef.current;
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      // Container not visible yet — defer initialization
      const raf = requestAnimationFrame(() => {
        // Re-trigger effect by forcing a state update (handled by ResizeObserver below)
      });
      // We'll just retry via the ResizeObserver — set up a temporary observer
      const initObserver = new ResizeObserver(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          initObserver.disconnect();
          // Force re-mount by toggling a dummy state — but simpler: just proceed with init
          initTerminal();
        }
      });
      initObserver.observe(container);
      return () => { cancelAnimationFrame(raf); initObserver.disconnect(); };
    }

    return initTerminal();

    function initTerminal() {
    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d353',
        white: '#c9d1d9',
        brightBlack: '#484f58',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d364',
        brightWhite: '#f0f6fc',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: 'bar',
      letterSpacing: 0.5,
      lineHeight: 1.2,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);

    const safeFit = () => {
      try { 
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          fit.fit(); 
        }
      } catch (e) { /* ignore fit errors during transitions */ }
    };
    // Defer first fit to ensure layout is stable
    requestAnimationFrame(() => safeFit());

    const shell = shellRef.current;

    // Welcome message
    term.writeln('');
    term.writeln('\x1b[1;38;5;39m  ⚡ Krypton Terminal v2.0\x1b[0m');
    term.writeln('\x1b[38;5;243m  Termux-like shell • Type "help" for commands\x1b[0m');
    term.writeln('');

    let currentLine = '';
    let historyIndex = -1;
    let isExecuting = false;
    let tabCompletionState: { options: string[]; index: number; original: string } | null = null;

    const prompt = () => {
      const cwdDisplay = shell.cwdDisplay;
      term.write(`\x1b[1;38;5;39mkrypton\x1b[0m:\x1b[1;38;5;81m${cwdDisplay}\x1b[0m$ `);
    };

    prompt();

    const writeOutput = (text: string) => {
      if (!text) return;
      const lines = text.split('\n');
      for (const line of lines) {
        term.writeln(line);
      }
    };

    const handleEnter = async () => {
      term.write('\r\n');
      tabCompletionState = null;

      if (!currentLine.trim()) {
        prompt();
        return;
      }

      historyIndex = -1;
      isExecuting = true;

      try {
        const result = await shell.execute(currentLine);

        if (result.text === '\x1b[CLEAR]') {
          term.clear();
          term.writeln('');
        } else if (result.text) {
          writeOutput(result.text);
        }
      } catch (err: any) {
        term.writeln(`\x1b[38;5;196mInternal error: ${err.message}\x1b[0m`);
      }

      currentLine = '';
      isExecuting = false;
      prompt();
    };

    const handleBackspace = () => {
      if (currentLine.length > 0) {
        currentLine = currentLine.slice(0, -1);
        term.write('\b \b');
        tabCompletionState = null;
      }
    };

    const handleTab = () => {
      const words = currentLine.split(/\s+/);
      const lastWord = words[words.length - 1] || '';

      if (tabCompletionState && tabCompletionState.options.length > 1) {
        // Cycle through options
        tabCompletionState.index = (tabCompletionState.index + 1) % tabCompletionState.options.length;
        const replacement = tabCompletionState.options[tabCompletionState.index];

        // Erase current last word
        const currentLastWord = words[words.length - 1];
        for (let i = 0; i < currentLastWord.length; i++) term.write('\b \b');

        words[words.length - 1] = replacement;
        currentLine = words.join(' ');
        term.write(replacement);
        return;
      }

      const completions = shell.getCompletions(currentLine);
      if (completions.length === 0) return;

      if (completions.length === 1) {
        // Auto-complete directly
        const match = completions[0];
        const remaining = match.slice(lastWord.length);
        currentLine += remaining;
        term.write(remaining);
        tabCompletionState = null;
      } else {
        // Show options and start cycling
        tabCompletionState = { options: completions, index: 0, original: lastWord };

        // Replace with first option
        for (let i = 0; i < lastWord.length; i++) term.write('\b \b');
        words[words.length - 1] = completions[0];
        currentLine = words.join(' ');
        term.write(completions[0]);

        // Also show all options below
        term.write('\r\n');
        term.writeln(completions.map(c => `  \x1b[38;5;81m${c}\x1b[0m`).join('  '));
        prompt();
        term.write(currentLine);
      }
    };

    const handleArrowUp = () => {
      const history = shell.getHistory();
      if (history.length === 0) return;

      if (historyIndex === -1) {
        historyIndex = history.length - 1;
      } else if (historyIndex > 0) {
        historyIndex--;
      }

      // Clear current line
      while (currentLine.length > 0) {
        term.write('\b \b');
        currentLine = currentLine.slice(0, -1);
      }
      currentLine = history[historyIndex];
      term.write(currentLine);
      tabCompletionState = null;
    };

    const handleArrowDown = () => {
      const history = shell.getHistory();
      if (historyIndex === -1) return;

      while (currentLine.length > 0) {
        term.write('\b \b');
        currentLine = currentLine.slice(0, -1);
      }

      if (historyIndex < history.length - 1) {
        historyIndex++;
        currentLine = history[historyIndex];
        term.write(currentLine);
      } else {
        historyIndex = -1;
      }
      tabCompletionState = null;
    };

    term.onData(e => {
      if (isExecuting) return;

      switch (e) {
        case '\r': // Enter
          handleEnter();
          break;
        case '\x7F': // Backspace
          handleBackspace();
          break;
        case '\t': // Tab
          handleTab();
          break;
        case '\x1b[A': // Arrow up
          handleArrowUp();
          break;
        case '\x1b[B': // Arrow down
          handleArrowDown();
          break;
        case '\x03': // Ctrl+C
          term.write('^C\r\n');
          currentLine = '';
          isExecuting = false;
          prompt();
          break;
        case '\x0C': // Ctrl+L (clear)
          term.clear();
          term.writeln('');
          prompt();
          break;
        default:
          // Handle paste (multi-character input)
          if (e.length > 1 && !e.startsWith('\x1b')) {
            // Paste — only take first line
            const firstLine = e.split('\n')[0].split('\r')[0];
            for (const ch of firstLine) {
              if (ch >= String.fromCharCode(0x20) && ch <= String.fromCharCode(0x7E) || ch >= '\u00a0') {
                currentLine += ch;
                term.write(ch);
              }
            }
          } else if (e >= String.fromCharCode(0x20) && e <= String.fromCharCode(0x7E) || e >= '\u00a0') {
            currentLine += e;
            term.write(e);
            tabCompletionState = null;
          }
      }
    });

    termInstance.current = term;
    fitAddon.current = fit;

    const handleResize = () => safeFit();
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => safeFit());
    resizeObserver.observe(container);

    setTimeout(() => safeFit(), 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      term.dispose();
    };
    } // end initTerminal
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden pl-2" ref={terminalRef} />
    </div>
  );
}
