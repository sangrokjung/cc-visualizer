import { InventorySchema, providerIds, type Inventory, type ResourceKind } from './schema'

// 공개 시연만을 위해 작성한 데이터. 로컬 수집기 또는 기존 스냅샷을 가져오지 않는다.
const entries: { name: string; kind: ResourceKind; description: string; providers: typeof providerIds[number][] }[] = [
  { name: 'research-brief', kind: 'skill', description: '공개 정보를 출처와 함께 정리하는 업무 절차', providers: ['claude', 'codex', 'grok'] },
  { name: 'evidence-check', kind: 'skill', description: '문서의 주장과 근거를 대조하는 업무 절차', providers: ['claude', 'codex'] },
  { name: 'content-outline', kind: 'skill', description: '독자와 핵심 메시지에 맞게 초안을 구성', providers: ['claude', 'antigravity'] },
  { name: 'researcher', kind: 'agent', description: '질문에 맞는 정보를 모으는 조사 담당 역할', providers: ['grok', 'claude'] },
  { name: 'reviewer', kind: 'agent', description: '출처와 결과를 대조하는 검토 담당 역할', providers: ['claude', 'codex'] },
  { name: 'workspace-builder', kind: 'agent', description: '검토 가능한 업무 화면을 만드는 구현 역할', providers: ['antigravity', 'codex'] },
  { name: 'human-approval', kind: 'rule', description: '외부 발송과 게시 전에 담당자가 승인하는 운영 기준', providers: [...providerIds] },
  { name: 'source-first', kind: 'rule', description: '확인되지 않은 정보는 미확인 상태로 표시하는 운영 기준', providers: [...providerIds] },
  { name: 'review-reminder', kind: 'hook', description: '작업 종료 시 검토 항목을 안내하는 예시 연결', providers: ['claude', 'grok'] },
  { name: 'documents', kind: 'mcp', description: '검토된 업무 문서를 연결하는 예시 외부 서비스', providers: [...providerIds] },
  { name: 'research-to-report', kind: 'workflow', description: '조사와 검토를 거쳐 보고서 초안을 만드는 흐름', providers: ['claude', 'codex', 'grok'] },
  { name: 'content-to-preview', kind: 'workflow', description: '콘텐츠 기획을 화면 초안까지 연결하는 흐름', providers: ['claude', 'antigravity'] },
]
const observedAt = '2026-09-08T00:00:00.000Z'
export const exampleInventory: Inventory = InventorySchema.parse({
  schemaVersion: 1, generation: 'example-v1', scope: '예시 업무 환경', mode: 'example',
  scanStartedAt: observedAt, checkedAt: observedAt,
  providers: providerIds.map(id => ({ id, installed: 'unknown', configured: true, running: 'unknown', status: 'ok', checkedAt: observedAt, lastSuccessAt: null, durationMs: 0 })),
  resources: entries.map(entry => ({ id: entry.name, name: entry.name, kind: entry.kind, description: entry.description, sourceRef: `예시 라이브러리 / ${entry.kind} / ${entry.name}`, canonicalIdentity: `example:${entry.name}`, origin: '업무 흐름 설명을 위한 예시' })),
  bindings: entries.flatMap(entry => entry.providers.map(providerId => ({ providerId, resourceId: entry.name, scope: 'shared', enabledState: 'unknown', precedence: 0, evidence: 'example', observedAt, reason: '도구별 역할과 공유 구조를 설명하는 예시입니다.' }))),
  relations: entries.flatMap(entry => entry.providers.map(providerId => ({ from: providerId, to: entry.name, kind: entry.kind, provenance: 'example', evidence: '예시 설정 관계' }))),
  diagnostics: [],
})
