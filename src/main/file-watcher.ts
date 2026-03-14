import { watch } from 'chokidar'
import { existsSync } from 'fs'
import { join } from 'path'
import type { BrowserWindow } from 'electron'

const home = process.env.HOME ?? ''

const WATCH_PATHS = [
  join(home, '.claude/work-log'),
  join(home, '.claude/agent-memory'),
]

export function startFileWatcher(mainWindow: BrowserWindow): void {
  const validPaths = WATCH_PATHS.filter((p) => {
    const exists = existsSync(p)
    if (!exists) {
      console.log(`[file-watcher] 경로 없음, 무시: ${p}`)
    }
    return exists
  })

  if (validPaths.length === 0) {
    console.log('[file-watcher] 감시할 경로가 없습니다')
    return
  }

  const watcher = watch(validPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 3,
  })

  watcher.on('add', (path) => sendEvent(mainWindow, path, 'add'))
  watcher.on('change', (path) => sendEvent(mainWindow, path, 'change'))
  watcher.on('unlink', (path) => sendEvent(mainWindow, path, 'unlink'))
  watcher.on('error', (err) => console.error('[file-watcher] 오류:', err))

  console.log(`[file-watcher] 감시 시작: ${validPaths.join(', ')}`)
}

function sendEvent(
  win: BrowserWindow,
  path: string,
  type: 'add' | 'change' | 'unlink'
): void {
  if (win.isDestroyed()) return
  win.webContents.send('file-changed', { path, type, timestamp: Date.now() })
}
