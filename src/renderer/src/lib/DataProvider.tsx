// 동적 데이터 공급 — 정적 JSON import를 대체
// Rust 커맨드로 파일시스템에서 직접 읽어 Context로 전역 공유
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from './api'

// 정적 JSON을 초기값/폴백으로만 사용
import staticSystemData from '../data/system-data.json'
import staticUsageData from '../data/usage-stats.json'
import staticExternalSystems from '../data/external-systems.json'

interface DataContextType {
  systemData: typeof staticSystemData
  usageData: typeof staticUsageData
  externalSystems: typeof staticExternalSystems
  refreshSystem: () => Promise<void>
  refreshUsage: () => Promise<void>
  loading: boolean
}

const DataContext = createContext<DataContextType | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [systemData, setSystemData] = useState(staticSystemData)
  const [usageData, setUsageData] = useState(staticUsageData)
  const [externalSystems, setExternalSystems] = useState(staticExternalSystems)
  const [loading, setLoading] = useState(false)

  // 앱 시작/새로고침 시 2-Phase 로드:
  //   Phase 1 — 즉시 캐시 표시 (load_system_data: 기존 JSON 읽기)
  //   Phase 2 — 백그라운드 rescan (npm run scan → 최신 데이터로 자동 갱신)
  // Tauri 환경에서만 Phase 2 동작. Vite dev/브라우저는 staticSystemData 폴백.
  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    // Phase 1: 즉시 캐시 로드
    try {
      const [sys, usage, ext] = await Promise.all([
        api.loadSystemData().catch(() => null),
        api.loadUsageData().catch(() => null),
        api.loadExternalSystems().catch(() => null),
      ])
      if (sys) setSystemData(sys as typeof staticSystemData)
      if (usage) setUsageData(usage as typeof staticUsageData)
      if (ext) setExternalSystems(ext as typeof staticExternalSystems)
    } catch {
      // 폴백: 정적 데이터 유지
    }

    // Phase 2: 백그라운드 rescan (Tauri 환경에서만, 비차단)
    api
      .rescanSystem()
      .then((res) => {
        if (res.ok && res.data) {
          setSystemData(res.data as typeof staticSystemData)
        }
      })
      .catch(() => {
        // 폴백: Phase 1 데이터 유지 (Vite dev 등 비-Tauri 환경)
      })
  }

  const refreshSystem = useCallback(async () => {
    setLoading(true)
    try {
      await api.rescanSystem()
      const data = await api.loadSystemData()
      if (data) setSystemData(data as typeof staticSystemData)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshUsage = useCallback(async () => {
    setLoading(true)
    try {
      await api.rescanUsage()
      const data = await api.loadUsageData()
      if (data) setUsageData(data as typeof staticUsageData)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <DataContext.Provider value={{ systemData, usageData, externalSystems, refreshSystem, refreshUsage, loading }}>
      {children}
    </DataContext.Provider>
  )
}

// 커스텀 훅 — 각 컴포넌트에서 사용
export function useSystemDataContext() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useSystemDataContext must be used within DataProvider')
  return ctx
}
