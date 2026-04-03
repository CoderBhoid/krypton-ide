import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const htmlContent = useMemo(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    return marked.parse(content) as string;
  }, [content]);

  return (
    <div className="h-full overflow-y-auto bg-[#0d1117] p-6 md:p-8">
      <div 
        className="markdown-body max-w-3xl mx-auto"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      <style>{`
        .markdown-body {
          color: #c9d1d9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 15px;
          line-height: 1.7;
          word-wrap: break-word;
        }
        .markdown-body h1 {
          font-size: 2em;
          font-weight: 700;
          color: #f0f6fc;
          border-bottom: 1px solid #21262d;
          padding-bottom: 0.3em;
          margin: 1.5em 0 0.8em;
        }
        .markdown-body h2 {
          font-size: 1.5em;
          font-weight: 600;
          color: #f0f6fc;
          border-bottom: 1px solid #21262d;
          padding-bottom: 0.3em;
          margin: 1.2em 0 0.6em;
        }
        .markdown-body h3 {
          font-size: 1.25em;
          font-weight: 600;
          color: #f0f6fc;
          margin: 1em 0 0.5em;
        }
        .markdown-body h4, .markdown-body h5, .markdown-body h6 {
          font-weight: 600;
          color: #f0f6fc;
          margin: 1em 0 0.5em;
        }
        .markdown-body p {
          margin: 0.8em 0;
        }
        .markdown-body a {
          color: #58a6ff;
          text-decoration: none;
        }
        .markdown-body a:hover {
          text-decoration: underline;
        }
        .markdown-body strong {
          color: #f0f6fc;
          font-weight: 600;
        }
        .markdown-body em {
          font-style: italic;
        }
        .markdown-body code {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 0.15em 0.4em;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.88em;
          color: #e6edf3;
        }
        .markdown-body pre {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-body pre code {
          background: transparent;
          border: none;
          padding: 0;
          font-size: 0.9em;
          line-height: 1.5;
        }
        .markdown-body blockquote {
          border-left: 4px solid #3b82f6;
          padding: 0.5em 1em;
          margin: 1em 0;
          color: #8b949e;
          background: #161b22;
          border-radius: 0 8px 8px 0;
        }
        .markdown-body ul, .markdown-body ol {
          padding-left: 2em;
          margin: 0.8em 0;
        }
        .markdown-body li {
          margin: 0.3em 0;
        }
        .markdown-body li::marker {
          color: #484f58;
        }
        .markdown-body hr {
          border: none;
          border-top: 1px solid #21262d;
          margin: 2em 0;
        }
        .markdown-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
        }
        .markdown-body th {
          background: #161b22;
          font-weight: 600;
          color: #f0f6fc;
          text-align: left;
          padding: 8px 12px;
          border: 1px solid #30363d;
        }
        .markdown-body td {
          padding: 8px 12px;
          border: 1px solid #30363d;
        }
        .markdown-body img {
          max-width: 100%;
          border-radius: 8px;
          margin: 1em 0;
        }
        .markdown-body input[type="checkbox"] {
          margin-right: 8px;
          accent-color: #3b82f6;
        }
        .markdown-body del {
          color: #8b949e;
        }
      `}</style>
    </div>
  );
}
