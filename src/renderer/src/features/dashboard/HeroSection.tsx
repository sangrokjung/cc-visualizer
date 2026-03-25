import systemData from '../../data/system-data.json'

// 스캔 타임스탬프를 로컬 시간으로 포맷
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function HeroSection() {
  const { stats, scanTimestamp } = systemData

  const totalEntities =
    stats.agentCount +
    stats.skillCount +
    stats.hookCount +
    stats.ruleCount +
    stats.pipelineCount +
    stats.mcpServerCount

  return (
    <div
      className="rounded-2xl p-6 border"
      style={{
        background:
          'linear-gradient(135deg, rgba(45,114,210,0.15) 0%, rgba(121,97,219,0.1) 50%, rgba(45,114,210,0.15) 100%)',
        borderColor: 'rgba(45,114,210,0.2)'
      }}
    >
      <div className="flex items-center justify-between">
        {/* 좌측: 제목 + 타임스탬프 */}
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F6F7F9' }}>
            클로드 코드 시스템 개요
          </h1>
          <p className="text-xs mt-1" style={{ color: '#738091' }}>
            최종 스캔: {formatTimestamp(scanTimestamp)}
          </p>
        </div>

        {/* 우측: 핵심 수치 6개 + 총합 */}
        <div className="flex items-center gap-5">
          <div className="text-center">
            <span className="text-2xl font-bold" style={{ color: '#F6F7F9' }}>
              {stats.agentCount}
            </span>
            <p className="text-xs" style={{ color: '#ABB3BF' }}>
              에이전트
            </p>
          </div>
          <span style={{ color: '#404854' }}>|</span>
          <div className="text-center">
            <span className="text-2xl font-bold" style={{ color: '#F6F7F9' }}>
              {stats.skillCount}
            </span>
            <p className="text-xs" style={{ color: '#ABB3BF' }}>
              스킬
            </p>
          </div>
          <span style={{ color: '#404854' }}>|</span>
          <div className="text-center">
            <span className="text-2xl font-bold" style={{ color: '#F6F7F9' }}>
              {stats.hookCount}
            </span>
            <p className="text-xs" style={{ color: '#ABB3BF' }}>
              훅
            </p>
          </div>
          <span style={{ color: '#404854' }}>|</span>
          <div className="text-center">
            <span className="text-2xl font-bold" style={{ color: '#F6F7F9' }}>
              {stats.ruleCount}
            </span>
            <p className="text-xs" style={{ color: '#ABB3BF' }}>
              규칙
            </p>
          </div>
          <span style={{ color: '#404854' }}>|</span>
          <div className="text-center">
            <span className="text-2xl font-bold" style={{ color: '#F6F7F9' }}>
              {stats.pipelineCount}
            </span>
            <p className="text-xs" style={{ color: '#ABB3BF' }}>
              파이프라인
            </p>
          </div>
          <span style={{ color: '#404854' }}>|</span>
          <div className="text-center">
            <span className="text-2xl font-bold" style={{ color: '#F6F7F9' }}>
              {stats.mcpServerCount}
            </span>
            <p className="text-xs" style={{ color: '#ABB3BF' }}>
              MCP
            </p>
          </div>
          <span style={{ color: '#404854' }}>|</span>
          <div className="text-center">
            <span className="text-lg font-semibold" style={{ color: '#ABB3BF' }}>
              {totalEntities}
            </span>
            <p className="text-xs" style={{ color: '#738091' }}>
              총합
            </p>
          </div>
        </div>
      </div>

      {/* 하단: 시스템 상태 표시 */}
      <div className="flex items-center gap-2 mt-4">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: '#29A634' }}
          />
          <span
            className="relative inline-flex rounded-full h-2.5 w-2.5"
            style={{ backgroundColor: '#29A634' }}
          />
        </span>
        <span className="text-xs" style={{ color: '#29A634' }}>
          시스템 활성
        </span>
      </div>
    </div>
  )
}
