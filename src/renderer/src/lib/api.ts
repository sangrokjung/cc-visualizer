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

  // 프론트 mount 후 listen 등록 → 명시적 백필 요청 (race condition 방어)
  backfillSession: async (): Promise<number> => {
    try {
      return await invoke<number>('backfill_session')
    } catch {
      return 0
    }
  },

  // ccusage 일자별 통계 — Claude Code stats 데이터
  // Tauri 환경에서 invoke로만 동작. 브라우저 dev에선 빈 daily 반환 (스냅샷은 개인 비용 데이터라 git에서 제외).
  fetchCcusageDaily: async (): Promise<unknown> => {
    try {
      return await invoke<unknown>('fetch_ccusage_daily')
    } catch (error) {
      return { error: String(error), daily: [] }
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
  // 브라우저 dev에서는 invoke 자체가 undefined → 정적 import 폴백
  loadSystemData: async (): Promise<unknown> => {
    try {
      return await invoke<unknown>('load_system_data')
    } catch {
      const m = await import('../data/system-data.json')
      return (m as { default?: unknown }).default ?? m
    }
  },
  loadUsageData: async (): Promise<unknown> => {
    try {
      return await invoke<unknown>('load_usage_data')
    } catch {
      const m = await import('../data/usage-stats.json')
      return (m as { default?: unknown }).default ?? m
    }
  },
  loadExternalSystems: async (): Promise<unknown> => {
    try {
      return await invoke<unknown>('load_external_systems')
    } catch {
      try {
        const m = await import('../data/external-systems.json')
        return (m as { default?: unknown }).default ?? m
      } catch {
        return { systems: [] }
      }
    }
  },

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
