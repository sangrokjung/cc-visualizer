import { useState, useMemo } from 'react'

type HookCommand = {
  command: string
  timeout: number
  async: boolean
}

type Hook = {
  event: string
  matcher: string
  commands: HookCommand[]
}

type Rule = {
  id: string
  name: string
  path: string
  priority: string
}

type Props = {
  hooks: Hook[]
  rules: Rule[]
  searchQuery: string
}

const EVENT_COLORS: Record<string, string> = {
  PreToolUse: '#3b82f6',
  PostToolUse: '#6366f1',
  SessionStart: '#22c55e',
  SessionEnd: '#10b981',
  UserPromptSubmit: '#a855f7',
  Stop: '#ef4444',
  TaskCompleted: '#ec4899',
  Notification: '#f59e0b',
  PreCompact: '#6b7280',
  SubagentStop: '#f97316',
  TeammateIdle: '#14b8a6'
}

const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-600/15', text: 'text-red-400', label: 'CRITICAL' },
  important: { bg: 'bg-yellow-600/15', text: 'text-yellow-400', label: 'IMPORTANT' },
  normal: { bg: 'bg-gray-700/30', text: 'text-gray-400', label: 'NORMAL' }
}

function HookSection({ hooks, searchQuery }: { hooks: Hook[]; searchQuery: string }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // 이벤트별 그룹
  const grouped = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filtered = !q
      ? hooks
      : hooks.filter(
          (h) =>
            h.event.toLowerCase().includes(q) ||
            h.matcher.toLowerCase().includes(q) ||
            h.commands.some((c) => c.command.toLowerCase().includes(q))
        )

    const map = new Map<string, Hook[]>()
    for (const hook of filtered) {
      const list = map.get(hook.event) ?? []
      list.push(hook)
      map.set(hook.event, list)
    }
    return map
  }, [hooks, searchQuery])

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300">훅 ({hooks.length})</h2>
      {Array.from(grouped.entries()).map(([event, items]) => (
        <div key={event}>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: EVENT_COLORS[event] ?? '#6b7280' }}
            />
            <span className="text-xs font-semibold text-gray-400">{event}</span>
            <span className="text-[10px] text-gray-600">({items.length})</span>
          </div>
          <div className="space-y-1 ml-4">
            {items.map((hook) => {
              const key = `${hook.event}:${hook.matcher}`
              const isExpanded = expandedKey === key
              const asyncCount = hook.commands.filter((c) => c.async).length
              return (
                <div key={key}>
                  <button
                    onClick={() => setExpandedKey(isExpanded ? null : key)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 bg-gray-900/40 border border-gray-800/50 rounded hover:border-gray-700 transition-colors"
                  >
                    <span className="text-[10px] text-gray-500">{isExpanded ? 'v' : '>'}</span>
                    <code className="text-xs text-gray-300 font-mono">{hook.matcher}</code>
                    <span className="text-[10px] text-gray-500 ml-auto">
                      {hook.commands.length}개
                    </span>
                    {asyncCount > 0 && (
                      <span className="px-1 py-0.5 text-[10px] bg-teal-600/20 text-teal-400 border border-teal-600/30 rounded">
                        async {asyncCount}
                      </span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {hook.commands.map((cmd, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-2 py-1 text-[11px] text-gray-400"
                        >
                          <code className="truncate flex-1">{extractFilename(cmd.command)}</code>
                          <span className="text-gray-600 flex-shrink-0">{cmd.timeout}ms</span>
                          {cmd.async && (
                            <span className="text-teal-500 flex-shrink-0">async</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function extractFilename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

function RuleSection({ rules, searchQuery }: { rules: Rule[]; searchQuery: string }) {
  const grouped = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filtered = !q
      ? rules
      : rules.filter(
          (r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
        )

    const map: Record<string, Rule[]> = { critical: [], important: [], normal: [] }
    for (const rule of filtered) {
      const priority = rule.priority in map ? rule.priority : 'normal'
      map[priority].push(rule)
    }
    return map
  }, [rules, searchQuery])

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300">규칙 ({rules.length})</h2>
      {(['critical', 'important', 'normal'] as const).map((priority) => {
        const items = grouped[priority]
        if (!items || items.length === 0) return null
        const style = PRIORITY_STYLE[priority]
        return (
          <div key={priority}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              <span className="text-[10px] text-gray-600">({items.length})</span>
            </div>
            <div className="space-y-1 ml-2">
              {items.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 px-2 py-1.5 bg-gray-900/40 border border-gray-800/50 rounded"
                >
                  <span className="text-xs text-gray-200 min-w-[180px]">{rule.name}</span>
                  <code className="text-[10px] text-gray-500 truncate">
                    {rule.path.replace('/Users/sangrok/', '~/')}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function HookRuleCatalog({ hooks, rules, searchQuery }: Props) {
  return (
    <div className="space-y-6">
      <HookSection hooks={hooks} searchQuery={searchQuery} />
      <div className="border-t border-gray-800" />
      <RuleSection rules={rules} searchQuery={searchQuery} />
    </div>
  )
}
