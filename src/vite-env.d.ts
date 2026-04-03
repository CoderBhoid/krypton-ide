/// <reference types="vite/client" />

// Allow importing raw text files with ?raw suffix
declare module '*.txt?raw' {
  const content: string;
  export default content;
}
