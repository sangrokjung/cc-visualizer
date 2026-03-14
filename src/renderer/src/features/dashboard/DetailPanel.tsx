import { useState } from 'react'
import systemData from '../../data/system-data.json'

// 팔란티어 카테고리 색상
const PALANTIR_CATEGORY_COLORS: Record<string, string> = {
  marketing: '#29A634',
  review: '#7961DB',
  development: '#2D72D2',
  creative: '#DB2C6F',
  research: '#00A396',
  business: '#D1980B',
  legal: '#D33D17',
  operations: '#147EB3'
}

// 모델별 뱃지 스타일
function getModelBadgeStyle(model: string): { bg: string; text: string } {
  if (model.includes('opus')) return { bg: 'rgba(121,97,219,0.2)', text: '#7961DB' }
  if (model.includes('sonnet')) return { bg: 'rgba(45,114,210,0.2)', text: '#2D72D2' }
  return { bg: 'rgba(64,72,84,0.4)', text: '#ABB3BF' }
}

// 섹션 라벨 컴포넌트
function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="text-[10px] tracking-wider text-[#ABB3BF] uppercase">
      {label}
      {count !== undefined && (
        <span className="ml-1.5 text-[#5F6B7C]">({count})</span>
      )}
    </div>
  )
}

// 접기/펼치기 섹션 컴포넌트
function CollapsibleSection({
  label,
  count,
  children
}: {
  label: string
  count?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-[#404854]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#252A31] transition-colors"
      >
        <SectionLabel label={label} count={count} />
        <span
          className={`text-[10px] text-[#5F6B7C] transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

// 에이전트 상세 뷰
function AgentDetail({ agent }: { agent: (typeof systemData.agents)[number] }) {
  // 이 에이전트가 포함된 파이프라인 찾기
  const relatedPipelines = systemData.pipelines.filter((p) =>
    p.steps.some((s) => s.from === agent.id || s.to === agent.id)
  )

  const catColor = PALANTIR_CATEGORY_COLORS[agent.category] ?? '#ABB3BF'
  const modelStyle = getModelBadgeStyle(agent.model)

  return (
    <div>
      {/* 1. 기본 정보 */}
      <div className="px-4 py-3 border-b border-[#404854]">
        <div className="flex flex-wrap gap-1.5">
          {/* 카테고리 뱃지 */}
          <span
            className="text-[10px] rounded px-1.5 py-0.5 font-medium"
            style={{ backgroundColor: `${catColor}20`, color: catColor }}
          >
            {agent.category}
          </span>
          {/* 모델 뱃지 */}
          <span
            className="text-[10px] rounded px-1.5 py-0.5 font-medium"
            style={{ backgroundColor: modelStyle.bg, color: modelStyle.text }}
          >
            {agent.model}
          </span>
        </div>
      </div>

      {/* 2. 설명 */}
      <CollapsibleSection label="DESCRIPTION">
        <p className="text-xs text-[#ABB3BF] leading-relaxed">{agent.description}</p>
      </CollapsibleSection>

      {/* 3. 도구 */}
      <CollapsibleSection label="TOOLS" count={agent.tools.length}>
        <div className="flex flex-wrap gap-1.5">
          {agent.tools.map((tool) => (
            <span
              key={tool}
              className="bg-[#252A31] border border-[#404854] rounded text-[10px] text-[#ABB3BF] px-2 py-1"
            >
              {tool}
            </span>
          ))}
        </div>
      </CollapsibleSection>

      {/* 4. 설정 */}
      <CollapsibleSection label="CONFIG">
        <div className="grid grid-cols-2 gap-y-1.5">
          {agent.maxTurns !== undefined && (
            <>
              <span className="text-[10px] text-[#5F6B7C]">maxTurns</span>
              <span className="text-[10px] text-[#ABB3BF] font-mono">{agent.maxTurns}</span>
            </>
          )}
          {agent.memory !== undefined && (
            <>
              <span className="text-[10px] text-[#5F6B7C]">memory</span>
              <span className="text-[10px] text-[#ABB3BF] font-mono">{agent.memory}</span>
            </>
          )}
          {(agent as Record<string, unknown>).isolation !== undefined && (
            <>
              <span className="text-[10px] text-[#5F6B7C]">isolation</span>
              <span className="text-[10px] text-[#ABB3BF] font-mono">
                {String((agent as Record<string, unknown>).isolation)}
              </span>
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* 5. 파이프라인 연결 */}
      {relatedPipelines.length > 0 && (
        <CollapsibleSection label="PIPELINES" count={relatedPipelines.length}>
          <div className="space-y-2">
            {relatedPipelines.map((pipeline) => (
              <div key={pipeline.name} className="space-y-1">
                <div className="text-[11px] text-[#F6F7F9] font-medium">{pipeline.name}</div>
                {pipeline.steps
                  .filter((s) => s.from === agent.id || s.to === agent.id)
                  .map((step, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px]">
                      <span
                        className={
                          step.from === agent.id ? 'text-[#2D72D2] font-medium' : 'text-[#ABB3BF]'
                        }
                      >
                        {step.from || '(start)'}
                      </span>
                      <span className="text-[#5F6B7C]">&rarr;</span>
                      <span
                        className={
                          step.to === agent.id ? 'text-[#2D72D2] font-medium' : 'text-[#ABB3BF]'
                        }
                      >
                        {step.to}
                      </span>
                      {step.condition && (
                        <span className="text-[9px] text-[#5F6B7C] ml-1 truncate max-w-[120px]">
                          ({step.condition})
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

// 스킬 상세 뷰
function SkillDetail({ skill }: { skill: (typeof systemData.skills)[number] }) {
  // 이 스킬이 포함된 파이프라인 찾기
  const skillId = skill.id.startsWith('/') ? skill.id : `/${skill.id}`
  const relatedPipelines = systemData.pipelines.filter((p) =>
    p.steps.some((s) => s.from === skillId || s.to === skillId)
  )

  return (
    <div>
      {/* 기본 정보 */}
      <div className="px-4 py-3 border-b border-[#404854]">
        <div className="flex flex-wrap gap-1.5">
          <span
            className="text-[10px] rounded px-1.5 py-0.5 font-medium"
            style={{
              backgroundColor: 'rgba(45,114,210,0.2)',
              color: '#2D72D2'
            }}
          >
            {skill.type}
          </span>
          {skill.hasSubcommands && (
            <span className="text-[10px] rounded px-1.5 py-0.5 bg-[rgba(138,187,255,0.2)] text-[#8ABBFF]">
              subcommands
            </span>
          )}
        </div>
      </div>

      {/* 설명 */}
      {skill.description && (
        <CollapsibleSection label="DESCRIPTION">
          <p className="text-xs text-[#ABB3BF] leading-relaxed">{skill.description}</p>
        </CollapsibleSection>
      )}

      {/* 프로퍼티 */}
      <CollapsibleSection label="PROPERTIES">
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-[10px] text-[#5F6B7C]">type</span>
          <span className="text-[10px] text-[#ABB3BF] font-mono">{skill.type}</span>
          <span className="text-[10px] text-[#5F6B7C]">hasSubcommands</span>
          <span className="text-[10px] text-[#ABB3BF] font-mono">
            {String(skill.hasSubcommands)}
          </span>
        </div>
      </CollapsibleSection>

      {/* 파이프라인 연결 */}
      {relatedPipelines.length > 0 && (
        <CollapsibleSection label="PIPELINES" count={relatedPipelines.length}>
          <div className="space-y-2">
            {relatedPipelines.map((pipeline) => (
              <div key={pipeline.name} className="space-y-1">
                <div className="text-[11px] text-[#F6F7F9] font-medium">{pipeline.name}</div>
                {pipeline.steps
                  .filter((s) => s.from === skillId || s.to === skillId)
                  .map((step, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px]">
                      <span
                        className={
                          step.from === skillId ? 'text-[#2D72D2] font-medium' : 'text-[#ABB3BF]'
                        }
                      >
                        {step.from || '(start)'}
                      </span>
                      <span className="text-[#5F6B7C]">&rarr;</span>
                      <span
                        className={
                          step.to === skillId ? 'text-[#2D72D2] font-medium' : 'text-[#ABB3BF]'
                        }
                      >
                        {step.to}
                      </span>
                      {step.condition && (
                        <span className="text-[9px] text-[#5F6B7C] ml-1 truncate max-w-[120px]">
                          ({step.condition})
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

// 메인 디테일 패널
export function DetailPanel({
  selectedId,
  onClose
}: {
  selectedId: string | null
  onClose: () => void
}) {
  // 선택된 항목에 맞는 데이터 찾기
  const agent = selectedId ? systemData.agents.find((a) => a.id === selectedId) : null
  const skill =
    selectedId && selectedId.startsWith('/')
      ? systemData.skills.find((s) => `/${s.id}` === selectedId || s.id === selectedId)
      : null

  // 타입과 이름 결정
  let typeBadge = ''
  let name = ''

  if (agent) {
    typeBadge = 'Agent'
    name = agent.name
  } else if (skill) {
    typeBadge = 'Skill'
    name = skill.name
  } else if (selectedId) {
    typeBadge = 'Node'
    name = selectedId
  }

  return (
    // 외부 래퍼 — 레이아웃 공간 확보/해제만 담당
    <div
      className={`overflow-hidden transition-[width] duration-200 ease-in-out ${
        selectedId ? 'w-80' : 'w-0'
      }`}
      style={{ flexShrink: 0 }}
    >
      {/* 내부 패널 — 슬라이드 애니메이션 */}
      <div
        className={`w-80 h-full bg-[#1C2127] border-l border-[#404854] overflow-y-auto overflow-x-hidden
          transition-transform duration-200 ease-in-out
          ${selectedId ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-[#404854] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-[rgba(138,187,255,0.2)] text-[#8ABBFF] text-[10px] rounded px-1.5 py-0.5 shrink-0">
              {typeBadge}
            </span>
            <span className="text-sm font-bold text-[#F6F7F9] truncate">{name}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#ABB3BF] hover:text-[#F6F7F9] transition-colors ml-2 shrink-0 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* 컨텐츠 영역 */}
        {agent && <AgentDetail agent={agent} />}
        {!agent && skill && <SkillDetail skill={skill} />}
        {!agent && !skill && selectedId && (
          <div className="px-4 py-8 text-center">
            <div className="text-2xl mb-2 opacity-40">&#128269;</div>
            <div className="text-xs text-[#5F6B7C]">상세 정보를 찾을 수 없습니다</div>
            <div className="text-[10px] text-[#404854] mt-1 font-mono">{selectedId}</div>
          </div>
        )}
      </div>
    </div>
  )
}
