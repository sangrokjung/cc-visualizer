import { useState } from 'react'
import { useSystemDataContext } from '../../lib/DataProvider'

// 48개 MCP 서버를 compact 그리드로 표시
export function McpGrid() {
  const { systemData } = useSystemDataContext()
  const [query, setQuery] = useState('')
  const servers = systemData.mcpServers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: '#1C2127', borderColor: '#404854' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold" style={{ color: '#F6F7F9' }}>
          MCP 서버
        </h3>
        <span
          className="text-sm rounded-full px-2 py-0.5"
          style={{ backgroundColor: 'rgba(0,163,150,0.2)', color: '#00A396' }}
        >
          {servers.length}
        </span>
      </div>

      {/* 검색 */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="서버 검색..."
        className="w-full text-base rounded-lg px-3 py-1.5 mb-3 outline-none transition-colors"
        style={{
          backgroundColor: '#252A31',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: '#404854',
          color: '#F6F7F9'
        }}
      />

      {/* 서버 그리드 */}
      <div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <div className="grid grid-cols-3 gap-2">
          {servers.map((server, i) => (
            <div
              key={`${server.name}-${server.projectPath}-${i}`}
              className="rounded-lg px-3 py-2 transition-colors cursor-default"
              style={{ backgroundColor: 'rgba(37,42,49,0.6)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2F343C'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(37,42,49,0.6)'
              }}
            >
              <span
                className="text-sm truncate block"
                style={{ color: '#F6F7F9' }}
              >
                ⬡ {server.name}
              </span>
              {server.command && (
                <span
                  className="text-xs truncate block mt-0.5"
                  style={{ color: '#738091' }}
                >
                  {server.command}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
