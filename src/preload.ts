import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  compareFolders: (leftDir: string, rightDir: string, excludes: string[]) => 
    ipcRenderer.invoke('compare-folders', leftDir, rightDir, excludes),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('save-file', filePath, content),
})
