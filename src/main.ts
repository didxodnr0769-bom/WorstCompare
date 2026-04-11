import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
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

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

async function getFilesRecursively(dir: string, baseDir: string, excludes: string[]): Promise<string[]> {
  const files: string[] = []
  const items = await fs.readdir(dir, { withFileTypes: true })

  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    const relativePath = path.relative(baseDir, fullPath)

    if (excludes.some(pattern => relativePath.includes(pattern))) {
      continue
    }

    if (item.isDirectory()) {
      files.push(...await getFilesRecursively(fullPath, baseDir, excludes))
    } else {
      files.push(relativePath)
    }
  }
  return files
}

ipcMain.handle('compare-folders', async (_, leftDir: string, rightDir: string, excludes: string[]) => {
  const leftFiles = await getFilesRecursively(leftDir, leftDir, excludes)
  const rightFiles = await getFilesRecursively(rightDir, rightDir, excludes)

  const allFiles = Array.from(new Set([...leftFiles, ...rightFiles])).sort()
  const results = []

  for (const file of allFiles) {
    const leftPath = path.join(leftDir, file)
    const rightPath = path.join(rightDir, file)

    const leftExists = existsSync(leftPath)
    const rightExists = existsSync(rightPath)

    if (leftExists && rightExists) {
      try {
        const leftContent = await fs.readFile(leftPath, 'utf8')
        const rightContent = await fs.readFile(rightPath, 'utf8')

        // Normalizing line endings for comparison as per PRD
        const leftNormalized = leftContent.replace(/\r\n/g, '\n')
        const rightNormalized = rightContent.replace(/\r\n/g, '\n')

        if (leftNormalized === rightNormalized) {
          results.push({ path: file, status: 'same' })
        } else {
          results.push({ path: file, status: 'modified' })
        }
      } catch (err) {
        results.push({ path: file, status: 'error' })
      }
    } else if (leftExists) {
      results.push({ path: file, status: 'left-only' })
    } else {
      results.push({ path: file, status: 'right-only' })
    }
  }

  return results
})

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const normalizedPath = path.normalize(filePath)
    if (!existsSync(normalizedPath)) return null
    return await fs.readFile(normalizedPath, 'utf8')
  } catch (err) {
    console.error(err)
    return null
  }
})

ipcMain.handle('save-file', async (_, filePath: string, content: string) => {
  try {
    const normalizedPath = path.normalize(filePath)
    const dir = path.dirname(normalizedPath)
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true })
    }
    await fs.writeFile(normalizedPath, content, 'utf8')
    return true
  } catch (err) {
    console.error(err)
    return false
  }
})
