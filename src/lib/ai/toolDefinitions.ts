export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file. Returns the file with line numbers prepended (e.g., '1: import React...'). Use these line numbers for edit_lines.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The relative path to the file (e.g., 'src/App.tsx')." 
          },
          start_line: {
            type: "integer",
            description: "Optional. Start line (1-indexed) to read a specific range. Omit to read the entire file."
          },
          end_line: {
            type: "integer",
            description: "Optional. End line (1-indexed, inclusive) to read a specific range. Omit to read the entire file."
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_lines",
      description: "Replace a range of lines in an existing file with new content. This is the most token-efficient way to make targeted edits. Always read_file first to get line numbers.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The path to the file to modify." 
          },
          start_line: { 
            type: "integer", 
            description: "The first line number to replace (1-indexed, inclusive)." 
          },
          end_line: { 
            type: "integer", 
            description: "The last line number to replace (1-indexed, inclusive). Can equal start_line for single-line edits." 
          },
          new_content: { 
            type: "string", 
            description: "The replacement content. Can be more or fewer lines than the range being replaced. Use empty string to delete lines." 
          }
        },
        required: ["path", "start_line", "end_line", "new_content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "insert_lines",
      description: "Insert new lines at a specific position in a file WITHOUT removing any existing lines. The new content is inserted BEFORE the specified line.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The path to the file." 
          },
          at_line: { 
            type: "integer", 
            description: "The line number to insert BEFORE (1-indexed). Use a number greater than total lines to append at end." 
          },
          content: { 
            type: "string", 
            description: "The content to insert (can be multiple lines)." 
          }
        },
        required: ["path", "at_line", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description: "Modify a file by searching for an exact code block and replacing it. Fallback when you don't have line numbers. Prefer edit_lines when you have line numbers.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The path to the file to modify." 
          },
          search_string: { 
            type: "string", 
            description: "The exact, case-sensitive string or code block to search for." 
          },
          replace_string: { 
            type: "string", 
            description: "The new string or code block to insert in place of search_string." 
          }
        },
        required: ["path", "search_string", "replace_string"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_directory",
      description: "Create a new directory or nested directory structure recursively.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The path to the directory (e.g., 'src/components/common')." 
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_new_file",
      description: "Create a new file with specified content. ONLY for files that don't already exist. For existing files, use edit_lines or patch_file.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The path for the new file." 
          },
          content: { 
            type: "string", 
            description: "The full initial content of the file." 
          }
        },
        required: ["path", "content"]
      }
    }
  }
];
