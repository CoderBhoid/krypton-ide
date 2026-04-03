import prettier from 'prettier/standalone';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import htmlPlugin from 'prettier/plugins/html';
import cssPlugin from 'prettier/plugins/postcss';
import typescriptPlugin from 'prettier/plugins/typescript';
import markdownPlugin from 'prettier/plugins/markdown';

export async function formatCode(code: string, language: string): Promise<string> {
  try {
    let parser = 'babel';
    let plugins: any[] = [babelPlugin, estreePlugin];

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'jsx':
        parser = 'babel';
        break;
      case 'typescript':
      case 'tsx':
        parser = 'typescript';
        plugins = [typescriptPlugin, estreePlugin];
        break;
      case 'html':
        parser = 'html';
        plugins = [htmlPlugin];
        break;
      case 'css':
      case 'less':
      case 'scss':
        parser = 'css';
        plugins = [cssPlugin];
        break;
      case 'json':
        parser = 'json';
        plugins = [babelPlugin, estreePlugin];
        break;
      case 'markdown':
      case 'md':
        parser = 'markdown';
        plugins = [markdownPlugin];
        break;
      default:
        // Attempt babel for unknown but potentially valid JS-like files
        parser = 'babel';
        break;
    }

    const formatted = await prettier.format(code, {
      parser,
      plugins,
      singleQuote: true,
      bracketSpacing: true,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
    });

    return formatted;
  } catch (error) {
    console.error('Formatter failed:', error);
    return code; // return original code if formatting fails
  }
}
