// TODO: parser-dev 팀원이 zod 스키마와 함께 구현 예정
// 아래는 다른 팀원이 참조할 수 있는 인터페이스 스텁

export type AgentCategory =
  | 'development'
  | 'review'
  | 'business'
  | 'marketing'
  | 'creative'
  | 'research'
  | 'legal'
  | 'operations'

export type AgentNode = {
  id: string
  name: string
  description: string
  tools: string[]
  model: string
  color: string
  category: AgentCategory
  maxTurns?: number
  memory?: string
  isolation?: string
}

export type HookEvent = {
  event: string
  matcher: string
  command: string
  timeout: number | string
  async: boolean
}

export type McpServer = {
  name: string
  command: string
  args: string[]
}

export type RuleFile = {
  name: string
  path: string
  priority: 'critical' | 'important' | 'normal'
}

export type PipelineEdge = {
  from: string
  to: string
  condition?: string
  pipelineName: string
}

export type SessionLog = {
  sessionId: string
  status: 'success' | 'failure' | 'partial'
  summary: string
  timestamp: string
}

export type FileChangeEvent = {
  path: string
  type: 'add' | 'change' | 'unlink'
  timestamp: number
}
