import type { FileChangeEvent } from '../../lib/types'
import { shortenHomePath } from '../../lib/format-path'

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  add: { icon: '+', color: 'text-green-400 bg-green-500/20 border-green-500/30' },
  change: { icon: '~', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' },
  unlink: { icon: '-', color: 'text-red-400 bg-red-500/20 border-red-500/30' },
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('ko-KR', { hour12: false })
}

type Props = {
  event: FileChangeEvent
}

export default function TimelineEvent({ event }: Props) {
  const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.change

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800/50 rounded-lg transition-colors">
      <span className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs font-bold ${config.color}`}>
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <code className="block text-[11px] text-gray-300 font-mono truncate">
          {shortenHomePath(event.path)}
        </code>
      </div>
      <span className="text-[10px] text-gray-500 whitespace-nowrap font-mono">
        {formatTime(event.timestamp)}
      </span>
    </div>
  )
}
