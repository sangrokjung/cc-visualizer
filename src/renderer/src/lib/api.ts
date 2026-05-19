// Tauri API 어댑터 — Electron의 window.electronAPI를 대체
// 모든 IPC 호출을 한 곳에서 관리
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export const api = {
  // Commands (Request/Response)
  readFile: async (path: string): Promise<{ ok: boolean; content?: string; error?: string }> => {
    try {
      const content = await invoke<string>('read_file', { filePath: path })
      return { ok: true, content }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  },

  listDir: async (path: string): Promise<{ ok: boolean; files?: string[]; error?: string }> => {
    try {
      const files = await invoke<string[]>('list_dir', { dirPath: path })
      return { ok: true, files }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  },

  getSystemPaths: (): Promise<Record<string, string>> => {
    return invoke<Record<string, string>>('get_system_paths')
  },

  rescanSystem: async (): Promise<{ ok: boolean; data?: unknown; error?: string }> => {
    try {
      const data = await invoke<unknown>('rescan_system')
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  },

  rescanUsage: async (): Promise<{ ok: boolean; data?: unknown; error?: string }> => {
    try {
      const data = await invoke<unknown>('rescan_usage')
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  },

  // Data Loading (동적 — 정적 import 대체)
  loadSystemData: (): Promise<unknown> => invoke<unknown>('load_system_data'),
  loadUsageData: (): Promise<unknown> => invoke<unknown>('load_usage_data'),
  loadExternalSystems: (): Promise<unknown> => invoke<unknown>('load_external_systems'),

  // Events (Streaming)
  onFileChanged: (callback: (event: { path: string; type: string; timestamp: number }) => void): Promise<UnlistenFn> => {
    return listen('file-changed', (e) => callback(e.payload as { path: string; type: string; timestamp: number }))
  },

  onSessionEvent: (callback: (event: unknown) => void): Promise<UnlistenFn> => {
    return listen('session-event', (e) => callback(e.payload))
  },

  onSessionId: (callback: (id: string) => void): Promise<UnlistenFn> => {
    return listen('session-id', (e) => callback(e.payload as string))
  },

  // claude-system-changed 이벤트 리스너 — ~/.claude 디렉토리 변경 시 발생
  onClaudeSystemChanged: (callback: () => void): Promise<UnlistenFn> => {
    return listen('claude-system-changed', () => callback())
  },
}
