import { useState, useCallback, useEffect, useRef } from 'react'
import { useSystemDataContext } from '../../lib/DataProvider'
import { HeroSection } from './HeroSection'
import { LiveActivityPulse } from './LiveActivityPulse'
import { TokenFlowMini } from './TokenFlowMini'
import { SystemPulse } from './SystemPulse'
import { StatCards } from './StatCards'
import { SystemRadar } from './SystemRadar'
import { ModelRadialBar } from './ModelRadialBar'
import { SkillTreemap } from './SkillTreemap'
import { ToolUsageChart } from './ToolUsageChart'
import { PipelineCards } from './PipelineCards'
import { McpGrid } from './McpGrid'
import { MemoryPanel } from './MemoryPanel'
import { RefreshToast } from '../../components/RefreshToast'

// 6개 도메인 카운트 합산
type Stats = typeof import('../../data/system-data.json')['stats']

function sumStats(s: Stats): number {
  return (
    s.agentCount +
    s.skillCount +
    s.hookCount +
    s.ruleCount +
    s.pipelineCount +
    s.mcpServerCount
  )
}

// 팔란티어 온톨로지 대시보드 — 스크롤 가능한 풀 레이아웃
// 새로고침 시 시각 피드백 강화 — 회전 애니메이션 + 변화 감지 토스트
export default function DashboardView() {
  const { systemData, refreshSystem, loading: refreshing } = useSystemDataContext()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  // 새로고침 전 stats 스냅샷 — 비교 기준점
  const beforeStatsRef = useRef<Stats | null>(null)

  const handleRefresh = useCallback(async () => {
    beforeStatsRef.current = { ...systemData.stats }
    await refreshSystem()
  }, [refreshSystem, systemData.stats])

  // refreshing 종료 시점에 토스트 발사 — useEffect로 안전하게 처리
  useEffect(() => {
    if (refreshing) return
    const before = beforeStatsRef.current
    if (!before) return
    const after = systemData.stats
    const diff = sumStats(after) - sumStats(before)
    if (diff === 0) {
      setToastMessage('데이터가 최신 상태입니다 — 변화 없음')
    } else if (diff > 0) {
      setToastMessage(`+${diff}개 신규 엔티티 감지 — 시스템이 확장되었습니다`)
    } else {
      setToastMessage(`${diff}개 엔티티 변동 — 정리되었습니다`)
    }
    // 한 번만 발사 후 ref 초기화
    beforeStatsRef.current = null
  }, [refreshing, systemData.stats])

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: '#111418' }}>
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* 새로고침 버튼 (우상단) — 회전 애니메이션 + 단축키 힌트 */}
        <div className="flex justify-end items-center gap-3">
          <span className="text-[10px]" style={{ color: '#5F6B7C' }}>
            <kbd
              className="px-1.5 py-0.5 rounded font-mono text-[10px]"
              style={{ backgroundColor: '#252A31', border: '1px solid #404854' }}
            >
              ⌘R
            </kbd>{' '}
            또는{' '}
            <kbd
              className="px-1.5 py-0.5 rounded font-mono text-[10px]"
              style={{ backgroundColor: '#252A31', border: '1px solid #404854' }}
            >
              F5
            </kbd>
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            className="text-[11px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-medium"
            style={{
              backgroundColor: refreshing ? '#1C2127' : '#2D72D2',
              color: refreshing ? '#5F6B7C' : '#FFFFFF',
              border: `1px solid ${refreshing ? '#404854' : '#2D72D2'}`,
              boxShadow: refreshing ? 'none' : '0 0 12px rgba(45,114,210,0.4)'
            }}
          >
            <span
              className="inline-block"
              style={{
                animation: refreshing ? 'spin 0.8s linear infinite' : 'none'
              }}
            >
              ⟳
            </span>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            {refreshing ? '시스템 스캔 중...' : '데이터 새로고침'}
          </button>
        </div>

        {/* 1. 히어로 섹션 (메가 카운트 + 도메인 칩) */}
        <HeroSection />

        {/* 2. 라이브 활동 (현재 작동 중인 Claude Code) + 토큰/비용 흐름 — 신규 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LiveActivityPulse />
          <TokenFlowMini />
        </div>

        {/* 3. 시스템 펄스 (별자리 버블 차트) */}
        <SystemPulse />

        {/* 3. 통계 카드 6개 (3x2 그리드) */}
        <StatCards />

        {/* 4. 차트 행 1: 레이더 + 모델 분포 */}
        <div className="grid grid-cols-2 gap-6">
          <SystemRadar />
          <ModelRadialBar />
        </div>

        {/* 5. 차트 행 2: 트리맵 + 도구 사용 */}
        <div className="grid grid-cols-2 gap-6">
          <SkillTreemap />
          <ToolUsageChart />
        </div>

        {/* 6. 파이프라인 (풀 너비) */}
        <PipelineCards />

        {/* 7. 하단 행: MCP + 메모리 */}
        <div className="grid grid-cols-2 gap-6">
          <McpGrid />
          <MemoryPanel />
        </div>
      </div>

      {toastMessage && (
        <RefreshToast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  )
}
