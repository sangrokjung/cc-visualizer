import { z } from 'zod'

export const providerIds = ['claude', 'codex', 'grok', 'antigravity'] as const
export const resourceKinds = ['agent', 'skill', 'rule', 'hook', 'mcp', 'workflow', 'plugin'] as const
export const providerNames = { claude: 'Claude Code', codex: 'Codex', grok: 'Grok', antigravity: 'Antigravity' }
export const kindNames = { agent: '에이전트', skill: '스킬', rule: '규칙', hook: '훅', mcp: 'MCP', workflow: '워크플로', plugin: '플러그인' }
export const stateNames = { enabled: '설정상 활성', disabled: '비활성', shadowed: '다른 설정 우선', unknown: '적용 미확정' }
const ProviderId = z.enum(providerIds)
const Scope = z.enum(['global', 'project', 'shared'])
export const ResourceSchema = z.object({
  id: z.string(), kind: z.enum(resourceKinds), name: z.string().max(200),
  description: z.string().max(400), sourceRef: z.string(), canonicalIdentity: z.string(),
  origin: z.string(),
})
export const BindingSchema = z.object({
  providerId: ProviderId, resourceId: z.string(), scope: Scope,
  enabledState: z.enum(['enabled', 'disabled', 'shadowed', 'unknown']),
  precedence: z.number(), evidence: z.enum(['confirmed', 'configured', 'unresolved', 'example']),
  observedAt: z.string(), reason: z.string().max(400),
})
export const InventorySchema = z.object({
  schemaVersion: z.literal(1), generation: z.string(), scope: z.string(),
  scanStartedAt: z.string(), checkedAt: z.string(), mode: z.enum(['local', 'example']),
  providers: z.array(z.object({
    id: ProviderId, installed: z.enum(['yes', 'no', 'unknown']), configured: z.boolean(),
    running: z.enum(['observed', 'not-observed', 'unknown']),
    status: z.enum(['ok', 'partial', 'error', 'stale']), checkedAt: z.string(),
    lastSuccessAt: z.string().nullable(), durationMs: z.number(),
  })).length(4),
  resources: z.array(ResourceSchema), bindings: z.array(BindingSchema),
  relations: z.array(z.object({ from: z.string(), to: z.string(), kind: z.string(), provenance: z.enum(['configured', 'observed', 'example']), evidence: z.string() })),
  diagnostics: z.array(z.object({ providerId: ProviderId, source: z.string(), code: z.enum(['missing', 'permission-denied', 'malformed', 'unsupported', 'stale', 'limit']), message: z.string().max(400) })),
}).superRefine((value, ctx) => {
  if (new Set(value.providers.map(p => p.id)).size !== 4) ctx.addIssue({ code: 'custom', message: '공급자 중복' })
  const ids = new Set(value.resources.map(r => r.id))
  if (ids.size !== value.resources.length || value.bindings.some(b => !ids.has(b.resourceId))) ctx.addIssue({ code: 'custom', message: '리소스 참조 오류' })
})
export type Inventory = z.infer<typeof InventorySchema>
export type HarnessResource = z.infer<typeof ResourceSchema>
export type Binding = z.infer<typeof BindingSchema>
export type ProviderId = typeof providerIds[number]
export type ResourceKind = typeof resourceKinds[number]
