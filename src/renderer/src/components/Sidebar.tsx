import type { ViewType } from '../App'

const views: { id: ViewType; label: string; icon: string }[] = [
  { id: 'agent-map', label: '에이전트 맵', icon: '🔗' },
  { id: 'architecture', label: '시스템 아키텍처', icon: '🏗' },
  { id: 'live-monitor', label: '실시간 모니터', icon: '📡' }
]

type Props = {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
}

export default function Sidebar({ activeView, onViewChange }: Props) {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">CC Visualizer</h1>
        <p className="text-xs text-gray-500 mt-1">Claude Code System</p>
      </div>
      <nav className="flex-1 p-2">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
              activeView === v.id
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <span className="mr-2">{v.icon}</span>
            {v.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
