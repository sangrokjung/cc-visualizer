import { describe, it, expect } from 'vitest'
import { parseMcpServers, getMcpPermissions } from '@/lib/parsers/mcp-parser'

const SETTINGS_WITH_MCP = {
  mcpServers: {
    'context7': { command: 'npx', args: ['@context7/mcp'] },
    'supabase': { command: 'npx', args: ['supabase-mcp', '--project-ref', 'xxx'] }
  },
  permissions: {
    allow: [
      'mcp__context7__*',
      'mcp__exa__*',
      'mcp__youtube-transcript__*',
      'mcp__supabase__*',
      'mcp__playwright__*',
      'mcp__github__get_file_contents',
      'mcp__github__search_repositories'
    ],
    deny: [
      'WebFetch(*)'
    ]
  }
}

const SETTINGS_NO_MCP = {
  permissions: {
    allow: ['Bash(*)', 'Read(*)'],
    deny: []
  }
}

describe('parseMcpServers', () => {
  it('mcpServers + permissions에서 서버를 추출한다', () => {
    const result = parseMcpServers(SETTINGS_WITH_MCP)
    const names = result.map((s) => s.name)

    // mcpServers에서 직접 정의: context7, supabase
    expect(names).toContain('context7')
    expect(names).toContain('supabase')

    // permissions에서 추가: exa, youtube-transcript, playwright, github
    expect(names).toContain('exa')
    expect(names).toContain('youtube-transcript')
    expect(names).toContain('playwright')
    expect(names).toContain('github')
  })

  it('mcpServers에서 command/args를 추출한다', () => {
    const result = parseMcpServers(SETTINGS_WITH_MCP)
    const ctx7 = result.find((s) => s.name === 'context7')
    expect(ctx7?.command).toBe('npx')
    expect(ctx7?.args).toEqual(['@context7/mcp'])
  })

  it('permissions only 서버는 name만 있다', () => {
    const result = parseMcpServers(SETTINGS_WITH_MCP)
    const exa = result.find((s) => s.name === 'exa')
    expect(exa?.command).toBeUndefined()
    expect(exa?.args).toBeUndefined()
  })

  it('중복 서버는 제거한다 (mcpServers 우선)', () => {
    const result = parseMcpServers(SETTINGS_WITH_MCP)
    const supabaseEntries = result.filter((s) => s.name === 'supabase')
    expect(supabaseEntries).toHaveLength(1)
    expect(supabaseEntries[0].command).toBe('npx') // mcpServers 버전
  })

  it('MCP가 없는 settings는 빈 배열', () => {
    expect(parseMcpServers(SETTINGS_NO_MCP)).toEqual([])
  })

  it('빈 객체는 빈 배열', () => {
    expect(parseMcpServers({})).toEqual([])
  })
})

describe('getMcpPermissions', () => {
  it('MCP별 allow/deny를 그룹핑한다', () => {
    const result = getMcpPermissions(SETTINGS_WITH_MCP)
    expect(result.get('context7')?.allow).toContain('mcp__context7__*')
    expect(result.get('github')?.allow).toHaveLength(2)
  })

  it('deny 규칙이 있으면 포함한다', () => {
    const withDeny = {
      permissions: {
        allow: ['mcp__test__read'],
        deny: ['mcp__test__write']
      }
    }
    const result = getMcpPermissions(withDeny)
    expect(result.get('test')?.allow).toEqual(['mcp__test__read'])
    expect(result.get('test')?.deny).toEqual(['mcp__test__write'])
  })

  it('permissions 없으면 빈 맵', () => {
    expect(getMcpPermissions({}).size).toBe(0)
  })
})
