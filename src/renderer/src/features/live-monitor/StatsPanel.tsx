import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { FileChangeEvent } from '../../lib/types'

type Props = {
  events: FileChangeEvent[]
}

type PathGroup = { name: string; count: number }

function extractAgentName(path: string): string | null {
  const match = path.match(/agent-memory\/([^/]+)/)
  return match ? match[1] : null
}

function groupByAgent(events: FileChangeEvent[]): PathGroup[] {
  const counts: Record<string, number> = {}
  for (const ev of events) {
    const agent = extractAgentName(ev.path)
    if (agent) {
      counts[agent] = (counts[agent] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function countByType(events: FileChangeEvent[]): Record<string, number> {
  const counts: Record<string, number> = { add: 0, change: 0, unlink: 0 }
  for (const ev of events) {
    counts[ev.type] = (counts[ev.type] ?? 0) + 1
  }
  return counts
}

const BAR_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308',
]

export default function StatsPanel({ events }: Props) {
  const agentData = useMemo(() => groupByAgent(events), [events])
  const typeCounts = useMemo(() => countByType(events), [events])

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-3">이벤트 요약</h3>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="추가" count={typeCounts.add} color="text-green-400" />
          <StatCard label="변경" count={typeCounts.change} color="text-yellow-400" />
          <StatCard label="삭제" count={typeCounts.unlink} color="text-red-400" />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-3">
          에이전트 활동 빈도
        </h3>
        {agentData.length === 0 ? (
          <p className="text-[11px] text-gray-600">아직 에이전트 활동 없음</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agentData} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {agentData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-2">총 이벤트</h3>
        <p className="text-2xl font-bold text-white">{events.length}</p>
      </div>
    </div>
  )
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{count}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  )
}
