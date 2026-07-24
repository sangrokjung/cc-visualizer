import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'

// 실행 머신마다 다른 HOME. 미설정 시 os.homedir() 폴백 (sangrok 하드코딩 제거).
const HOME = process.env.HOME || homedir()
const PROJECTS_DIR = join(HOME, '.claude/projects')

interface UsageStats {
  scanTimestamp: string
  summary: { totalEvents: number; totalSessions: number; totalProjects: number }
  projects: Array<{ name: string; events: number; sessions: number }>
  toolUsage: Array<{ name: string; count: number }>
  agentSpawns: Array<{ name: string; count: number; project: string }>
  hookEvents: Array<{ event: string; tool: string; count: number }>
  dailyActivity: Array<{ date: string; events: number; sessions: number }>
}

function scanAllJsonl(): UsageStats {
  const projectCounts: Record<string, { events: number; sessions: Set<string> }> = {}
  const toolCounts: Record<string, number> = {}
  const agentCounts: Record<string, { count: number; project: string }> = {}
  const hookCounts: Record<string, { event: string; tool: string; count: number }> = {}
  const dailyCounts: Record<string, { events: number; sessions: Set<string> }> = {}
  const allSessions = new Set<string>()
  let totalEvents = 0

  // 모든 프로젝트 디렉토리 순회
  if (!existsSync(PROJECTS_DIR)) {
    console.log('프로젝트 디렉토리 없음:', PROJECTS_DIR)
    return emptyStats()
  }

  const dirs = readdirSync(PROJECTS_DIR)
  for (const dir of dirs) {
    const dirPath = join(PROJECTS_DIR, dir)
    let files: string[]
    try {
      files = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'))
    } catch { continue }

    for (const file of files) {
      const filePath = join(dirPath, file)
      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch { continue }

      const lines = content.split('\n').filter(l => l.trim())
      for (const line of lines) {
        try {
          const d = JSON.parse(line)
          totalEvents++

          const sessionId = d.sessionId || ''
          allSessions.add(sessionId)

          // 프로젝트
          const cwd = d.cwd || ''
          const projName = cwd ? cwd.split('/').pop() || cwd : dir
          if (!projectCounts[projName]) projectCounts[projName] = { events: 0, sessions: new Set() }
          projectCounts[projName].events++
          if (sessionId) projectCounts[projName].sessions.add(sessionId)

          // 일별 활동
          const ts = d.timestamp || ''
          const date = ts.slice(0, 10) // YYYY-MM-DD
          if (date) {
            if (!dailyCounts[date]) dailyCounts[date] = { events: 0, sessions: new Set() }
            dailyCounts[date].events++
            if (sessionId) dailyCounts[date].sessions.add(sessionId)
          }

          const data = d.data
          if (!data || typeof data !== 'object') continue

          // 훅 이벤트 -> 도구 사용
          if (data.type === 'hook_progress') {
            const hookEvent = data.hookEvent || ''
            const hookName = data.hookName || ''
            const tool = hookName.includes(':') ? hookName.split(':').pop() : hookName
            const key = `${hookEvent}:${tool}`
            if (!hookCounts[key]) hookCounts[key] = { event: hookEvent, tool: tool || '', count: 0 }
            hookCounts[key].count++

            // PostToolUse에서 도구 사용 카운트
            if (hookEvent === 'PostToolUse' && tool) {
              toolCounts[tool] = (toolCounts[tool] || 0) + 1
            }
          }

          // 에이전트 스폰
          if (data.type === 'agent_progress' && data.prompt) {
            const prompt = data.prompt || ''
            let name = data.agentId?.slice(0, 12) || 'unknown'

            // 이름 추출
            const teamMatch = prompt.match(/팀의\s+(\S+?)입니다/)
            if (teamMatch) name = teamMatch[1]

            const key = `${name}@${projName}`
            if (!agentCounts[key]) agentCounts[key] = { count: 0, project: projName }
            agentCounts[key].count++
          }

          // 에이전트 내부 도구 사용
          if (data.type === 'agent_progress' && data.message) {
            const msg = String(data.message)
            const matches = msg.matchAll(/'name':\s*'([A-Z][a-zA-Z]+)'/g)
            for (const m of matches) {
              if (m[1] !== 'NoneType') {
                toolCounts[m[1]] = (toolCounts[m[1]] || 0) + 1
              }
            }
          }
        } catch { /* skip malformed lines */ }
      }
    }
  }

  // 결과 조합
  const projects = Object.entries(projectCounts)
    .map(([name, d]) => ({ name, events: d.events, sessions: d.sessions.size }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 30)

  const toolUsage = Object.entries(toolCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const agentSpawns = Object.entries(agentCounts)
    .map(([key, d]) => ({ name: key.split('@')[0], count: d.count, project: d.project }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  const hookEvents = Object.values(hookCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const dailyActivity = Object.entries(dailyCounts)
    .map(([date, d]) => ({ date, events: d.events, sessions: d.sessions.size }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30) // 최근 30일

  return {
    scanTimestamp: new Date().toISOString(),
    summary: {
      totalEvents,
      totalSessions: allSessions.size,
      totalProjects: Object.keys(projectCounts).length
    },
    projects,
    toolUsage,
    agentSpawns,
    hookEvents,
    dailyActivity
  }
}

function emptyStats(): UsageStats {
  return {
    scanTimestamp: new Date().toISOString(),
    summary: { totalEvents: 0, totalSessions: 0, totalProjects: 0 },
    projects: [], toolUsage: [], agentSpawns: [], hookEvents: [], dailyActivity: []
  }
}

// 메인 실행
console.log('Scanning usage stats...')
const stats = scanAllJsonl()
console.log(`  Events: ${stats.summary.totalEvents.toLocaleString()}`)
console.log(`  Sessions: ${stats.summary.totalSessions}`)
console.log(`  Projects: ${stats.summary.totalProjects}`)
console.log(`  Tools: ${stats.toolUsage.length}`)
console.log(`  Agents: ${stats.agentSpawns.length}`)

// SCAN_OUTPUT_DIR 환경변수가 있으면 해당 디렉토리에 저장 (직원 머신 캐시 경로).
// 없으면 기존 소스 트리 경로 (개발 워크플로우 유지).
const outputDir = process.env.SCAN_OUTPUT_DIR
  ? process.env.SCAN_OUTPUT_DIR
  : join(__dirname, '../src/renderer/src/data')
const outputPath = join(outputDir, 'usage-stats.json')
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(stats, null, 2), 'utf-8')
console.log(`Output: ${outputPath}`)
