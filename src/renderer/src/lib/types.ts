import { z } from 'zod'

// -- 카테고리 --
export const AgentCategorySchema = z.enum([
  'development',
  'review',
  'business',
  'marketing',
  'creative',
  'research',
  'legal',
  'operations'
])
export type AgentCategory = z.infer<typeof AgentCategorySchema>

// 카테고리 → 색상 매핑 (노드 그래프용)
export const CATEGORY_COLORS: Record<AgentCategory, string> = {
  development: '#3b82f6',
  review: '#6366f1',
  business: '#10b981',
  marketing: '#22c55e',
  creative: '#ec4899',
  research: '#a855f7',
  legal: '#eab308',
  operations: '#f97316'
}

// -- 에이전트 노드 --
export const AgentNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tools: z.array(z.string()),
  model: z.string(),
  color: z.string(),
  category: AgentCategorySchema,
  maxTurns: z.number().optional(),
  memory: z.string().optional(),
  isolation: z.string().optional()
})
export type AgentNode = z.infer<typeof AgentNodeSchema>

// -- 훅 이벤트 --
export const HookEntrySchema = z.object({
  type: z.literal('command'),
  command: z.string(),
  timeout: z.number().default(5000),
  async: z.boolean().default(false)
})
export type HookEntry = z.infer<typeof HookEntrySchema>

export const HookEventSchema = z.object({
  event: z.string(),
  matcher: z.string(),
  hooks: z.array(HookEntrySchema)
})
export type HookEvent = z.infer<typeof HookEventSchema>

// -- MCP 서버 --
export const McpServerSchema = z.object({
  name: z.string(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  permissions: z.object({
    allow: z.array(z.string()),
    deny: z.array(z.string())
  }).optional()
})
export type McpServer = z.infer<typeof McpServerSchema>

// -- 룰 파일 --
export const RulePrioritySchema = z.enum(['critical', 'important', 'normal'])
export type RulePriority = z.infer<typeof RulePrioritySchema>

export const RuleFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  priority: RulePrioritySchema
})
export type RuleFile = z.infer<typeof RuleFileSchema>

// -- 파이프라인 엣지 --
export const PipelineEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  condition: z.string().optional(),
  pipelineName: z.string()
})
export type PipelineEdge = z.infer<typeof PipelineEdgeSchema>

// -- 세션 로그 --
export const SessionLogSchema = z.object({
  sessionId: z.string(),
  status: z.enum(['success', 'failure', 'partial']),
  summary: z.string(),
  changes: z.array(z.string()).default([]),
  testResults: z.string().nullable().default(null),
  nextSteps: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  timestamp: z.string().optional()
})
export type SessionLog = z.infer<typeof SessionLogSchema>

// -- 파일 변경 이벤트 (실시간 모니터용) --
export const FileChangeEventSchema = z.object({
  path: z.string(),
  type: z.enum(['add', 'change', 'unlink']),
  timestamp: z.number()
})
export type FileChangeEvent = z.infer<typeof FileChangeEventSchema>

// -- 외부 시스템 --
export const ExternalSystemSchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  description: z.string(),
  techStack: z.array(z.string()),
  category: z.string(),
  agents: z.array(z.string()),
  skills: z.array(z.string()),
  mcpServers: z.array(z.string()),
  status: z.enum(['active', 'wip', 'archived', 'not-found']),
  keyFeatures: z.array(z.string())
})
export type ExternalSystem = z.infer<typeof ExternalSystemSchema>

export const SYSTEM_CATEGORY_COLORS: Record<string, string> = {
  'automation': '#2D72D2',
  'content-automation': '#DB2C6F',
  'finance-automation': '#29A634',
  'education-automation': '#7961DB',
  'marketing-automation': '#D1980B',
  'video-automation': '#00A396',
}

// -- 실시간 세션 이벤트 --
export const SessionEventTypeSchema = z.enum([
  'user', 'assistant', 'tool_use', 'tool_result',
  'agent_spawn', 'agent_progress', 'hook', 'system'
])

export const SessionEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: SessionEventTypeSchema,
  data: z.object({
    text: z.string().optional(),
    toolName: z.string().optional(),
    toolInput: z.string().optional(),
    agentId: z.string().optional(),
    agentName: z.string().optional(),
    hookEvent: z.string().optional(),
    hookName: z.string().optional(),
    command: z.string().optional(),
  })
})
export type SessionEvent = z.infer<typeof SessionEventSchema>

// 이벤트 타입별 시각 설정
export const SESSION_EVENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  user:           { icon: '▶', color: '#2D72D2', label: '사용자' },
  assistant:      { icon: '◀', color: '#7961DB', label: 'AI 응답' },
  tool_use:       { icon: '⚙', color: '#00A396', label: '도구' },
  tool_result:    { icon: '✓', color: '#00A396', label: '결과' },
  agent_spawn:    { icon: '◆', color: '#D1980B', label: '에이전트' },
  agent_progress: { icon: '◇', color: '#D1980B', label: '에이전트' },
  hook:           { icon: '⟁', color: '#29A634', label: '훅' },
  system:         { icon: '●', color: '#738091', label: '시스템' },
}
