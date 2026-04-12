export interface ComparisonResult {
  path: string
  status: 'same' | 'modified' | 'left-only' | 'right-only' | 'error'
}

export interface Action {
  type: 'copy' | 'delete' | 'batch'
  side: 'left' | 'right'
  path: string
  previousStatus?: ComparisonResult['status']
  previousContent?: string | null
  subActions?: Action[]
}

export interface IElectronAPI {
  selectFolder: () => Promise<string | null>
  compareFolders: (
    leftDir: string,
    rightDir: string,
    excludes: string[]
  ) => Promise<ComparisonResult[]>
  readFile: (filePath: string) => Promise<string | null>
  saveFile: (filePath: string, content: string) => Promise<boolean>
  copyItem: (src: string, dest: string) => Promise<boolean>
  deleteItem: (target: string) => Promise<boolean>
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}
