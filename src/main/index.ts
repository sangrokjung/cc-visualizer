import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { startFileWatcher } from './file-watcher'
import { startSessionWatcher } from './session-watcher'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'CC Visualizer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC: 파일 읽기
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    if (!existsSync(filePath)) return { ok: false, error: 'File not found' }
    const content = readFileSync(filePath, 'utf-8')
    return { ok: true, content }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// IPC: 디렉토리 파일 목록
ipcMain.handle('list-dir', async (_event, dirPath: string) => {
  try {
    if (!existsSync(dirPath)) return { ok: false, error: 'Dir not found' }
    const files = readdirSync(dirPath)
    return { ok: true, files }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// IPC: 시스템 데이터 경로
ipcMain.handle('get-system-paths', async () => {
  const home = process.env.HOME || ''
  return {
    agents: join(home, '.claude/agents'),
    settings: join(home, '.claude/settings.json'),
    rules: join(home, 'qjc-office/dotclaude/rules'),
    memory: join(home, `.claude/projects/${process.cwd().replace(/\//g, '-')}/memory`),
    agentMemory: join(home, '.claude/agent-memory'),
    workLog: join(home, '.claude/work-log'),
    pipeline: join(home, 'qjc-office/dotclaude/reference/agent-pipeline.md')
  }
})

app.whenReady().then(() => {
  createWindow()
  if (mainWindow) {
    startFileWatcher(mainWindow)
    startSessionWatcher(mainWindow)
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
