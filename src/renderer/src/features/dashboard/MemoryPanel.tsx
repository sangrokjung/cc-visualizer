import { useSystemDataContext } from '../../lib/DataProvider'

// 메모리 시스템 시각화: Auto Memory, Agent Memory, Personal OS
export function MemoryPanel() {
  const { systemData } = useSystemDataContext()
  const { autoMemory, agentMemory, personalOS } = systemData.memory

  // 메모리 있는 에이전트와 없는 에이전트 분리
  const agentsWithMemory = agentMemory.agents.filter((a) => a.fileCount > 0)
  const emptyAgentCount = agentMemory.agents.filter((a) => a.fileCount === 0).length

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: '#1C2127', borderColor: '#404854' }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#F6F7F9' }}>
        메모리 시스템
      </h3>

      <div className="space-y-4">
        {/* Auto Memory */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: '#2D72D2' }}>◉</span>
            <span className="text-xs font-medium" style={{ color: '#F6F7F9' }}>
              자동 메모리
            </span>
          </div>
          <p
            className="text-xs font-mono truncate mb-2"
            style={{ color: '#738091' }}
          >
            {autoMemory.path}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {autoMemory.files.map((file) => (
              <span
                key={file}
                className="rounded px-2 py-0.5 text-xs"
                style={{ backgroundColor: '#252A31', color: '#ABB3BF' }}
              >
                {file}
              </span>
            ))}
          </div>
        </div>

        {/* Agent Memory */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: '#7961DB' }}>◆</span>
            <span className="text-xs font-medium" style={{ color: '#F6F7F9' }}>
              에이전트 메모리
            </span>
          </div>
          <div className="space-y-1.5">
            {agentsWithMemory.map((agent) => (
              <div key={agent.name} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#ABB3BF' }}>
                  {agent.name}
                </span>
                <span
                  className="text-xs rounded-full px-2 py-0.5"
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
          {emptyAgentCount > 0 && (
            <p className="text-xs mt-2" style={{ color: '#5F6B7C' }}>
              외 {emptyAgentCount}개 에이전트 (메모리 없음)
            </p>
          )}
        </div>

        {/* Personal OS */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: '#29A634' }}>●</span>
            <span className="text-xs font-medium" style={{ color: '#F6F7F9' }}>
              퍼스널 OS
            </span>
          </div>
          <p
            className="text-xs font-mono truncate"
            style={{ color: '#738091' }}
          >
            {personalOS.path}
          </p>
        </div>
      </div>
    </div>
  )
}
