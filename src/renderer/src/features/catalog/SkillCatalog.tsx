import { useMemo } from 'react'

type Skill = {
  id: string
  name: string
  description: string
  type: string
  hasSubcommands: boolean
}

type Props = {
  skills: Skill[]
  searchQuery: string
}

function getGroupPrefix(id: string): string {
  const parts = id.split('-')
  if (parts.length >= 2) {
    const prefix = parts[0]
    // pm-*, ad-*, blog-*, card-*, 등 2글자 이상 prefix를 그룹화
    if (['pm', 'ad', 'market', 'content', 'seo', 'blog', 'card'].includes(prefix)) {
      return prefix + '-*'
    }
  }
  return '기타'
}

function groupSkills(skills: Skill[]): Map<string, Skill[]> {
  const groups = new Map<string, Skill[]>()
  const prefixCounts = new Map<string, number>()

  // 1차: prefix별 개수 세기
  for (const skill of skills) {
    const prefix = skill.id.split('-')[0] + '-*'
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1)
  }

  // 2차: 3개 이상이면 그룹화, 아니면 '기타'
  for (const skill of skills) {
    const prefix = getGroupPrefix(skill.id)
    const count = prefixCounts.get(skill.id.split('-')[0] + '-*') ?? 0
    const group = count >= 3 ? prefix : '기타'
    const list = groups.get(group) ?? []
    list.push(skill)
    groups.set(group, list)
  }

  return groups
}

export default function SkillCatalog({ skills, searchQuery }: Props) {
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (!q) return skills
    return skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    )
  }, [skills, searchQuery])

  const groups = useMemo(() => groupSkills(filtered), [filtered])

  // '기타'를 마지막으로, 나머지는 알파벳순
  const sortedGroups = useMemo(() => {
    const entries = Array.from(groups.entries())
    return entries.sort((a, b) => {
      if (a[0] === '기타') return 1
      if (b[0] === '기타') return -1
      return a[0].localeCompare(b[0])
    })
  }, [groups])

  return (
    <div className="space-y-4">
      {sortedGroups.map(([group, items]) => (
        <div key={group}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">{group}</h3>
            <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              {items.length}
            </span>
          </div>
          <div className="space-y-1">
            {items.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-3 px-3 py-2 bg-gray-900/40 border border-gray-800/50 rounded-lg hover:border-gray-700 transition-colors"
              >
                <span className="text-sm flex-shrink-0">
                  {skill.type === 'skill-dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}
                </span>
                <span className="text-sm font-mono text-gray-200 flex-shrink-0 min-w-[140px]">
                  {skill.id}
                </span>
                <span className="text-xs text-gray-400 truncate flex-1">
                  {skill.description}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  {skill.hasSubcommands && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-cyan-600/20 text-cyan-400 border border-cyan-600/30 rounded">
                      sub
                    </span>
                  )}
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded border ${
                      skill.type === 'skill-dir'
                        ? 'bg-amber-600/20 text-amber-400 border-amber-600/30'
                        : 'bg-gray-700/50 text-gray-400 border-gray-600/30'
                    }`}
                  >
                    {skill.type === 'skill-dir' ? 'dir' : 'file'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 py-8 text-sm">검색 결과가 없습니다.</p>
      )}
    </div>
  )
}
