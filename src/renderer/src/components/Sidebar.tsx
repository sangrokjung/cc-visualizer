import { useState, useEffect, useCallback } from 'react'
import type { ViewType } from '../App'

const views: { id: ViewType; label: string; icon: string }[] = [
  { id: 'dashboard', label: '시스템 개요', icon: '📊' },
  { id: 'agent-map', label: '에이전트 맵', icon: '🔗' },
  { id: 'architecture', label: '시스템 아키텍처', icon: '🏗' },
  { id: 'live-monitor', label: '실시간 모니터', icon: '📡' },
  { id: 'catalog', label: '카탈로그', icon: '📚' },
  { id: 'systems', label: '시스템', icon: '⚙' }
]

const AUTO_REFRESH_MS = 5 * 60 * 1000

type Props = {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
}

export default function Sidebar({ activeView, onViewChange }: Props) {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const handleRefresh = useCallback(() => {
    setLastRefresh(new Date())
    window.location.reload()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(handleRefresh, AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [autoRefresh, handleRefresh])

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">CC Visualizer</h1>
        <p className="text-xs text-gray-500 mt-1">Claude Code System</p>
      </div>
      <nav className="flex-1 p-2">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
              activeView === v.id
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <span className="mr-2">{v.icon}</span>
            {v.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800 space-y-2">
        <button
          onClick={handleRefresh}
          className="w-full text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
        >
          데이터 새로고침
        </button>
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-gray-600">자동 갱신 (5분)</span>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              autoRefresh
                ? 'bg-green-600/20 text-green-400'
                : 'bg-gray-700 text-gray-500'
            }`}
          >
            {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 px-1">
          {lastRefresh.toLocaleTimeString('ko-KR', { hour12: false })}
        </p>
      </div>
    </aside>
  )
}
