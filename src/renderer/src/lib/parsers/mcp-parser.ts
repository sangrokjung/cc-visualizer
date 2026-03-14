import { McpServerSchema, type McpServer } from '../types'

interface RawMcpServerConfig {
  command?: string
  args?: string[]
  [key: string]: unknown
}

/**
 * settings.json에서 MCP 서버 목록을 추출한다.
 * mcpServers 섹션 + permissions.allow에서 mcp__ 패턴을 모두 수집.
 *
 * @param settingsJson - settings.json 전체 객체
 * @returns McpServer[]
 */
export function parseMcpServers(
  settingsJson: Record<string, unknown>
): McpServer[] {
  const servers = new Map<string, McpServer>()

  // 1. mcpServers 섹션에서 직접 정의된 서버 추출
  const mcpServers = settingsJson.mcpServers as
    | Record<string, RawMcpServerConfig>
    | undefined
  if (mcpServers && typeof mcpServers === 'object') {
    for (const [name, config] of Object.entries(mcpServers)) {
      const server = McpServerSchema.safeParse({
        name,
        command: config.command,
        args: Array.isArray(config.args) ? config.args : undefined
      })
      if (server.success) {
        servers.set(name, server.data)
      }
    }
  }

  // 2. permissions.allow에서 mcp__* 패턴 추출
  const permissions = settingsJson.permissions as
    | { allow?: string[]; deny?: string[] }
    | undefined
  if (permissions?.allow) {
    for (const rule of permissions.allow) {
      const match = rule.match(/^mcp__([^_]+)__/)
      if (match && !servers.has(match[1])) {
        servers.set(match[1], { name: match[1] })
      }
    }
  }

  return [...servers.values()]
}

/**
 * permissions 섹션에서 MCP별 allow/deny 규칙을 그룹핑한다.
 */
export function getMcpPermissions(
  settingsJson: Record<string, unknown>
): Map<string, { allow: string[]; deny: string[] }> {
  const result = new Map<string, { allow: string[]; deny: string[] }>()
  const permissions = settingsJson.permissions as
    | { allow?: string[]; deny?: string[] }
    | undefined
  if (!permissions) return result

  for (const rule of permissions.allow ?? []) {
    const match = rule.match(/^mcp__([^_]+)__/)
    if (!match) continue
    const name = match[1]
    if (!result.has(name)) result.set(name, { allow: [], deny: [] })
    result.get(name)!.allow.push(rule)
  }

  for (const rule of permissions.deny ?? []) {
    const match = rule.match(/^mcp__([^_]+)__/)
    if (!match) continue
    const name = match[1]
    if (!result.has(name)) result.set(name, { allow: [], deny: [] })
    result.get(name)!.deny.push(rule)
  }

  return result
}
