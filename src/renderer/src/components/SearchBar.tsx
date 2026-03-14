import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { search, buildIndex, type SearchResult } from '../lib/search-index'
import { useSystemData } from '../lib/use-system-data'
import type { ViewType } from '../App'

const TYPE_BADGE: Record<SearchResult['type'], { label: string; color: string }> = {
  agent: { label: 'Agent', color: 'bg-blue-600/30 text-blue-400' },
  hook: { label: 'Hook', color: 'bg-indigo-600/30 text-indigo-400' },
  rule: { label: 'Rule', color: 'bg-yellow-600/30 text-yellow-400' }
}

type Props = {
  onNavigate: (view: ViewType, entityId: string) => void
}

export default function SearchBar({ onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { agents, pipelines, hooks, rules } = useSystemData()

  const index = useMemo(
    () => buildIndex(agents, pipelines, hooks, rules),
    [agents, pipelines, hooks, rules]
  )

  const results = search(index, query, 12)

  // Cmd+K 단축키
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 열릴 때 포커스
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onNavigate(result.targetView, result.id)
      setOpen(false)
    },
    [onNavigate]
  )

  // 키보드 내비게이션
  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selected]) {
      handleSelect(results[selected])
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setOpen(false)}
      />

      {/* 검색 팔레트 */}
      <div className="relative w-[520px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
        {/* 입력 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <span className="text-gray-500 text-sm">&#x2315;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={onInputKeyDown}
            placeholder="에이전트, 훅, 룰 검색..."
            className="flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-600"
          />
          <kbd className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
            ESC
          </kbd>
        </div>

        {/* 결과 목록 */}
        {query.trim() && (
          <div className="max-h-[320px] overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-600">
                검색 결과 없음
              </div>
            ) : (
              results.map((r, i) => {
                const badge = TYPE_BADGE[r.type]
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                      i === selected
                        ? 'bg-blue-600/20'
                        : 'hover:bg-gray-800/60'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-200 font-mono">
                        {r.label}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 truncate">
                        {r.description}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* 하단 힌트 */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-800 text-[10px] text-gray-600">
          <span>&#x2191;&#x2193; 이동</span>
          <span>&#x23CE; 선택</span>
          <span>ESC 닫기</span>
        </div>
      </div>
    </div>
  )
}
