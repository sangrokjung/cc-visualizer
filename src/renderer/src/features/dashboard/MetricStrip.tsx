import { useMemo } from 'react'
import { useSystemDataContext } from '../../lib/DataProvider'

// 메트릭 정의 — 6개 핵심 오브젝트 타입 카운트
const METRICS = [
  { key: 'agentCount' as const, label: '에이전트' },
  { key: 'skillCount' as const, label: '스킬' },
  { key: 'hookCount' as const, label: '훅' },
  { key: 'ruleCount' as const, label: '규칙' },
  { key: 'pipelineCount' as const, label: '파이프라인' },
  { key: 'mcpServerCount' as const, label: 'MCP' }
]

// 스캔 타임스탬프 포맷 (KST)
function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

// 상단 메트릭 바 — 시스템 상태 요약을 가로 한 줄로 표시
export function MetricStrip() {
  const { systemData } = useSystemDataContext()
  const timestamp = useMemo(
    () => formatTimestamp(systemData.scanTimestamp),
    [systemData.scanTimestamp]
  )

  return (
    <div
      className="flex items-center h-10 px-4"
      style={{
        backgroundColor: '#1C2127',
        borderBottom: '1px solid #404854'
      }}
    >
      {/* 좌측: 시스템 온라인 표시 */}
      <div className="flex items-center gap-1.5 mr-6">
        {/* 녹색 펄스 도트 */}
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: '#29A634' }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: '#29A634' }}
          />
        </span>
        <span
          className="text-xs font-bold tracking-wider"
          style={{ color: '#29A634' }}
        >
          시스템 온라인
        </span>
      </div>

      {/* 중앙: 6개 메트릭 */}
      <div className="flex items-center flex-1">
        {METRICS.map((m, i) => (
          <div key={m.key} className="flex items-center">
            <div className="flex flex-col items-center px-4 py-1 rounded transition-colors hover:bg-[#252A31]">
              <span
                className="text-base font-mono font-bold leading-tight"
                style={{ color: '#F6F7F9' }}
              >
                {systemData.stats[m.key]}
              </span>
              <span
                className="text-xs leading-tight"
                style={{ color: '#ABB3BF' }}
              >
                {m.label}
              </span>
            </div>
            {/* 마지막 메트릭 뒤에는 구분선 없음 */}
            {i < METRICS.length - 1 && (
              <div
                className="h-5"
                style={{ borderRight: '1px solid #404854' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* 우측: 스캔 타임스탬프 */}
      <span
        className="text-xs font-mono ml-4"
        style={{ color: '#ABB3BF' }}
      >
        {timestamp}
      </span>
    </div>
  )
}
