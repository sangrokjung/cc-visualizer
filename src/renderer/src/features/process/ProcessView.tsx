import React, { useState, useRef } from 'react'
import { AnimatedFlowChart } from './AnimatedFlowChart'

// 팔란티어 다크 테마 색상
const C = {
  bg: '#111418',
  card: '#1C2127',
  cardSub: '#252A31',
  border: '#404854',
  text: '#F6F7F9',
  textSub: '#ABB3BF',
  textWeak: '#738091',
  textDim: '#5F6B7C',
  blue: '#2D72D2',
  green: '#29A634',
  purple: '#7961DB',
  yellow: '#D1980B',
  red: '#DB2C6F',
  cyan: '#00A396'
}

// Phase 데이터
const PHASES = [
  {
    id: 0,
    name: '세션 시작',
    color: C.blue,
    skills: [
      { name: '/morning-sync', role: '아침 브리핑 (TODO + 캘린더 + 정부지원사업)', when: '출근 시' },
      { name: '/context-sync', role: 'Slack/Gmail/Calendar 컨텍스트 수집', when: '세션 시작 시' },
      { name: '/checkin', role: '출근 기록 (Supabase + Discord)', when: '출근 시' },
      { name: '/explore', role: '코드베이스 구조 파악', when: '새 프로젝트 진입 시' }
    ]
  },
  {
    id: 1,
    name: '아이디어→검증',
    color: C.yellow,
    skills: [
      { name: '/brainstorming', role: '의도/범위/제약 확인', when: '필수 - 모든 창작/구현 전' },
      { name: '/feasibility', role: 'GO/NO-GO 기술 타당성 판단', when: '대규모 작업 전' }
    ]
  },
  {
    id: 2,
    name: '계획 수립',
    color: C.purple,
    skills: [
      { name: '/plan', role: '구현 계획 수립 (3~6단계)', when: '3파일+ 변경 시 필수' }
    ]
  },
  {
    id: 3,
    name: '구현',
    color: C.green,
    skills: [
      { name: '/tdd', role: '단일 기능/버그픽스', when: '낮은 토큰 비용' },
      { name: '/sdd', role: 'plan의 독립 태스크 병렬 실행', when: '중간 토큰 비용' },
      { name: '/orchestrate', role: '복수 에이전트 협업 필요', when: '높은 토큰 비용' },
      { name: '/auto', role: '계획부터 PR까지 원버튼', when: '높은 토큰 비용' },
      { name: '/auto-loop', role: 'TODO 기반 장기 자율 반복', when: '높은 토큰 비용' }
    ]
  },
  {
    id: 4,
    name: '검증',
    color: C.red,
    skills: [
      { name: '/code-review', role: '보안(OWASP) + 품질 2단계 리뷰', when: '구현 후' },
      { name: '/simplify', role: '재사용/품질/효율 개선 (3 병렬 에이전트)', when: '구현 후' },
      { name: '/test-coverage', role: '커버리지 분석 + 누락 테스트 (80%+)', when: '구현 후' },
      { name: '/handoff-verify', role: 'typecheck → lint → build → test', when: '커밋 전' },
      { name: '/verify-loop', role: 'handoff-verify 래퍼 (3회 자동 재시도)', when: '실패 시' }
    ]
  },
  {
    id: 5,
    name: '커밋&통합',
    color: C.cyan,
    skills: [
      { name: '/commit-push-pr', role: '검증 → 커밋 → PR → 머지 + 알림', when: '검증 후' },
      { name: '/quick-commit', role: '단순 수정용 빠른 커밋', when: '소규모 변경' },
      { name: '/finish-branch', role: '통합 전략 결정 (merge/PR/유지/폐기)', when: '브랜치 완료 시' }
    ]
  },
  {
    id: 6,
    name: '문서&학습',
    color: C.yellow,
    skills: [
      { name: '/update-docs', role: '프로젝트 문서 갱신', when: '코드 변경 후' },
      { name: '/sync-docs', role: 'plan.md, spec.md, CLAUDE.md 동기화', when: '코드 변경 후' },
      { name: '/learn', role: '교훈 기록 + 자동화 제안', when: '세션 중' },
      { name: '/log-decision', role: '의사결정 기록', when: '중요 결정 시' }
    ]
  },
  {
    id: 7,
    name: '세션 종료',
    color: C.blue,
    skills: [
      { name: '/session-wrap', role: '4 병렬 서브에이전트가 세션 분석', when: '종료 전' },
      { name: '/save-work', role: '업무 기록 저장 + 파일 정리', when: '종료 전' },
      { name: '/evening-wrap', role: '완료 체크 + 내일 우선순위', when: '퇴근 전' },
      { name: '/checkout', role: '퇴근 기록 (Supabase + Discord)', when: '퇴근 시' }
    ]
  }
]

// 상황별 레시피 (20개)
const RECIPES = [
  { id: 1, title: '단순 수정', subtitle: '오타, 1줄 변경', color: C.green, flow: ['수정', '/handoff-verify', '/quick-commit'] },
  { id: 2, title: '버그 수정 (원인 모름)', subtitle: '추측 수정 금지', color: C.red, flow: ['/systematic-debugging', '/tdd', '/handoff-verify'] },
  { id: 3, title: '버그 수정 (원인 앎)', subtitle: '', color: C.yellow, flow: ['/tdd', '/handoff-verify', '/quick-commit'] },
  { id: 4, title: '소규모 기능', subtitle: '1~2파일', color: C.blue, flow: ['/brainstorming', '/tdd', '/code-review', '/commit-push-pr'] },
  { id: 5, title: '중규모 기능', subtitle: '3~5파일', color: C.purple, flow: ['/brainstorming', '/plan', '/tdd', '/code-review', '/commit-push-pr'] },
  { id: 6, title: '대규모 기능', subtitle: '6파일+', color: C.red, flow: ['/brainstorming', '/feasibility', '/plan', '/sdd', '/security-review', '/commit-push-pr'] },
  { id: 7, title: '야간 자율', subtitle: '', color: C.cyan, flow: ['/plan(APPROVED)', '/auto-loop'] },
  { id: 8, title: 'Agent Teams', subtitle: '복수 팀원 협업', color: C.yellow, flow: ['/brainstorming', '/plan', '/orchestrate', '/code-review'] },
  { id: 9, title: '빌드 에러', subtitle: '', color: C.red, flow: ['/build-fix', '/systematic-debugging'] },
  { id: 10, title: '테스트 실패', subtitle: '3회 실패 시 리셋', color: C.red, flow: ['/systematic-debugging', '수정', '/verify-loop'] },
  { id: 11, title: '코드 리뷰 받음', subtitle: '맹목 수용 금지', color: C.purple, flow: ['/receiving-code-review', '검증', '수정', '/handoff-verify'] },
  { id: 12, title: '코드 리뷰 요청', subtitle: '', color: C.blue, flow: ['/requesting-code-review', '/gemini-review', '/codex-review'] },
  { id: 13, title: '프론트엔드 UI', subtitle: '', color: C.cyan, flow: ['/brainstorming', '/ui-ux-pro-max', 'frontend-design', '/web-checklist'] },
  { id: 14, title: 'AI 기능 개발', subtitle: 'AI SDK v6', color: C.purple, flow: ['/tdd', '/code-review', '/handoff-verify'] },
  { id: 15, title: '데드 코드 정리', subtitle: '', color: C.green, flow: ['/refactor-clean', '/handoff-verify', '/commit-push-pr'] },
  { id: 16, title: '의존성 업그레이드', subtitle: '', color: C.yellow, flow: ['/dependency-upgrade'] },
  { id: 17, title: 'E2E 테스트', subtitle: 'Playwright', color: C.cyan, flow: ['/e2e'] },
  { id: 18, title: '배포 후 문제', subtitle: '', color: C.red, flow: ['/vercel:investigation-mode'] },
  { id: 19, title: '반복 작업', subtitle: '5+ 파일 동일 패턴', color: C.yellow, flow: ['/batch'] },
  { id: 20, title: '새 스킬 만들기', subtitle: '', color: C.purple, flow: ['/writing-skills'] }
]

// 절대 게이트
const GATES = [
  { name: '/brainstorming', rule: '모든 창작/구현 전 필수', color: C.yellow },
  { name: 'plan.md APPROVED', rule: '3파일+ 변경 시 필수', color: C.purple },
  { name: '/tdd', rule: 'RED → GREEN → IMPROVE 사이클', color: C.green },
  { name: '/systematic-debugging', rule: '버그 발견 시 즉시 (추측 수정 금지)', color: C.blue },
  { name: '/verification-before-completion', rule: '증거 없는 완료 주장 금지', color: C.red }
]

// 일과 루틴
const ROUTINE = [
  { time: '출근', commands: ['/checkin', '/morning-sync'], color: C.blue },
  { time: '작업 중', commands: ['/loop 5m /handoff-verify'], color: C.green },
  { time: '주간', commands: ['/weekly-review'], color: C.purple },
  { time: '퇴근 전', commands: ['/session-wrap', '/save-work', '/evening-wrap', '/checkout'], color: C.yellow }
]

// 단축 경로
const SHORTCUTS = [
  { situation: '오타 수정', path: '수정 → /handoff-verify → /quick-commit' },
  { situation: '원인 아는 버그', path: '/tdd → /handoff-verify → /quick-commit' },
  { situation: '소규모 기능', path: '/brainstorming → /tdd → /code-review → /commit-push-pr' },
  { situation: '대규모 기능', path: '/brainstorming → /feasibility → /plan → /sdd → 전체 검증' },
  { situation: '야간 자율', path: '/plan(APPROVED) → /auto-loop' },
  { situation: '원스톱', path: '/auto [설명]' }
]

const RECIPE_CATEGORIES = [
  { key: null as string | null, label: '전체', color: C.blue },
  { key: 'bug', label: '버그', color: C.red, ids: [2, 3, 9, 10] },
  { key: 'feature', label: '기능', color: C.green, ids: [1, 4, 5, 6, 7, 14] },
  { key: 'review', label: '리뷰/정리', color: C.purple, ids: [11, 12, 15, 20] },
  { key: 'deploy', label: '배포/UI', color: C.cyan, ids: [8, 13, 16, 17, 18] },
  { key: 'other', label: '기타', color: C.yellow, ids: [19] },
]

// 구현 전략 선택 플로차트 데이터
const IMPL_STRATEGY_NODES = [
  { id: 'start', label: '독립 태스크 2+개?', x: 250, y: 0 },
  { id: 'discuss', label: '태스크 간 논의 필요?', x: 420, y: 70 },
  { id: 'orchestrate', label: '/orchestrate', x: 500, y: 150, terminal: true, color: C.red },
  { id: 'sdd', label: '/sdd', x: 340, y: 150, terminal: true, color: C.purple },
  { id: 'single', label: '장기 자율?', x: 80, y: 70 },
  { id: 'autoloop', label: '/auto-loop', x: 0, y: 150, terminal: true, color: C.cyan },
  { id: 'tdd', label: '/tdd', x: 160, y: 150, terminal: true, color: C.green }
]

const IMPL_STRATEGY_EDGES = [
  { from: 'start', to: 'discuss', label: 'YES' },
  { from: 'start', to: 'single', label: 'NO' },
  { from: 'discuss', to: 'orchestrate', label: 'YES' },
  { from: 'discuss', to: 'sdd', label: 'NO' },
  { from: 'single', to: 'autoloop', label: 'YES' },
  { from: 'single', to: 'tdd', label: 'NO' }
]

export default function ProcessView() {
  const [activePhase, setActivePhase] = useState(0)
  const [recipeFilter, setRecipeFilter] = useState<string | null>(null)
  const [hoveredStrategy, setHoveredStrategy] = useState<string | null>(null)
  const recipesRef = useRef<HTMLDivElement>(null)

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: C.bg }}>
      <div className="max-w-[1400px] mx-auto p-6 space-y-8">
        {/* 1. 히어로 */}
        <div
          className="rounded-2xl p-6"
          style={{
            background:
              'linear-gradient(135deg, rgba(45,114,210,0.12) 0%, rgba(121,97,219,0.08) 50%, rgba(0,163,150,0.12) 100%)',
            border: '1px solid rgba(45,114,210,0.2)'
          }}
        >
          <h1 className="text-xl font-bold" style={{ color: C.text }}>
            Development Process Guide
          </h1>
          <p className="text-xs mt-1" style={{ color: C.textSub }}>
            Claude Forge의 200+ 스킬을 개발 상황에 맞게 조합하는 완전 가이드
          </p>
          <div className="flex gap-4 mt-3">
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: `${C.blue}20`, color: C.blue }}
            >
              8 Phases
            </span>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: `${C.green}20`, color: C.green }}
            >
              20 Recipes
            </span>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: `${C.purple}20`, color: C.purple }}
            >
              5 Gates
            </span>
          </div>
        </div>

        {/* 2. 의사결정 플로차트 */}
        <div>
          <h2 className="text-sm font-bold mb-3" style={{ color: C.text }}>
            의사결정 플로차트
          </h2>
          <AnimatedFlowChart
            onNodeClick={(id) => {
              recipesRef.current
                ?.querySelector(`[data-recipe="${id}"]`)
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </div>

        {/* 3. Phase 탭 (0~7) */}
        <div>
          <h2 className="text-sm font-bold mb-3" style={{ color: C.text }}>
            프로세스 단계별 상세
          </h2>
          <div className="flex items-center overflow-x-auto pb-2">
            {PHASES.map((phase, i) => (
              <React.Fragment key={phase.id}>
                <button
                  onClick={() => setActivePhase(phase.id)}
                  className="relative flex flex-col items-center shrink-0 group"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      backgroundColor: activePhase === phase.id ? phase.color : activePhase > phase.id ? `${phase.color}30` : C.cardSub,
                      color: activePhase === phase.id ? '#fff' : activePhase > phase.id ? phase.color : C.textWeak,
                      border: `2px solid ${activePhase >= phase.id ? phase.color : C.border}`,
                      boxShadow: activePhase === phase.id ? `0 0 12px ${phase.color}30` : 'none',
                    }}
                  >
                    {phase.id}
                  </div>
                  <span
                    className="text-[9px] mt-1.5 whitespace-nowrap transition-colors"
                    style={{ color: activePhase === phase.id ? phase.color : C.textDim }}
                  >
                    {phase.name}
                  </span>
                </button>
                {i < PHASES.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-2 rounded-full transition-colors"
                    style={{
                      backgroundColor: activePhase > i ? PHASES[i].color : C.border,
                      minWidth: 24,
                      opacity: activePhase > i ? 0.6 : 0.3,
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 4. 선택된 Phase 상세 */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: C.text }}>
            Phase {activePhase}: {PHASES[activePhase].name}
          </h3>
          <div className="space-y-2">
            {PHASES[activePhase].skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ backgroundColor: C.cardSub }}
              >
                <span
                  className="text-xs font-mono font-bold shrink-0"
                  style={{ color: PHASES[activePhase].color }}
                >
                  {skill.name}
                </span>
                <span className="text-xs flex-1" style={{ color: C.textSub }}>
                  {skill.role}
                </span>
                <span className="text-[10px] shrink-0" style={{ color: C.textDim }}>
                  {skill.when}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. 구현 전략 선택 플로차트 */}
        <div>
          <h2 className="text-sm font-bold mb-3" style={{ color: C.text }}>
            구현 전략 선택
          </h2>
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            <svg viewBox="-20 -10 560 180" className="w-full" style={{ maxHeight: 200 }}>
              {/* 엣지 */}
              {IMPL_STRATEGY_EDGES.map((edge) => {
                const from = IMPL_STRATEGY_NODES.find((n) => n.id === edge.from)!
                const to = IMPL_STRATEGY_NODES.find((n) => n.id === edge.to)!
                const midX = (from.x + to.x) / 2
                const midY = (from.y + to.y) / 2
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <line
                      x1={from.x + 50}
                      y1={from.y + 15}
                      x2={to.x + 50}
                      y2={to.y + 5}
                      stroke={C.border}
                      strokeWidth={1.5}
                    />
                    <text
                      x={midX + 50}
                      y={midY + 5}
                      fill={edge.label === 'YES' ? C.green : C.red}
                      fontSize={9}
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {edge.label}
                    </text>
                  </g>
                )
              })}
              {/* 노드 */}
              {IMPL_STRATEGY_NODES.map((node) => {
                const isTerminal = 'terminal' in node && node.terminal
                const nodeColor = ('color' in node ? node.color : C.textSub) as string
                const isHovered = hoveredStrategy === node.id
                const isDimmed = hoveredStrategy !== null && !isHovered
                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHoveredStrategy(node.id)}
                    onMouseLeave={() => setHoveredStrategy(null)}
                    style={{ cursor: 'pointer', opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.2s' }}
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={100}
                      height={30}
                      rx={isTerminal ? 6 : 15}
                      fill={isHovered ? (isTerminal ? `${nodeColor}40` : `${C.cardSub}`) : (isTerminal ? `${nodeColor}20` : C.cardSub)}
                      stroke={isHovered ? (isTerminal ? nodeColor : C.text) : (isTerminal ? nodeColor : C.border)}
                      strokeWidth={isHovered ? 2 : 1}
                    />
                    <text
                      x={node.x + 50}
                      y={node.y + 18}
                      fill={isTerminal ? nodeColor : C.text}
                      fontSize={10}
                      textAnchor="middle"
                      fontFamily="monospace"
                      fontWeight={isTerminal ? 'bold' : 'normal'}
                    >
                      {node.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* 6. 상황별 레시피 (20개 카드 그리드) */}
        <div>
          <h2 className="text-sm font-bold mb-3" style={{ color: C.text }}>
            상황별 레시피
          </h2>
          <div className="flex gap-2 mb-4">
            {RECIPE_CATEGORIES.map(cat => (
              <button
                key={cat.key ?? 'all'}
                onClick={() => setRecipeFilter(cat.key)}
                className="text-[10px] px-2.5 py-1 rounded-full border transition-all"
                style={{
                  borderColor: recipeFilter === cat.key ? cat.color : C.border,
                  backgroundColor: recipeFilter === cat.key ? `${cat.color}15` : 'transparent',
                  color: recipeFilter === cat.key ? cat.color : C.textWeak,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div ref={recipesRef} className="grid grid-cols-3 gap-4">
            {(recipeFilter
              ? RECIPES.filter(r => RECIPE_CATEGORIES.find(c => c.key === recipeFilter)?.ids?.includes(r.id))
              : RECIPES
            ).map((recipe) => (
              <div
                key={recipe.id}
                data-recipe={recipe.id}
                className="rounded-xl p-4 transition-all hover:scale-[1.02]"
                style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow = `0 0 20px ${recipe.color}15`)
                }
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold" style={{ color: C.text }}>
                    {recipe.title}
                  </h4>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${recipe.color}20`, color: recipe.color }}
                  >
                    #{recipe.id}
                  </span>
                </div>
                {recipe.subtitle && (
                  <p className="text-[10px] mb-2" style={{ color: C.textDim }}>
                    {recipe.subtitle}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  {recipe.flow.map((step, i) => (
                    <React.Fragment key={i}>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{
                          backgroundColor: C.cardSub,
                          color: step.startsWith('/') ? recipe.color : C.textSub
                        }}
                      >
                        {step}
                      </span>
                      {i < recipe.flow.length - 1 && (
                        <span className="text-[10px]" style={{ color: C.textDim }}>
                          →
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7. 일과 루틴 */}
        <div>
          <h2 className="text-sm font-bold mb-3" style={{ color: C.text }}>
            일과 루틴
          </h2>
          <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            {/* 프로그레스 바 */}
            <div className="relative h-1.5 rounded-full mb-6 overflow-hidden" style={{ backgroundColor: C.cardSub }}>
              {ROUTINE.map((r, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full"
                  style={{
                    left: `${i * 25}%`,
                    width: '24.5%',
                    backgroundColor: `${r.color}50`,
                    borderRadius: i === 0 ? '9999px 0 0 9999px' : i === ROUTINE.length - 1 ? '0 9999px 9999px 0' : 0,
                  }}
                />
              ))}
            </div>
            {/* 라벨 그리드 */}
            <div className="grid grid-cols-4 gap-4">
              {ROUTINE.map((r, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-xs font-bold" style={{ color: C.text }}>{r.time}</span>
                  </div>
                  <div className="space-y-0.5 ml-4">
                    {r.commands.map(cmd => (
                      <p key={cmd} className="text-[10px] font-mono" style={{ color: r.color }}>{cmd}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 8. 절대 게이트 */}
        <div>
          <h2 className="text-sm font-bold mb-3" style={{ color: C.red }}>
            절대 건너뛰면 안 되는 게이트
          </h2>
          <div className="rounded-xl p-5" style={{ backgroundColor: C.card, border: `2px solid ${C.red}30` }}>
            <div className="space-y-2">
              {GATES.map(gate => (
                <div key={gate.name} className="flex items-center gap-3 px-3 py-3 rounded-lg" style={{ backgroundColor: `${C.red}06` }}>
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ backgroundColor: gate.color }} />
                    <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: gate.color }} />
                  </span>
                  <span className="text-xs font-mono font-bold shrink-0" style={{ color: gate.color }}>{gate.name}</span>
                  <span className="text-xs flex-1" style={{ color: C.textSub }}>{gate.rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 9. 단축 경로 */}
        <div>
          <h2 className="text-sm font-bold mb-3" style={{ color: C.text }}>
            단축 경로 요약
          </h2>
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: C.cardSub }}>
                  <th
                    className="text-left text-[10px] font-medium px-4 py-2"
                    style={{ color: C.textWeak }}
                  >
                    상황
                  </th>
                  <th
                    className="text-left text-[10px] font-medium px-4 py-2"
                    style={{ color: C.textWeak }}
                  >
                    최소 경로
                  </th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map((s, i) => (
                  <tr
                    key={i}
                    style={{ borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}
                  >
                    <td className="text-xs px-4 py-2" style={{ color: C.text }}>
                      {s.situation}
                    </td>
                    <td className="text-xs font-mono px-4 py-2" style={{ color: C.cyan }}>
                      {s.path}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
