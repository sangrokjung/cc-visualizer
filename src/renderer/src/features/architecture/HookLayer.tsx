import type { HookEvent } from '../../lib/types'

const EVENT_COLORS: Record<string, string> = {
  PreToolUse: 'border-blue-500 bg-blue-500/10',
  PostToolUse: 'border-indigo-500 bg-indigo-500/10',
  SessionStart: 'border-green-500 bg-green-500/10',
  SessionEnd: 'border-red-500 bg-red-500/10',
  UserPromptSubmit: 'border-yellow-500 bg-yellow-500/10',
  Stop: 'border-orange-500 bg-orange-500/10',
  TaskCompleted: 'border-emerald-500 bg-emerald-500/10',
  Notification: 'border-purple-500 bg-purple-500/10',
  PreCompact: 'border-cyan-500 bg-cyan-500/10',
  SubagentStop: 'border-pink-500 bg-pink-500/10',
  TeammateIdle: 'border-teal-500 bg-teal-500/10',
}

const LABEL_COLORS: Record<string, string> = {
  PreToolUse: 'text-blue-400',
  PostToolUse: 'text-indigo-400',
  SessionStart: 'text-green-400',
  SessionEnd: 'text-red-400',
  UserPromptSubmit: 'text-yellow-400',
  Stop: 'text-orange-400',
  TaskCompleted: 'text-emerald-400',
  Notification: 'text-purple-400',
  PreCompact: 'text-cyan-400',
  SubagentStop: 'text-pink-400',
  TeammateIdle: 'text-teal-400',
}

function groupByEvent(hooks: HookEvent[]): Record<string, HookEvent[]> {
  const groups: Record<string, HookEvent[]> = {}
  for (const hook of hooks) {
    if (!groups[hook.event]) groups[hook.event] = []
    groups[hook.event].push(hook)
  }
  return groups
}

type Props = {
  hooks: HookEvent[]
}

export default function HookLayer({ hooks }: Props) {
  const grouped = groupByEvent(hooks)

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 px-1">
        Hooks ({hooks.length}개, {Object.keys(grouped).length} 이벤트 타입)
      </h2>
      <div className="space-y-2">
        {Object.entries(grouped).map(([event, eventHooks]) => (
          <div
            key={event}
            className={`border-l-2 rounded-r-lg px-3 py-2 ${EVENT_COLORS[event] ?? 'border-gray-500 bg-gray-500/10'}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs font-bold ${LABEL_COLORS[event] ?? 'text-gray-400'}`}>
                {event}
              </span>
              <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                {eventHooks.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {eventHooks.map((hook, i) => (
                <HookCard key={`${event}-${i}`} hook={hook} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HookCard({ hook }: { hook: HookEvent }) {
  const isAsync = hook.hooks.some((h) => h.async)

  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-800/80 border border-gray-700 rounded px-2 py-1 text-[11px]">
      <code className="text-gray-300 font-mono">{hook.matcher}</code>
      {isAsync && (
        <span className="text-[9px] bg-yellow-600/30 text-yellow-400 px-1 py-0.5 rounded font-medium">
          async
        </span>
      )}
    </div>
  )
}
