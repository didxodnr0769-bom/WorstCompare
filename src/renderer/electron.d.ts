export interface ComparisonResult {
  path: string
  status: 'same' | 'modified' | 'left-only' | 'right-only' | 'error'
}

export interface IElectronAPI {
  selectFolder: () => Promise<string | null>
  compareFolders: (leftDir: string, rightDir: string, excludes: string[]) => Promise<ComparisonResult[]>
  readFile: (filePath: string) => Promise<string | null>
  saveFile: (filePath: string, content: string) => Promise<boolean>
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}
