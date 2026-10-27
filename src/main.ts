import { app, BrowserWindow, ipcMain, dialog, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ComparisonFileSystem } from './fileSystem'

let mainWindow: BrowserWindow | null = null
let comparison: ComparisonFileSystem | null = null
let comparisonRequest = 0
const rendererUrl = new URL(
  process.env.VITE_DEV_SERVER_URL || pathToFileURL(path.join(__dirname, '../dist/index.html')).href
).href

function assertSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    !frame ||
    frame !== event.sender.mainFrame ||
    frame.url !== rendererUrl
  ) {
    throw new Error('허용되지 않은 앱 화면의 요청입니다.')
  }
}

function activeComparison(): ComparisonFileSystem {
  if (!comparison) throw new Error('먼저 폴더를 비교해 주세요.')
  return comparison
}

function createWindow() {
  comparison = null
  comparisonRequest++
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', event => event.preventDefault())
  mainWindow.on('closed', () => {
    comparison = null
    comparisonRequest++
    mainWindow = null
  })
  mainWindow.loadURL(rendererUrl)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('select-folder', async event => {
  assertSender(event)
  const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle(
  'compare-folders',
  async (event, left: string, right: string, excludes: string[]) => {
    assertSender(event)
    const request = ++comparisonRequest
    comparison = null
    const next = await ComparisonFileSystem.create(left, right)
    const results = await next.compare(excludes)
    if (request !== comparisonRequest) throw new Error('비교 요청이 변경되었습니다.')
    comparison = next
    return results
  }
)

ipcMain.handle('read-file', async (event, input: string) => {
  assertSender(event)
  try {
    return await activeComparison().readFile(input)
  } catch (error) {
    console.error('Read failed:', error)
    return null
  }
})

ipcMain.handle('save-file', async (event, input: string, content: string) => {
  assertSender(event)
  try {
    await activeComparison().saveFile(input, content)
    return true
  } catch (error) {
    console.error('Save failed:', error)
    return false
  }
})

ipcMain.handle('copy-item', async (event, source: string, destination: string) => {
  assertSender(event)
  try {
    await activeComparison().copyItem(source, destination)
    return true
  } catch (error) {
    console.error('Copy failed:', error)
    return false
  }
})

ipcMain.handle('delete-item', async (event, input: string) => {
  assertSender(event)
  try {
    await activeComparison().deleteItem(input)
    return true
  } catch (error) {
    console.error('Delete failed:', error)
    return false
  }
})
