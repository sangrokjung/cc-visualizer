// Tauri API 어댑터 — Electron의 window.electronAPI를 대체
// 모든 IPC 호출을 한 곳에서 관리
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { TeamClaudeHealth, TeamCodexPool } from './types'

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

  // ccusage 주간 통계 (이번 주 정확 집계 = `ccusage weekly` CLI 패리티)
  fetchCcusageWeekly: async (): Promise<unknown> => {
    try {
      return await invoke<unknown>('fetch_ccusage_weekly')
    } catch (error) {
      return { error: String(error), weekly: [] }
    }
  },

  // ccusage 월간 통계 (이번 달 + 전체 누적 totals = `ccusage monthly` CLI 패리티)
  fetchCcusageMonthly: async (): Promise<unknown> => {
    try {
      return await invoke<unknown>('fetch_ccusage_monthly')
    } catch (error) {
      return { error: String(error), monthly: [] }
    }
  },

  // USD→KRW 환율 (open.er-api.com 라이브, 실패 시 백엔드가 폴백 상수 반환).
  // 브라우저 dev(invoke 미존재)에선 throw → 호출부(use-usd-krw-rate)가 폴백 처리.
  fetchUsdKrwRate: async (): Promise<{ rate: number; source: string; fetchedAt: number }> => {
    return await invoke<{ rate: number; source: string; fetchedAt: number }>('fetch_usd_krw_rate')
  },

  fetchTeamClaudeHealth: async (): Promise<TeamClaudeHealth> => {
    try {
      return await invoke<TeamClaudeHealth>('fetch_teamclaude_health')
    } catch {
      return {
        checkedAt: new Date().toISOString(),
        overallStatus: 'error',
        teamclaude: {
          config: {
            present: false,
            accountCount: 0,
            switchThreshold: 0.98,
            maxConcurrentPerAccount: null,
            sessionAffinity: false,
          },
          server: {
            running: false,
            reachable: false,
            port: null,
            pid: null,
            startedAt: null,
          },
          accounts: {
            total: 0,
            configured: 0,
            active: 0,
            throttled: 0,
            exhausted: 0,
            error: 0,
            disabled: 0,
            inflight: 0,
            capacity: 0,
          },
          quota: {
            fableWeekly: {
              knownAccounts: 0,
              overThreshold: 0,
              allOverThreshold: false,
              minPercent: null,
              maxPercent: null,
              avgPercent: null,
              soonestResetAt: null,
            },
          },
          retryAfterSeconds: null,
        },
        routing: {
          currentProcessProxySet: false,
          defaultClaudeClearsProxy: false,
          teamclaudeConfigPresent: false,
        },
        hints: ['Tauri 런타임에서 Claude 진단 정보를 불러오지 못했습니다.'],
      }
    }
  },

  fetchTeamCodexPool: async (): Promise<TeamCodexPool> => {
    try {
      return await invoke<TeamCodexPool>('fetch_teamcodex_pool')
    } catch {
      return {
        checkedAt: new Date().toISOString(),
        serverReachable: false,
        serverPort: null,
        currentAccount: null,
        switchThresholdPercent: 98,
        accounts: [],
      }
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
