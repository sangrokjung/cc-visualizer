type MemorySystem = {
  name: string
  path: string
  description: string
  icon: string
  color: string
}

const MEMORY_SYSTEMS: MemorySystem[] = [
  {
    name: 'Auto Memory',
    path: '~/.claude/projects/-Users-sangrok/memory/',
    description: '기술 패턴, 인프라 설정, 개발 인사이트 저장. 대화 간 자동 지속.',
    icon: 'M',
    color: 'border-blue-500 bg-blue-500/10 text-blue-400',
  },
  {
    name: 'Agent Memory',
    path: '~/.claude/agent-memory/{agent-name}/',
    description: '에이전트별 전문 학습. 코드리뷰 패턴, 마케팅 인사이트 등.',
    icon: 'A',
    color: 'border-purple-500 bg-purple-500/10 text-purple-400',
  },
  {
    name: 'Personal OS',
    path: '~/qjc-office/personal-os/',
    description: '비즈니스 의사결정, 인맥, 콘텐츠, 일정 관리.',
    icon: 'P',
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
  },
]

export default function MemoryLayer() {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 px-1">
        Memory Systems (3개)
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {MEMORY_SYSTEMS.map((mem) => (
          <div
            key={mem.name}
            className={`border-l-2 rounded-r-lg px-4 py-3 ${mem.color}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center text-xs font-bold">
                {mem.icon}
              </span>
              <span className="text-sm font-semibold">{mem.name}</span>
            </div>
            <code className="block text-[10px] text-gray-500 font-mono mb-1.5">
              {mem.path}
            </code>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {mem.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
