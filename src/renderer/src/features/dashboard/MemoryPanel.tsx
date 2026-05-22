import { useState } from 'react'
import { useSystemDataContext } from '../../lib/DataProvider'

// 자동 메모리 칩 기본 노출 개수. 그 이상은 토글로 펼침.
const AUTO_FILES_PREVIEW = 12
// 에이전트 메모리 상위 N개 (파일 수 기준). 사용자가 한 화면에서 인지 가능한 범위.
const AGENT_TOP_N = 10

// 메모리 시스템 시각화: Auto Memory, Agent Memory, Personal OS
export function MemoryPanel() {
  const { systemData } = useSystemDataContext()
  const { autoMemory, agentMemory, personalOS } = systemData.memory
  const [autoExpanded, setAutoExpanded] = useState(false)

  // 메모리 있는 에이전트와 없는 에이전트 분리 + 파일 수 내림차순
  const agentsWithMemory = agentMemory.agents
    .filter((a) => a.fileCount > 0)
    .sort((a, b) => b.fileCount - a.fileCount)
  const emptyAgentCount = agentMemory.agents.filter((a) => a.fileCount === 0).length
  const topAgents = agentsWithMemory.slice(0, AGENT_TOP_N)
  const hiddenAgents = Math.max(0, agentsWithMemory.length - AGENT_TOP_N)

  const visibleAutoFiles = autoExpanded
    ? autoMemory.files
    : autoMemory.files.slice(0, AUTO_FILES_PREVIEW)
  const hiddenAutoFiles = Math.max(0, autoMemory.files.length - AUTO_FILES_PREVIEW)

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: '#1C2127', borderColor: '#404854' }}
    >
      <h3 className="text-base font-semibold mb-4" style={{ color: '#F6F7F9' }}>
        메모리 시스템
      </h3>

      <div className="space-y-5">
        {/* Auto Memory */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-center gap-2">
              <span style={{ color: '#2D72D2' }}>◉</span>
              <span className="text-sm font-medium" style={{ color: '#F6F7F9' }}>
                자동 메모리
              </span>
            </div>
            <span className="text-xs" style={{ color: '#5F6B7C' }}>
              {autoMemory.files.length}개 파일
            </span>
          </div>
          <p
            className="text-xs font-mono truncate mb-2.5"
            style={{ color: '#5F6B7C' }}
            title={autoMemory.path}
          >
            {autoMemory.path}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleAutoFiles.map((file) => (
              <span
                key={file}
                className="rounded px-2 py-1 text-xs leading-snug"
                style={{ backgroundColor: '#252A31', color: '#ABB3BF' }}
              >
                {file}
              </span>
            ))}
            {hiddenAutoFiles > 0 && (
              <button
                type="button"
                onClick={() => setAutoExpanded((v) => !v)}
                className="rounded px-2 py-1 text-xs leading-snug transition-colors"
                style={{
                  backgroundColor: 'rgba(45,114,210,0.15)',
                  color: '#8ABBFF',
                  border: '1px solid rgba(45,114,210,0.3)',
                }}
              >
                {autoExpanded ? '접기' : `+${hiddenAutoFiles}개 더 보기`}
              </button>
            )}
          </div>
        </div>

        {/* Agent Memory */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-center gap-2">
              <span style={{ color: '#7961DB' }}>◆</span>
              <span className="text-sm font-medium" style={{ color: '#F6F7F9' }}>
                에이전트 메모리
              </span>
            </div>
            <span className="text-xs" style={{ color: '#5F6B7C' }}>
              상위 {topAgents.length} / 총 {agentsWithMemory.length}
            </span>
          </div>
          <div className="space-y-2">
            {topAgents.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center justify-between gap-2 min-w-0"
              >
                <span className="text-sm truncate" style={{ color: '#ABB3BF' }}>
                  {agent.name}
                </span>
                <span
                  className="text-xs font-semibold tabular-nums rounded-full px-2 py-0.5 shrink-0"
                  style={
                    agent.fileCount > 10
                      ? {
                          backgroundColor: 'rgba(45,114,210,0.2)',
                          color: '#2D72D2'
                        }
                      : {
                          backgroundColor: '#252A31',
                          color: '#ABB3BF'
                        }
                  }
                >
                  {agent.fileCount}
                </span>
              </div>
            ))}
          </div>
          {(hiddenAgents > 0 || emptyAgentCount > 0) && (
            <p className="text-xs mt-3" style={{ color: '#5F6B7C' }}>
              {hiddenAgents > 0 && `+ 다른 ${hiddenAgents}개 에이전트`}
              {hiddenAgents > 0 && emptyAgentCount > 0 && ' · '}
              {emptyAgentCount > 0 && `${emptyAgentCount}개 미사용`}
            </p>
          )}
        </div>

        {/* Personal OS */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: '#29A634' }}>●</span>
            <span className="text-sm font-medium" style={{ color: '#F6F7F9' }}>
              퍼스널 OS
            </span>
          </div>
          <p
            className="text-xs font-mono truncate"
            style={{ color: '#5F6B7C' }}
            title={personalOS.path}
          >
            {personalOS.path}
          </p>
        </div>
      </div>
    </div>
  )
}
