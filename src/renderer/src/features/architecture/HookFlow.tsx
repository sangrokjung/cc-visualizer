import { useState } from 'react'
import systemData from '../../data/system-data.json'

// -- 타입 --
type HookCommand = {
  command: string
  timeout: number
  async: boolean
}

type RawHook = {
  event: string
  matcher: string
  commands: HookCommand[]
}

// -- 이벤트 순서 (세션 라이프사이클) --
const EVENT_ORDER = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'TaskCompleted',
  'Stop',
  'SessionEnd',
  'Notification',
  'PreCompact',
  'SubagentStop',
  'TeammateIdle'
]

// -- 이벤트별 색상 --
const EVENT_COLORS: Record<string, string> = {
  SessionStart: '#3b82f6',
  UserPromptSubmit: '#8b5cf6',
  PreToolUse: '#f59e0b',
  PostToolUse: '#10b981',
  TaskCompleted: '#06b6d4',
  Stop: '#ef4444',
  SessionEnd: '#f97316',
  Notification: '#ec4899',
  PreCompact: '#a855f7',
  SubagentStop: '#6366f1',
  TeammateIdle: '#64748b'
}

// -- 이벤트별 그룹화 --
type EventGroup = {
  event: string
  matchers: MatcherGroup[]
  totalHooks: number
}

type MatcherGroup = {
  matcher: string
  commands: HookCommand[]
}

function groupByEvent(hooks: RawHook[]): EventGroup[] {
  const map = new Map<string, MatcherGroup[]>()

  for (const hook of hooks) {
    const existing = map.get(hook.event) ?? []
    existing.push({ matcher: hook.matcher, commands: hook.commands })
    map.set(hook.event, existing)
  }

  return EVENT_ORDER
    .filter((evt) => map.has(evt))
    .map((evt) => {
      const matchers = map.get(evt)!
      const totalHooks = matchers.reduce((s, m) => s + m.commands.length, 0)
      return { event: evt, matchers, totalHooks }
    })
}

// -- 커맨드 이름 축약 --
function shortName(cmd: string): string {
  const parts = cmd.split('/')
  const filename = parts[parts.length - 1]
  return filename.replace(/\.sh$/, '')
}

// -- 매처 노드 --
function MatcherNode({ group, color }: { group: MatcherGroup; color: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="ml-8 mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-left w-full group"
      >
        <span
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-gray-300 font-mono group-hover:text-white transition-colors">
          {group.matcher}
        </span>
        {group.commands.some((c) => c.async) && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
            async
          </span>
        )}
        <span className="text-[10px] text-gray-600 ml-auto">
          {group.commands.length}개
        </span>
        <span className="text-gray-600 text-[10px]">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div className="ml-4 mt-1 space-y-1">
          {group.commands.map((cmd, i) => (
            <CommandRow key={i} cmd={cmd} />
          ))}
        </div>
      )}
    </div>
  )
}

// -- 커맨드 행 --
function CommandRow({ cmd }: { cmd: HookCommand }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-gray-500 pl-2 border-l border-gray-800">
      <span className="w-1 h-1 rounded-full bg-gray-700 flex-shrink-0" />
      <span className="font-mono truncate" title={cmd.command}>
        {shortName(cmd.command)}
      </span>
      {cmd.async && (
        <span className="text-[9px] text-purple-500">async</span>
      )}
      <span className="text-gray-700 ml-auto flex-shrink-0">
        {cmd.timeout / 1000}s
      </span>
    </div>
  )
}

// -- 이벤트 노드 --
function EventNode({ group }: { group: EventGroup }) {
  const color = EVENT_COLORS[group.event] ?? '#6b7280'

  return (
    <div className="relative pl-10 pb-6">
      {/* 세로 연결선 */}
      <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-800" />

      {/* 원형 노드 */}
      <div
        className="absolute left-2 top-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 z-10"
        style={{
          backgroundColor: `${color}20`,
          borderColor: color,
          color
        }}
      >
        {group.totalHooks}
      </div>

      {/* 이벤트 헤더 */}
      <div className="flex items-center gap-2 mb-2 pt-1">
        <h3 className="text-sm font-semibold text-gray-200">
          {group.event}
        </h3>
        <span className="text-[10px] text-gray-600">
          {group.matchers.length}개 매처
        </span>
      </div>

      {/* 매처 트리 */}
      <div>
        {group.matchers.map((m) => (
          // content 기반 key — index key는 matcher 재정렬 시 로컬 expanded 상태가 엉뚱한 항목에 남는다
          <MatcherNode key={`${group.event}-${m.matcher}`} group={m} color={color} />
        ))}
      </div>
    </div>
  )
}

// -- 메인 --
const hookGroups = groupByEvent(systemData.hooks as RawHook[])
const totalHooks = hookGroups.reduce((s, g) => s + g.totalHooks, 0)

export default function HookFlow() {
  return (
    <div className="h-full overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-sm font-semibold text-gray-300">
            훅 이벤트 플로우
          </h2>
          <span className="text-[11px] text-gray-600">
            {hookGroups.length}개 이벤트 / {totalHooks}개 훅
          </span>
        </div>
        {/* 이벤트 색상 범례 */}
        <div className="flex flex-wrap gap-3">
          {hookGroups.map((g) => (
            <span key={g.event} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: EVENT_COLORS[g.event] ?? '#6b7280' }}
              />
              {g.event}
            </span>
          ))}
        </div>
      </div>

      {/* 타임라인 */}
      <div className="relative">
        {hookGroups.map((group) => (
          <EventNode key={group.event} group={group} />
        ))}
        {/* 타임라인 끝점 */}
        <div className="relative pl-10">
          <div className="absolute left-[18px] top-0 w-0.5 h-4 bg-gray-800" />
          <div className="absolute left-[14px] top-4 w-3 h-3 rounded-full bg-gray-800 border-2 border-gray-700" />
        </div>
      </div>
    </div>
  )
}
