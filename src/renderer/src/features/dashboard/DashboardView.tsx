import { useState } from 'react'
import { HeroSection } from './HeroSection'
import { StatCards } from './StatCards'
import { SystemRadar } from './SystemRadar'
import { ModelRadialBar } from './ModelRadialBar'
import { SkillTreemap } from './SkillTreemap'
import { ToolUsageChart } from './ToolUsageChart'
import { PipelineCards } from './PipelineCards'
import { McpGrid } from './McpGrid'
import { MemoryPanel } from './MemoryPanel'

// 팔란티어 온톨로지 대시보드 — 스크롤 가능한 풀 레이아웃
export default function DashboardView() {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const result = await window.electronAPI?.rescanSystem()
      if (result?.ok) window.location.reload()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: '#111418' }}>
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* 새로고침 버튼 (우상단) */}
        <div className="flex justify-end">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-[11px] px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: '#252A31', color: refreshing ? '#5F6B7C' : '#ABB3BF', border: '1px solid #404854' }}
          >
            {refreshing ? '스캔 중...' : '⟳ 데이터 새로고침'}
          </button>
        </div>

        {/* 1. 히어로 섹션 */}
        <HeroSection />

        {/* 2. 통계 카드 6개 (3x2 그리드) */}
        <StatCards />

        {/* 3. 차트 행 1: 레이더 + 모델 분포 */}
        <div className="grid grid-cols-2 gap-6">
          <SystemRadar />
          <ModelRadialBar />
        </div>

        {/* 4. 차트 행 2: 트리맵 + 도구 사용 */}
        <div className="grid grid-cols-2 gap-6">
          <SkillTreemap />
          <ToolUsageChart />
        </div>

        {/* 5. 파이프라인 (풀 너비) */}
        <PipelineCards />

        {/* 6. 하단 행: MCP + 메모리 */}
        <div className="grid grid-cols-2 gap-6">
          <McpGrid />
          <MemoryPanel />
        </div>
      </div>
    </div>
  )
}
