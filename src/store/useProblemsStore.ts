import { create } from 'zustand';

export interface Problem {
  id: string;
  filePath: string;
  fileName: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  source: string; // e.g. 'typescript', 'css', 'json'
}

interface ProblemsState {
  problems: Problem[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  
  setProblems: (problems: Problem[]) => void;
  clearProblems: () => void;
  getProblemsForFile: (fileName: string) => Problem[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

function computeCounts(problems: Problem[]) {
  return {
    errorCount: problems.filter(p => p.severity === 'error').length,
    warningCount: problems.filter(p => p.severity === 'warning').length,
    infoCount: problems.filter(p => p.severity === 'info' || p.severity === 'hint').length,
  };
}

export const useProblemsStore = create<ProblemsState>()((set, get) => ({
  problems: [],
  errorCount: 0,
  warningCount: 0,
  infoCount: 0,

  setProblems: (problems) => set({ problems, ...computeCounts(problems) }),

  clearProblems: () => set({ problems: [], errorCount: 0, warningCount: 0, infoCount: 0 }),

  getProblemsForFile: (fileName: string) => {
    return get().problems.filter(p => p.fileName === fileName);
  },
}));

// Helper to extract problems from Monaco markers
export function extractMonacoProblems(monaco: any): Problem[] {
  if (!monaco) return [];

  const markers = monaco.editor.getModelMarkers({});
  return markers.map((marker: any) => {
    const uri = marker.resource?.path || '';
    const fileName = uri.split('/').pop() || uri;

    let severity: Problem['severity'] = 'info';
    // Monaco MarkerSeverity: 1=Hint, 2=Info, 4=Warning, 8=Error
    if (marker.severity === 8) severity = 'error';
    else if (marker.severity === 4) severity = 'warning';
    else if (marker.severity === 2) severity = 'info';
    else if (marker.severity === 1) severity = 'hint';

    return {
      id: generateId(),
      filePath: uri,
      fileName,
      severity,
      message: marker.message,
      startLine: marker.startLineNumber,
      startCol: marker.startColumn,
      endLine: marker.endLineNumber,
      endCol: marker.endColumn,
      source: marker.source || 'monaco',
    };
  });
}
