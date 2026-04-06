// Krypton Shell Engine — Termux-like virtual terminal
// Operates against the Zustand virtual file system with 30+ Unix commands,
// pipe support, output redirection, environment variables, and code execution.

import { useIdeStore, type FileNode, getLanguageFromFilename } from '../store/useIdeStore';
import { executeCode } from './codeRunner';

export interface ShellOutput {
  text: string;
  isError: boolean;
}

type CommandHandler = (args: string[], flags: Record<string, boolean | string>) => ShellOutput | Promise<ShellOutput>;

export class ShellEngine {
  private cwdSegments: string[] = []; // relative to root
  private env: Record<string, string> = {
    HOME: '/project',
    USER: 'krypton-user',
    SHELL: '/bin/ksh',
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    EDITOR: 'krypton',
    PATH: '/usr/local/bin:/usr/bin:/bin',
  };
  private aliases: Record<string, string> = {
    'll': 'ls -l',
    'la': 'ls -a',
    'cls': 'clear',
    'q': 'exit',
  };
  private history: string[] = [];
  private commands: Record<string, CommandHandler> = {};

  constructor() {
    this.registerCommands();
  }

  get cwd(): string {
    return '/project' + (this.cwdSegments.length > 0 ? '/' + this.cwdSegments.join('/') : '');
  }

  get cwdDisplay(): string {
    if (this.cwdSegments.length === 0) return '~';
    return '~/' + this.cwdSegments.join('/');
  }

  getHistory(): string[] {
    return [...this.history];
  }

  // ─── Path Resolution ────────────────────────────────────────
  private resolvePathSegments(path: string): string[] | null {
    let segments = [...this.cwdSegments];

    if (path === '/' || path === '~' || path === '/project') {
      return [];
    }
    if (path.startsWith('~/')) {
      segments = [];
      path = path.slice(2);
    } else if (path.startsWith('/project/')) {
      segments = [];
      path = path.slice(9);
    } else if (path.startsWith('/')) {
      segments = [];
      path = path.slice(1);
    }

    const parts = path.split('/').filter(Boolean);
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (segments.length > 0) segments.pop();
      } else {
        segments.push(part);
      }
    }
    return segments;
  }

  private resolveNode(path: string): FileNode | null {
    const segments = this.resolvePathSegments(path);
    if (!segments) return null;
    return useIdeStore.getState().getFileByPath(segments);
  }

  private resolveCwdNode(): FileNode | null {
    return useIdeStore.getState().getFileByPath(this.cwdSegments);
  }

  private getNodeId(path: string): string | null {
    const node = this.resolveNode(path);
    return node?.id || null;
  }

  private getCurrentChildren(): FileNode[] {
    const cwd = this.resolveCwdNode();
    if (!cwd) return [];
    return useIdeStore.getState().getChildrenOf(cwd.id);
  }

  // ─── Tab completion ─────────────────────────────────────────
  getCompletions(partial: string): string[] {
    const words = partial.split(/\s+/);
    const isFirstWord = words.length <= 1;
    const lastWord = words[words.length - 1] || '';

    if (isFirstWord) {
      // Complete command names
      const cmdNames = Object.keys(this.commands);
      const aliasNames = Object.keys(this.aliases);
      const builtins = ['node', 'python', 'run'];
      const all = [...cmdNames, ...aliasNames, ...builtins];
      return all.filter(c => c.startsWith(lastWord)).sort();
    }

    // Complete file/folder names
    let dirPath = '';
    let prefix = lastWord;
    const lastSlash = lastWord.lastIndexOf('/');
    if (lastSlash >= 0) {
      dirPath = lastWord.slice(0, lastSlash) || '/';
      prefix = lastWord.slice(lastSlash + 1);
    }

    let children: FileNode[];
    if (dirPath) {
      const node = this.resolveNode(dirPath);
      if (node && node.type === 'folder') {
        children = useIdeStore.getState().getChildrenOf(node.id);
      } else {
        return [];
      }
    } else {
      children = this.getCurrentChildren();
    }

    return children
      .filter(c => c.name.startsWith(prefix))
      .map(c => {
        const base = dirPath ? dirPath + '/' + c.name : c.name;
        return c.type === 'folder' ? base + '/' : base;
      })
      .sort();
  }

  // ─── Main execute ───────────────────────────────────────────
  async execute(raw: string): Promise<ShellOutput> {
    const input = raw.trim();
    if (!input) return { text: '', isError: false };

    this.history.push(input);

    // Expand environment variables
    const expanded = this.expandEnvVars(input);

    // Check for output redirection
    const redirectMatch = expanded.match(/^(.+?)\s*(>>|>)\s*(.+)$/);
    if (redirectMatch) {
      const cmd = redirectMatch[1].trim();
      const mode = redirectMatch[2];
      const filePath = redirectMatch[3].trim();
      const result = await this.executePipeline(cmd);
      this.handleRedirect(result.text, filePath, mode === '>>');
      return { text: '', isError: false };
    }

    // Check for pipes
    if (expanded.includes('|')) {
      return this.executePipeline(expanded);
    }

    return this.executeSingle(expanded);
  }

  private expandEnvVars(input: string): string {
    return input.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (_, name) => {
      if (name === 'PWD') return this.cwd;
      return this.env[name] || '';
    });
  }

  private async executePipeline(input: string): Promise<ShellOutput> {
    const commands = input.split('|').map(c => c.trim()).filter(Boolean);
    let pipeInput = '';

    for (let i = 0; i < commands.length; i++) {
      const result = await this.executeSingle(commands[i], pipeInput);
      if (result.isError) return result;
      pipeInput = result.text;
    }

    return { text: pipeInput, isError: false };
  }

  private async executeSingle(input: string, pipeInput?: string): Promise<ShellOutput> {
    // Expand aliases
    const firstWord = input.split(/\s+/)[0];
    if (this.aliases[firstWord]) {
      input = this.aliases[firstWord] + input.slice(firstWord.length);
    }

    const { command, args, flags } = this.parse(input);

    // Special: code execution commands
    if (command === 'node' || command === 'python' || command === 'run') {
      return this.executeCodeCommand(command, args, flags);
    }

    const handler = this.commands[command];
    if (!handler) {
      return { text: `krypton: command not found: ${command}\nType "help" for available commands`, isError: true };
    }

    // Inject pipe input as special __stdin flag
    if (pipeInput !== undefined) {
      flags['__stdin'] = pipeInput;
    }

    return handler(args, flags);
  }

  private parse(input: string): { command: string; args: string[]; flags: Record<string, boolean | string> } {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (inQuote) {
        if (ch === inQuote) {
          inQuote = null;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ' ' || ch === '\t') {
        if (current) { tokens.push(current); current = ''; }
      } else {
        current += ch;
      }
    }
    if (current) tokens.push(current);

    const command = tokens[0]?.toLowerCase() || '';
    const args: string[] = [];
    const flags: Record<string, boolean | string> = {};

    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith('--')) {
        const [key, val] = t.slice(2).split('=');
        flags[key] = val || true;
      } else if (t.startsWith('-') && t.length > 1 && !t.match(/^-\d/)) {
        // Split combined flags like -la into -l -a
        for (const ch of t.slice(1)) {
          flags[ch] = true;
        }
      } else {
        args.push(t);
      }
    }

    return { command, args, flags };
  }

  private handleRedirect(content: string, filePath: string, append: boolean) {
    const store = useIdeStore.getState();
    const segments = this.resolvePathSegments(filePath);
    if (!segments || segments.length === 0) return;

    const fileName = segments[segments.length - 1];
    const parentSegments = segments.slice(0, -1);
    const parentNode = store.getFileByPath(parentSegments);
    const parentId = parentNode?.id || 'root';

    const existingNode = store.getFileByPath(segments);
    if (existingNode && existingNode.type === 'file') {
      const newContent = append ? (existingNode.content || '') + content : content;
      store.updateFileContent(existingNode.id, newContent);
    } else if (!existingNode) {
      store.createFile(fileName, parentId, 'file', content);
    }
  }

  private async executeCodeCommand(command: string, args: string[], flags: Record<string, any> = {}): Promise<ShellOutput> {
    let code = '';
    let language = '';
    let filename = '';

    if (args.length > 0) {
      const node = this.resolveNode(args[0]);
      if (!node || node.type !== 'file') {
        return { text: `${command}: ${args[0]}: No such file`, isError: true };
      }
      code = node.content || '';
      filename = node.name;
      language = node.language || 'plaintext';
    } else if (command === 'run') {
      // Auto-detect: find main file in current dir
      const children = this.getCurrentChildren();
      const mainFile = children.find(f =>
        f.type === 'file' && /^(main|index|app)\.(js|jsx|ts|tsx|py|go|rs|rb|java|kt|dart|cpp|c)$/.test(f.name)
      );
      if (!mainFile) {
        return { text: 'run: no main/index/app file found in current directory', isError: true };
      }
      code = mainFile.content || '';
      filename = mainFile.name;
      language = mainFile.language || 'plaintext';
    } else {
      return { text: `${command}: specify a file to execute`, isError: true };
    }

    // Override language for explicit commands
    if (command === 'node') language = 'javascript';
    if (command === 'python') language = 'python';

    try {
      const store = useIdeStore.getState();
      const target = (flags['target'] as string) || store.runTarget;
      const result = await executeCode(language, code, filename, target);
      let output = '';
      if (result.output) output += result.output;
      if (result.stderr) output += (output ? '\n' : '') + result.stderr;
      if (!output) output = `Process exited with code ${result.exitCode ?? 0}`;
      return { text: output, isError: !result.success };
    } catch (err: any) {
      return { text: `Execution error: ${err.message}`, isError: true };
    }
  }

  // ─── Command Registry ──────────────────────────────────────
  private registerCommands() {
    this.commands['help'] = () => {
      const helpText = [
        '\x1b[1;38;5;39m⚡ Krypton Shell — Command Reference\x1b[0m',
        '',
        '\x1b[1;38;5;81m  File Operations\x1b[0m',
        '  ls [path]           List directory contents',
        '  cat <file>          Display file content',
        '  touch <file>        Create empty file',
        '  mkdir <dir>         Create directory',
        '  rm <path>           Remove file or directory',
        '  mv <src> <dest>     Move/rename file',
        '  cp <src> <dest>     Copy file',
        '  head <file> [-n N]  Show first N lines (default 10)',
        '  tail <file> [-n N]  Show last N lines (default 10)',
        '  wc <file>           Count lines, words, chars',
        '',
        '\x1b[1;38;5;81m  Navigation\x1b[0m',
        '  cd <path>           Change directory',
        '  pwd                 Print working directory',
        '  tree [path]         Show directory tree',
        '  find <pattern>      Search files by name',
        '',
        '\x1b[1;38;5;81m  Text Processing\x1b[0m',
        '  grep <pattern> [f]  Search for pattern in file/stdin',
        '  sort [file]         Sort lines',
        '  uniq [file]         Remove duplicate lines',
        '  echo <text>         Print text',
        '',
        '\x1b[1;38;5;81m  Code Execution\x1b[0m',
        '  node <file>         Run JavaScript file',
        '  python <file>       Run Python file',
        '  run                 Auto-detect and run main file',
        '',
        '\x1b[1;38;5;81m  Environment\x1b[0m',
        '  env                 Show environment variables',
        '  export K=V          Set environment variable',
        '  alias name=cmd      Create command alias',
        '  unalias <name>      Remove alias',
        '  which <cmd>         Show command location',
        '',
        '\x1b[1;38;5;81m  System\x1b[0m',
        '  clear               Clear terminal',
        '  history             Show command history',
        '  date                Show date/time',
        '  whoami              Current user',
        '  uname               System info',
        '  neofetch            System overview',
        '  exit                Close terminal session',
        '',
        '\x1b[38;5;243m  Supports: pipes (|), redirection (> >>), env vars ($VAR)\x1b[0m',
      ];
      return { text: helpText.join('\n'), isError: false };
    };

    // ── File Operations ──

    this.commands['ls'] = (args, flags) => {
      const targetPath = args[0] || '.';
      const node = this.resolveNode(targetPath);
      if (!node) return { text: `ls: cannot access '${targetPath}': No such file or directory`, isError: true };
      if (node.type === 'file') return { text: node.name, isError: false };

      const children = useIdeStore.getState().getChildrenOf(node.id);
      const showAll = flags['a'] === true;
      const longFormat = flags['l'] === true;

      let items = children;
      if (!showAll) {
        items = items.filter(c => !c.name.startsWith('.'));
      }

      if (longFormat) {
        const lines = items.map(c => {
          const type = c.type === 'folder' ? 'd' : '-';
          const size = c.content?.length || 0;
          const name = c.type === 'folder'
            ? `\x1b[1;38;5;39m${c.name}/\x1b[0m`
            : this.colorizeFilename(c.name);
          return `${type}rw-r--r--  1 krypton  ${String(size).padStart(6)}  ${name}`;
        });
        return { text: lines.join('\n'), isError: false };
      }

      const names = items.map(c =>
        c.type === 'folder' ? `\x1b[1;38;5;39m${c.name}/\x1b[0m` : this.colorizeFilename(c.name)
      );
      return { text: names.join('  '), isError: false };
    };

    this.commands['cat'] = (args, flags) => {
      if (flags['__stdin']) return { text: flags['__stdin'] as string, isError: false };
      if (!args[0]) return { text: 'cat: missing file operand', isError: true };

      const node = this.resolveNode(args[0]);
      if (!node || node.type !== 'file') return { text: `cat: ${args[0]}: No such file`, isError: true };

      const content = node.content || '';
      const showLineNumbers = flags['n'] === true;
      if (showLineNumbers) {
        return {
          text: content.split('\n').map((line, i) =>
            `\x1b[38;5;243m${String(i + 1).padStart(4)}\x1b[0m  ${line}`
          ).join('\n'),
          isError: false,
        };
      }
      return { text: content, isError: false };
    };

    this.commands['touch'] = (args) => {
      if (!args[0]) return { text: 'touch: missing file operand', isError: true };

      const segments = this.resolvePathSegments(args[0]);
      if (!segments || segments.length === 0) return { text: 'touch: invalid path', isError: true };

      const existing = useIdeStore.getState().getFileByPath(segments);
      if (existing) return { text: '', isError: false }; // touch existing = noop

      const fileName = segments[segments.length - 1];
      const parentSegs = segments.slice(0, -1);
      const parentNode = useIdeStore.getState().getFileByPath(parentSegs);
      const parentId = parentNode?.id || 'root';

      useIdeStore.getState().createFile(fileName, parentId, 'file', '');
      return { text: `\x1b[38;5;82mCreated: ${args[0]}\x1b[0m`, isError: false };
    };

    this.commands['mkdir'] = (args, flags) => {
      if (!args[0]) return { text: 'mkdir: missing operand', isError: true };

      const segments = this.resolvePathSegments(args[0]);
      if (!segments || segments.length === 0) return { text: 'mkdir: invalid path', isError: true };

      const store = useIdeStore.getState();
      const existing = store.getFileByPath(segments);
      if (existing) return { text: `mkdir: '${args[0]}': File exists`, isError: true };

      if (flags['p'] === true) {
        // Create intermediate dirs
        let currentSegs: string[] = [];
        for (const seg of segments) {
          currentSegs.push(seg);
          const node = store.getFileByPath(currentSegs);
          if (!node) {
            const parentNode = store.getFileByPath(currentSegs.slice(0, -1));
            const parentId = parentNode?.id || 'root';
            store.createFile(seg, parentId, 'folder');
          }
        }
      } else {
        const parentSegs = segments.slice(0, -1);
        const parentNode = store.getFileByPath(parentSegs);
        if (!parentNode && parentSegs.length > 0) {
          return { text: `mkdir: cannot create '${args[0]}': No such directory (use -p)`, isError: true };
        }
        const parentId = parentNode?.id || 'root';
        store.createFile(segments[segments.length - 1], parentId, 'folder');
      }

      return { text: `\x1b[38;5;82mCreated: ${args[0]}/\x1b[0m`, isError: false };
    };

    this.commands['rm'] = (args, flags) => {
      if (!args[0]) return { text: 'rm: missing operand', isError: true };

      const node = this.resolveNode(args[0]);
      if (!node) return { text: `rm: '${args[0]}': No such file or directory`, isError: true };
      if (node.id === 'root') return { text: 'rm: cannot remove root directory', isError: true };

      if (node.type === 'folder' && !flags['r'] && !flags['f']) {
        return { text: `rm: '${args[0]}': Is a directory (use -r)`, isError: true };
      }

      useIdeStore.getState().deleteFile(node.id);
      return { text: `\x1b[38;5;82mRemoved: ${args[0]}\x1b[0m`, isError: false };
    };

    this.commands['mv'] = (args) => {
      if (args.length < 2) return { text: 'mv: missing destination', isError: true };

      const srcNode = this.resolveNode(args[0]);
      if (!srcNode) return { text: `mv: '${args[0]}': No such file or directory`, isError: true };

      const destSegments = this.resolvePathSegments(args[1]);
      if (!destSegments) return { text: 'mv: invalid destination', isError: true };

      const destNode = useIdeStore.getState().getFileByPath(destSegments);

      if (destNode && destNode.type === 'folder') {
        // Move into directory
        useIdeStore.getState().moveFile(srcNode.id, destNode.id);
      } else {
        // Rename
        const destName = destSegments[destSegments.length - 1];
        const destParentSegs = destSegments.slice(0, -1);
        const destParent = useIdeStore.getState().getFileByPath(destParentSegs);
        const parentId = destParent?.id || 'root';
        useIdeStore.getState().moveFile(srcNode.id, parentId, destName);
      }

      return { text: `\x1b[38;5;82mMoved: ${args[0]} → ${args[1]}\x1b[0m`, isError: false };
    };

    this.commands['cp'] = (args) => {
      if (args.length < 2) return { text: 'cp: missing destination', isError: true };

      const srcNode = this.resolveNode(args[0]);
      if (!srcNode) return { text: `cp: '${args[0]}': No such file or directory`, isError: true };

      const destSegments = this.resolvePathSegments(args[1]);
      if (!destSegments) return { text: 'cp: invalid destination', isError: true };

      const destNode = useIdeStore.getState().getFileByPath(destSegments);
      if (destNode && destNode.type === 'folder') {
        useIdeStore.getState().copyFile(srcNode.id, destNode.id);
      } else {
        const destName = destSegments[destSegments.length - 1];
        const destParentSegs = destSegments.slice(0, -1);
        const destParent = useIdeStore.getState().getFileByPath(destParentSegs);
        const parentId = destParent?.id || 'root';
        useIdeStore.getState().copyFile(srcNode.id, parentId, destName);
      }

      return { text: `\x1b[38;5;82mCopied: ${args[0]} → ${args[1]}\x1b[0m`, isError: false };
    };

    this.commands['head'] = (args, flags) => {
      const input = flags['__stdin'] as string | undefined;
      const n = Number(flags['n']) || 10;
      let content = '';

      if (input) {
        content = input;
      } else if (args[0]) {
        const node = this.resolveNode(args[0]);
        if (!node || node.type !== 'file') return { text: `head: ${args[0]}: No such file`, isError: true };
        content = node.content || '';
      } else {
        return { text: 'head: missing operand', isError: true };
      }

      return { text: content.split('\n').slice(0, n).join('\n'), isError: false };
    };

    this.commands['tail'] = (args, flags) => {
      const input = flags['__stdin'] as string | undefined;
      const n = Number(flags['n']) || 10;
      let content = '';

      if (input) {
        content = input;
      } else if (args[0]) {
        const node = this.resolveNode(args[0]);
        if (!node || node.type !== 'file') return { text: `tail: ${args[0]}: No such file`, isError: true };
        content = node.content || '';
      } else {
        return { text: 'tail: missing operand', isError: true };
      }

      const lines = content.split('\n');
      return { text: lines.slice(-n).join('\n'), isError: false };
    };

    this.commands['wc'] = (args, flags) => {
      let content = '';
      const input = flags['__stdin'] as string | undefined;

      if (input) {
        content = input;
      } else if (args[0]) {
        const node = this.resolveNode(args[0]);
        if (!node || node.type !== 'file') return { text: `wc: ${args[0]}: No such file`, isError: true };
        content = node.content || '';
      } else {
        return { text: 'wc: missing operand', isError: true };
      }

      const lines = content.split('\n').length;
      const words = content.split(/\s+/).filter(Boolean).length;
      const chars = content.length;
      const label = args[0] || '';
      return { text: `  ${lines}  ${words}  ${chars} ${label}`.trim(), isError: false };
    };

    // ── Navigation ──

    this.commands['cd'] = (args) => {
      const target = args[0] || '~';
      const segments = this.resolvePathSegments(target);
      if (segments === null) return { text: `cd: invalid path`, isError: true };

      if (segments.length === 0) {
        this.cwdSegments = [];
        this.env['PWD'] = this.cwd;
        return { text: '', isError: false };
      }

      const node = useIdeStore.getState().getFileByPath(segments);
      if (!node) return { text: `cd: ${target}: No such file or directory`, isError: true };
      if (node.type !== 'folder') return { text: `cd: ${target}: Not a directory`, isError: true };

      this.cwdSegments = segments;
      this.env['PWD'] = this.cwd;
      return { text: '', isError: false };
    };

    this.commands['pwd'] = () => {
      return { text: this.cwd, isError: false };
    };

    this.commands['tree'] = (args) => {
      const targetPath = args[0] || '.';
      const node = this.resolveNode(targetPath);
      if (!node || node.type !== 'folder') return { text: `tree: '${targetPath}': Not a directory`, isError: true };

      const lines: string[] = [];
      const store = useIdeStore.getState();

      const walk = (nodeId: string, prefix: string, isLast: boolean, isRoot: boolean) => {
        const n = store.files[nodeId];
        if (!n) return;

        if (isRoot) {
          lines.push(`\x1b[1;38;5;39m.\x1b[0m`);
        } else {
          const connector = isLast ? '└── ' : '├── ';
          const name = n.type === 'folder'
            ? `\x1b[1;38;5;39m${n.name}/\x1b[0m`
            : this.colorizeFilename(n.name);
          lines.push(prefix + connector + name);
        }

        if (n.children) {
          const children = n.children.map(cid => store.files[cid]).filter(Boolean);
          children.forEach((child, i) => {
            const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
            walk(child.id, childPrefix, i === children.length - 1, false);
          });
        }
      };

      walk(node.id, '', true, true);
      return { text: lines.join('\n'), isError: false };
    };

    this.commands['find'] = (args, flags) => {
      if (!args[0]) return { text: 'find: missing search pattern', isError: true };

      const pattern = args[0].toLowerCase();
      const store = useIdeStore.getState();
      const results: string[] = [];

      const walk = (nodeId: string, path: string) => {
        const n = store.files[nodeId];
        if (!n) return;
        const fullPath = path ? `${path}/${n.name}` : n.name;
        if (n.name.toLowerCase().includes(pattern) && n.id !== 'root') {
          results.push(fullPath);
        }
        if (n.children) {
          n.children.forEach(cid => walk(cid, fullPath));
        }
      };

      const cwd = this.resolveCwdNode();
      if (cwd) walk(cwd.id, '.');

      if (results.length === 0) return { text: `find: no files matching '${args[0]}'`, isError: false };
      return { text: results.join('\n'), isError: false };
    };

    // ── Text Processing ──

    this.commands['grep'] = (args, flags) => {
      if (!args[0]) return { text: 'grep: missing pattern', isError: true };

      const pattern = args[0];
      const input = flags['__stdin'] as string | undefined;
      let content = '';

      if (input) {
        content = input;
      } else if (args[1]) {
        const node = this.resolveNode(args[1]);
        if (!node || node.type !== 'file') return { text: `grep: ${args[1]}: No such file`, isError: true };
        content = node.content || '';
      } else {
        return { text: 'grep: no input (pipe a command or specify a file)', isError: true };
      }

      const ignoreCase = flags['i'] === true;
      const showLineNums = flags['n'] === true;
      const regex = new RegExp(pattern, ignoreCase ? 'gi' : 'g');

      const matches = content.split('\n')
        .map((line, i) => ({ line, num: i + 1 }))
        .filter(({ line }) => regex.test(line));

      if (matches.length === 0) return { text: '', isError: false };

      const lines = matches.map(({ line, num }) => {
        const highlighted = line.replace(
          new RegExp(pattern, ignoreCase ? 'gi' : 'g'),
          match => `\x1b[1;38;5;196m${match}\x1b[0m`
        );
        return showLineNums ? `\x1b[38;5;243m${num}:\x1b[0m${highlighted}` : highlighted;
      });

      return { text: lines.join('\n'), isError: false };
    };

    this.commands['sort'] = (args, flags) => {
      const input = flags['__stdin'] as string | undefined;
      let content = '';

      if (input) {
        content = input;
      } else if (args[0]) {
        const node = this.resolveNode(args[0]);
        if (!node || node.type !== 'file') return { text: `sort: ${args[0]}: No such file`, isError: true };
        content = node.content || '';
      } else {
        return { text: 'sort: missing operand', isError: true };
      }

      let lines = content.split('\n');
      if (flags['r'] === true) {
        lines = lines.sort().reverse();
      } else {
        lines = lines.sort();
      }
      return { text: lines.join('\n'), isError: false };
    };

    this.commands['uniq'] = (args, flags) => {
      const input = flags['__stdin'] as string | undefined;
      let content = '';

      if (input) {
        content = input;
      } else if (args[0]) {
        const node = this.resolveNode(args[0]);
        if (!node || node.type !== 'file') return { text: `uniq: ${args[0]}: No such file`, isError: true };
        content = node.content || '';
      } else {
        return { text: 'uniq: missing operand', isError: true };
      }

      const lines = content.split('\n');
      const unique = lines.filter((line, i) => i === 0 || line !== lines[i - 1]);
      return { text: unique.join('\n'), isError: false };
    };

    this.commands['echo'] = (args) => {
      return { text: args.join(' '), isError: false };
    };

    // ── Environment ──

    this.commands['env'] = () => {
      const lines = Object.entries(this.env).map(([k, v]) => `${k}=${v}`);
      return { text: lines.join('\n'), isError: false };
    };

    this.commands['export'] = (args) => {
      if (!args[0]) return { text: 'export: usage: export KEY=VALUE', isError: true };

      const eq = args.join(' ');
      const match = eq.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if (!match) return { text: 'export: invalid format (KEY=VALUE)', isError: true };

      this.env[match[1]] = match[2];
      return { text: '', isError: false };
    };

    this.commands['alias'] = (args) => {
      if (!args[0]) {
        const lines = Object.entries(this.aliases).map(([k, v]) => `alias ${k}='${v}'`);
        return { text: lines.join('\n'), isError: false };
      }

      const match = args.join(' ').match(/^([a-z_][a-z0-9_-]*)=(.+)$/i);
      if (!match) return { text: 'alias: invalid format (name=command)', isError: true };
      this.aliases[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      return { text: '', isError: false };
    };

    this.commands['unalias'] = (args) => {
      if (!args[0]) return { text: 'unalias: missing name', isError: true };
      delete this.aliases[args[0]];
      return { text: '', isError: false };
    };

    this.commands['which'] = (args) => {
      if (!args[0]) return { text: 'which: missing command name', isError: true };
      const cmd = args[0];
      if (this.commands[cmd]) return { text: `/usr/bin/${cmd}`, isError: false };
      if (this.aliases[cmd]) return { text: `alias: ${cmd}='${this.aliases[cmd]}'`, isError: false };
      if (['node', 'python', 'run'].includes(cmd)) return { text: `/usr/local/bin/${cmd}`, isError: false };
      return { text: `which: no ${cmd} in (${this.env['PATH']})`, isError: true };
    };

    // ── System ──

    this.commands['clear'] = () => {
      return { text: '\x1b[CLEAR]', isError: false };
    };

    this.commands['history'] = () => {
      const lines = this.history.map((cmd, i) =>
        `\x1b[38;5;243m${String(i + 1).padStart(4)}\x1b[0m  ${cmd}`
      );
      return { text: lines.join('\n'), isError: false };
    };

    this.commands['date'] = () => {
      return { text: new Date().toString(), isError: false };
    };

    this.commands['whoami'] = () => {
      return { text: this.env['USER'], isError: false };
    };

    this.commands['uname'] = (args, flags) => {
      if (flags['a'] === true) {
        return { text: `KryptonOS 1.0 krypton-vm aarch64 Krypton/Shell`, isError: false };
      }
      return { text: 'KryptonOS', isError: false };
    };

    this.commands['neofetch'] = () => {
      const store = useIdeStore.getState();
      const fileCount = Object.values(store.files).filter(f => f.type === 'file').length;
      const folderCount = Object.values(store.files).filter(f => f.type === 'folder').length;
      const mem = (performance as any).memory;
      const memUsed = mem ? Math.round(mem.usedJSHeapSize / 1048576) + 'MB' : 'N/A';

      const lines = [
        '',
        '  \x1b[38;5;39m  ╔═══════════════╗\x1b[0m',
        '  \x1b[38;5;39m  ║   ⚡ KRYPTON   ║\x1b[0m   \x1b[1;38;5;81mKrypton IDE\x1b[0m',
        '  \x1b[38;5;39m  ╚═══════════════╝\x1b[0m   \x1b[38;5;243m──────────────────\x1b[0m',
        `                        \x1b[38;5;81mOS:\x1b[0m      KryptonOS (Web)`,
        `                        \x1b[38;5;81mHost:\x1b[0m    ${navigator.platform}`,
        `                        \x1b[38;5;81mShell:\x1b[0m   ksh 1.0`,
        `                        \x1b[38;5;81mFiles:\x1b[0m   ${fileCount} files, ${folderCount} folders`,
        `                        \x1b[38;5;81mMemory:\x1b[0m  ${memUsed}`,
        `                        \x1b[38;5;81mScreen:\x1b[0m  ${screen.width}×${screen.height}`,
        `                        \x1b[38;5;81mTheme:\x1b[0m   ${store.theme}`,
        '',
        '  \x1b[48;5;0m  \x1b[48;5;1m  \x1b[48;5;2m  \x1b[48;5;3m  \x1b[48;5;4m  \x1b[48;5;5m  \x1b[48;5;6m  \x1b[48;5;7m  \x1b[0m',
        '',
      ];
      return { text: lines.join('\n'), isError: false };
    };

    this.commands['exit'] = () => {
      return { text: '\x1b[38;5;243mSession terminated. Type any key to restart.\x1b[0m', isError: false };
    };
  }

  // ── Helpers ──
  private colorizeFilename(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const colorMap: Record<string, string> = {
      'js': '226', 'jsx': '226', 'mjs': '226',
      'ts': '75', 'tsx': '75',
      'html': '208', 'htm': '208',
      'css': '117', 'scss': '117', 'less': '117',
      'json': '220', 'yaml': '220', 'yml': '220',
      'md': '252', 'txt': '252',
      'py': '118',
      'go': '81',
      'rs': '208',
      'java': '196', 'kt': '196',
      'cpp': '141', 'c': '141', 'h': '141',
      'rb': '196',
      'php': '141',
      'sh': '118', 'bash': '118',
      'svg': '215', 'png': '215', 'jpg': '215',
    };
    const color = colorMap[ext] || '255';
    return `\x1b[38;5;${color}m${name}\x1b[0m`;
  }
}
