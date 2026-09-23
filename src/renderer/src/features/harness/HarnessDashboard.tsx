import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import logo from '../../assets/harness/qjc-logo-white.svg'
import WorkflowShowcase from './WorkflowShowcase'
import { kindNames, providerIds, providerNames, resourceKinds, stateNames, type Binding, type HarnessResource, type Inventory, type ProviderId, type ResourceKind } from './schema'
import './harness.css'

type Props = {
  inventory: Inventory | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  project?: string
  onProjectChange?: (project: string) => void
  operations?: ReactNode
  modeAction?: ReactNode
}
type View = 'map' | 'workflows' | 'resources' | 'operations'
type Sort = 'name' | 'kind' | 'shared'
const pageSize = 40
const scopeNames = { global: '전역', project: '프로젝트', shared: '공유 경로' }
const evidenceNames = { confirmed: '확인된 구성', configured: '설정 파일 근거', unresolved: '추가 확인 필요', example: '예시 배정' }
const providerStatusNames = { ok: '수집 완료', partial: '일부 미관측', error: '수집 실패', stale: '이전 수집 결과' }
const kindDescriptions: Record<ResourceKind, string> = {
  agent: '업무를 맡는 역할', skill: '재사용하는 업무 절차', rule: 'AI가 따르는 운영 기준',
  hook: '이벤트별 자동 처리', mcp: '외부 서비스 연결', workflow: '단계별 업무 흐름', plugin: '기능을 묶은 확장',
}

function dateLabel(value: string | null | undefined) {
  if (!value) return '미관측'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '시각 미확인' : new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function ResourceDetail({ resource, bindings, example }: { resource?: HarnessResource; bindings: Binding[]; example: boolean }) {
  const providers = new Set(bindings.map(binding => binding.providerId))
  return (
    <aside className="harness-detail" aria-label="선택한 리소스 상세" aria-live="polite">
      <span className="harness-eyebrow">SELECTED RESOURCE</span>
      {resource ? <>
        <span className="harness-detail-kind">{kindNames[resource.kind]} · {kindDescriptions[resource.kind]}</span>
        <h3>{resource.name}</h3>
        <p className="harness-description">{resource.description || '이 리소스의 구성과 도구별 적용 상태를 확인하세요.'}</p>
        <dl className="harness-detail-facts">
          <div><dt>공유</dt><dd>{providers.size > 1 ? `${providers.size}개 도구가 같은 원본 참조` : providers.size === 1 ? '한 도구에서 발견' : '연결 미확인'}</dd></div>
          <div><dt>출처</dt><dd className="harness-path">{resource.sourceRef || '출처 미확인'}</dd></div>
          <div><dt>원본</dt><dd className="harness-path">{resource.origin || '미확인'}</dd></div>
        </dl>
        <h4>도구별 적용 상태</h4>
        <ul className="harness-bindings">
          {bindings.map((binding, index) => <li key={`${binding.providerId}-${binding.scope}-${index}`}>
            <div className="harness-binding-title"><strong>{providerNames[binding.providerId]}</strong><span>{scopeNames[binding.scope]}</span></div>
            <p>{stateNames[binding.enabledState]}</p>
            <span className="harness-muted">{binding.reason || evidenceNames[binding.evidence]}</span>
            <span className="harness-observed">{evidenceNames[binding.evidence]} · {dateLabel(binding.observedAt)}</span>
          </li>)}
        </ul>
        <p className="harness-detail-note">{example ? '기업 시연을 위해 작성한 예시 구성입니다.' : '설정에서 발견한 연결입니다. 실제 세션의 적용 여부와 실행 성공은 별도로 확인합니다.'}</p>
      </> : <div className="harness-detail-empty"><h3>구성을 선택하세요.</h3><p>리소스를 선택하면 원본 출처와 도구별 적용 상태를 함께 볼 수 있습니다.</p></div>}
    </aside>
  )
}

export default function HarnessDashboard({ inventory, loading = false, error, onRefresh, project = '', onProjectChange, operations, modeAction }: Props) {
  const [view, setView] = useState<View>('map')
  const [provider, setProvider] = useState<ProviderId | 'all'>('all')
  const [kind, setKind] = useState<ResourceKind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sharedOnly, setSharedOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('name')
  const [listMode, setListMode] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [projectDraft, setProjectDraft] = useState(project)
  const listRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const example = inventory?.mode === 'example'
  useEffect(() => { setProjectDraft(project) }, [project])

  const index = useMemo(() => {
    const bindings = new Map<string, Binding[]>()
    const providerResources = new Map<ProviderId, Set<string>>(providerIds.map(id => [id, new Set<string>()]))
    const connections = new Set<string>()
    const resources = new Map(inventory?.resources.map(resource => [resource.id, resource]) ?? [])
    for (const binding of inventory?.bindings ?? []) {
      const current = bindings.get(binding.resourceId) ?? []
      current.push(binding)
      bindings.set(binding.resourceId, current)
      providerResources.get(binding.providerId)?.add(binding.resourceId)
      const resource = resources.get(binding.resourceId)
      if (resource) connections.add(`${binding.providerId}:${resource.kind}`)
    }
    const shared = new Set(Array.from(bindings).filter(([, rows]) => new Set(rows.map(row => row.providerId)).size > 1).map(([id]) => id))
    return { bindings, providerResources, shared, connections }
  }, [inventory])

  const matchingResources = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR')
    return (inventory?.resources ?? []).filter(resource =>
      (provider === 'all' || index.providerResources.get(provider)?.has(resource.id)) &&
      (!sharedOnly || index.shared.has(resource.id)) &&
      (!query || `${resource.name} ${resource.description} ${resource.sourceRef}`.toLocaleLowerCase('ko-KR').includes(query)),
    )
  }, [inventory, index, provider, search, sharedOnly])

  const filteredResources = useMemo(() => matchingResources.filter(resource => kind === 'all' || resource.kind === kind).sort((a, b) => {
    if (sort === 'shared') {
      const difference = Number(index.shared.has(b.id)) - Number(index.shared.has(a.id))
      if (difference) return difference
    }
    if (sort === 'kind') {
      const difference = resourceKinds.indexOf(a.kind) - resourceKinds.indexOf(b.kind)
      if (difference) return difference
    }
    return a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id)
  }), [matchingResources, kind, sort, index])
  const kindCounts = useMemo(() => {
    const result = new Map<ResourceKind, number>(resourceKinds.map(value => [value, 0]))
    for (const resource of matchingResources) result.set(resource.kind, (result.get(resource.kind) ?? 0) + 1)
    return result
  }, [matchingResources])
  const pageCount = Math.max(1, Math.ceil(filteredResources.length / pageSize))
  const visiblePage = Math.min(page, pageCount - 1)
  const rows = filteredResources.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize)
  const selected = filteredResources.find(resource => resource.id === selectedId) ?? rows[0]
  const selectedBindings = selected ? index.bindings.get(selected.id) ?? [] : []
  const selectedProviders = new Set(selectedBindings.map(binding => binding.providerId))
  const lastSuccessful = inventory?.providers.some(item => item.lastSuccessAt)
  const showList = view === 'resources' || listMode
  const hasFailures = inventory && (inventory.providers.some(item => item.status !== 'ok') || inventory.diagnostics.length > 0)

  function resetFilters() {
    setProvider('all'); setKind('all'); setSearch(''); setSharedOnly(false); setPage(0)
  }
  function selectKind(value: ResourceKind) {
    setKind(kind === value ? 'all' : value)
    setPage(0)
  }
  function selectResource(resource: HarnessResource) {
    setSelectedId(resource.id)
  }

  return (
    <div className="harness-shell">
      <a className="harness-skip" href="#harness-content">본문으로 이동</a>
      <header className="harness-header">
        <button type="button" className="harness-brand" aria-label="QJC 하네스 맵으로 이동" onClick={() => setView('map')}>
          <img src={logo} alt="QJC" /><span>HARNESS</span>
        </button>
        <nav className="harness-nav" aria-label="주 메뉴">
          {([{ id: 'map', name: '하네스 맵' }, { id: 'workflows', name: '업무 흐름' }, { id: 'resources', name: '리소스' },
            ...(operations ? [{ id: 'operations', name: '운영 상세' }] : []),
          ] as { id: View; name: string }[]).map(item => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}>{item.name}</button>)}
        </nav>
        <div className="harness-header-end">
          {modeAction}
          <span className="harness-mode">{example ? '예시 데이터 · 시연 화면' : '내 PC · 로컬 구성'}</span>
          <a className="harness-contact" href="https://qjc.app/contact?utm_source=harness_demo&utm_medium=product&utm_campaign=ax_showcase" target="_blank" rel="noopener noreferrer">AX 적용 상담 <span aria-hidden="true">↗</span><span className="harness-sr-only"> (새 탭)</span></a>
        </div>
      </header>

      <main id="harness-content" className="harness-content">
        {view === 'workflows' ? <WorkflowShowcase /> : view === 'operations' && operations ? <div className="harness-operations">{operations}</div> : <>
          <section className="harness-intro" aria-labelledby="harness-title">
            <div><p className="harness-eyebrow">ONE PC. ONE CONNECTED SYSTEM.</p><h1 id="harness-title">흩어진 AI를,<br />하나의 시스템으로.</h1></div>
            <div className="harness-intro-copy"><h2>네 가지 도구. 함께 쓰는 업무 자산.</h2><p>어떤 AI가 무엇과 연결되는지,<br />한눈에 확인하고 업무로 이어가세요.</p><button type="button" className="harness-text-button" onClick={() => setView('workflows')}>어떤 일을 할 수 있나요? <span aria-hidden="true">→</span></button></div>
          </section>

          <section className="harness-statusbar" aria-label="데이터 기준">
            <div className="harness-status-main"><span className="harness-status-square" aria-hidden="true" /><strong>{example ? '기업 시연용 예시 구성' : inventory ? inventory.scope : '로컬 수집 대기'}</strong><span>{example ? '실제 PC 관측 아님' : `수집 ${dateLabel(inventory?.checkedAt)}`}</span></div>
            <div className="harness-status-actions">
              {!example && onProjectChange && <form className="harness-project" onSubmit={event => { event.preventDefault(); onProjectChange(projectDraft.trim()) }}>
                <label className="harness-sr-only" htmlFor="harness-project">프로젝트 경로</label><input id="harness-project" value={projectDraft} onChange={event => setProjectDraft(event.target.value)} placeholder="프로젝트 경로 (선택)" spellCheck={false} /><button type="submit" disabled={loading}>범위 적용</button>
              </form>}
              {!example && onRefresh && <button type="button" disabled={loading} onClick={onRefresh}>{loading ? '수집 중…' : '다시 수집'} <span aria-hidden="true">↻</span></button>}
            </div>
          </section>
          {error && <p className="harness-notice" role="alert">수집을 완료하지 못했습니다. {error}{inventory && ' 아래에는 마지막으로 받은 구성을 표시합니다.'}</p>}
          {inventory && hasFailures && <details className="harness-diagnostics"><summary>일부 구성을 확인하지 못했습니다 · 수집 상태 보기</summary>
            <ul>{inventory.providers.filter(item => item.status !== 'ok').map(item => <li key={item.id}><strong>{providerNames[item.id]} · {providerStatusNames[item.status]}</strong><span>마지막 성공 {dateLabel(item.lastSuccessAt)} · 확인 {dateLabel(item.checkedAt)}</span></li>)}</ul>
            {inventory.diagnostics.length > 0 && <ul>{inventory.diagnostics.slice(0, 20).map((diagnostic, index) => <li key={`${diagnostic.providerId}-${diagnostic.source}-${index}`}><strong>{providerNames[diagnostic.providerId]} · {diagnostic.code}</strong><span>{diagnostic.message}</span><span className="harness-path">{diagnostic.source}</span></li>)}</ul>}
            {inventory.diagnostics.length > 20 && <p>추가 진단 {inventory.diagnostics.length - 20}건이 있습니다. 다시 수집한 뒤 상태를 확인하세요.</p>}
          </details>}

          <section className="harness-map-section" aria-label={view === 'resources' ? '리소스 탐색' : '하네스 맵'} aria-busy={loading}>
            <div className="harness-section-heading"><h2><span className="harness-eyebrow">01</span>{view === 'resources' ? '리소스 탐색' : '하네스 맵'}</h2>
              <p>{inventory ? <>고유 리소스 <strong>{inventory.resources.length.toLocaleString('ko-KR')}</strong><span className="harness-counter-divider">/</span>도구별 연결 <strong>{inventory.bindings.length.toLocaleString('ko-KR')}</strong></> : '아직 수집한 구성이 없습니다'}</p>
              {view === 'map' && <button type="button" className="harness-view-toggle" aria-pressed={listMode} onClick={() => setListMode(!listMode)}>{listMode ? '관계도로 보기' : '목록으로 보기'} <span aria-hidden="true">{listMode ? '⌘' : '≡'}</span></button>}
            </div>
            <div className="harness-filters">
              <label><span className="harness-sr-only">도구 필터</span><select aria-label="도구 필터" value={provider} onChange={event => { setProvider(event.target.value as ProviderId | 'all'); setPage(0) }}><option value="all">전체 도구</option>{providerIds.map(id => <option key={id} value={id}>{providerNames[id]}</option>)}</select></label>
              <label><span className="harness-sr-only">종류 필터</span><select aria-label="종류 필터" value={kind} onChange={event => { setKind(event.target.value as ResourceKind | 'all'); setPage(0) }}><option value="all">모든 종류</option>{resourceKinds.map(value => <option key={value} value={value}>{kindNames[value]}</option>)}</select></label>
              <button type="button" className="harness-shared-filter" aria-pressed={sharedOnly} onClick={() => { setSharedOnly(!sharedOnly); setPage(0) }}>공유 리소스{inventory ? ` ${index.shared.size.toLocaleString('ko-KR')}` : ''}</button>
              <label className="harness-search"><span className="harness-sr-only">리소스 검색</span><span aria-hidden="true">⌕</span><input aria-label="리소스 검색" type="search" placeholder="이름, 설명, 출처 검색" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label>
              <button type="button" className="harness-reset" onClick={resetFilters}>전체 보기</button>
            </div>

            <div className={`harness-workspace${showList ? ' is-list' : ''}`}>
              <div className="harness-explorer">
                <div className="harness-providers" aria-label="네 도구의 관측 상태">
                  {providerIds.map((id, position) => {
                    const observed = inventory?.providers.find(item => item.id === id)
                    const count = index.providerResources.get(id)?.size ?? 0
                    const countKnown = !!observed && (observed.status === 'ok' || !!observed.lastSuccessAt || count > 0)
                    return <button key={id} type="button" className={`harness-provider${provider === id ? ' is-selected' : ''}${provider !== 'all' && provider !== id ? ' is-muted' : ''}`} aria-pressed={provider === id} onClick={() => { setProvider(provider === id ? 'all' : id); setPage(0) }}>
                      <span className="harness-provider-top"><span className="harness-eyebrow">0{position + 1}</span><span>{example ? '예시 배정' : observed ? providerStatusNames[observed.status] : '미관측'}</span></span>
                      <strong className="harness-provider-name">{providerNames[id]}</strong>
                      <span className="harness-provider-count">{countKnown ? <><strong>{count.toLocaleString('ko-KR')}</strong>개 리소스</> : '리소스 미관측'}</span>
                      <span className="harness-provider-status">설치 · {example ? '예시' : observed?.installed === 'yes' ? '확인' : observed?.installed === 'no' ? '미발견' : '미확인'}</span>
                      <span className="harness-provider-status">설정 · {example ? '예시' : observed?.configured ? '발견' : observed ? '미발견' : '미관측'}</span>
                      <span className="harness-provider-status">실행 · {example ? '시연 데이터' : observed?.running === 'observed' ? '프로세스 관측' : observed?.running === 'not-observed' ? '미관측' : '미확인'}</span>
                    </button>
                  })}
                </div>
                <div className="harness-graph" aria-label="설정에서 발견한 도구와 리소스 종류별 연결">
                  <svg className="harness-connectors" viewBox="0 0 1000 70" preserveAspectRatio="none" aria-hidden="true">
                    {providerIds.flatMap((id, providerIndex) => resourceKinds.map((value, kindIndex) => {
                      if (!index.connections.has(`${id}:${value}`)) return null
                      const highlight = (provider === id || (provider === 'all' && selectedProviders.has(id))) && (kind === value || (kind === 'all' && selected?.kind === value))
                      return <path key={`${id}:${value}`} className={highlight ? 'is-selected' : ''} d={`M ${(providerIndex + .5) * 250} 0 V ${20 + providerIndex * 7} H ${(kindIndex + .5) * 1000 / resourceKinds.length} V 70`} />
                    }))}
                  </svg>
                  <div className="harness-kind-nodes">{resourceKinds.map(value => <button key={value} type="button" aria-pressed={kind === value} className={kind === value ? 'is-selected' : ''} onClick={() => selectKind(value)}><span>{kindNames[value]}</span><strong>{inventory ? kindCounts.get(value)?.toLocaleString('ko-KR') : '—'}</strong></button>)}</div>
                  <p className="harness-map-caption">종류를 선택해 펼쳐보세요. 같은 원본도 도구마다 적용 상태가 다릅니다.</p>
                  <div className="harness-legend"><span>─ {example ? '예시 연결' : '설정상 연결'}</span><span><i aria-hidden="true" />선택한 관계</span></div>
                </div>

                <div className="harness-resource-list" ref={listRef}>
                  <div className="harness-list-heading"><h3>{kind === 'all' ? '전체 리소스' : kindNames[kind]} <span>{inventory ? filteredResources.length.toLocaleString('ko-KR') : '—'}</span></h3><label><span className="harness-sr-only">리소스 정렬</span><select aria-label="리소스 정렬" value={sort} onChange={event => { setSort(event.target.value as Sort); setPage(0) }}><option value="name">이름순</option><option value="kind">종류순</option><option value="shared">공유 우선</option></select></label></div>
                  {!inventory ? <div className="harness-empty"><h3>{loading ? '내 PC 구성을 읽고 있습니다.' : '네 도구의 구성을 불러오세요.'}</h3><p>설정과 리소스의 위치를 읽어 연결을 보여줍니다. 도구나 업무를 실행하지 않습니다.</p>{onRefresh && <button type="button" disabled={loading} onClick={onRefresh}>{loading ? '수집 중…' : '내 PC 구성 수집 →'}</button>}</div> : filteredResources.length === 0 ? <div className="harness-empty"><h3>{inventory.resources.length === 0 ? '관측한 리소스가 없습니다.' : '조건에 맞는 리소스가 없습니다.'}</h3><p>{inventory.resources.length === 0 ? (lastSuccessful ? '표준 경로에 구성이 있는지 확인하거나 프로젝트 범위를 선택하세요.' : '수집 상태와 도구별 진단을 확인하세요.') : '검색어와 도구, 종류, 공유 조건을 바꿔보세요.'}</p>{inventory.resources.length > 0 && <button type="button" onClick={resetFilters}>전체 리소스 보기 →</button>}</div> : <>
                    <ul className="harness-resource-rows" aria-label="리소스 목록">{rows.map(resource => {
                      const bindings = index.bindings.get(resource.id) ?? []
                      const providers = [...new Set(bindings.map(binding => binding.providerId))]
                      const activeBindings = provider === 'all' ? bindings : bindings.filter(binding => binding.providerId === provider)
                      const states = [...new Set(activeBindings.map(binding => binding.enabledState))]
                      return <li key={resource.id}><button type="button" aria-pressed={selected?.id === resource.id} onClick={() => selectResource(resource)}>
                        <span className="harness-resource-kind">{kindNames[resource.kind]}</span><span className="harness-resource-identity"><strong>{resource.name}</strong><span>{providers.map(id => providerNames[id]).join(' · ') || '연결 미확인'}</span></span><span className="harness-resource-state">{states.length === 1 ? stateNames[states[0]] : states.length ? '도구별 상태 다름' : '적용 미확정'}</span><span className="harness-resource-sharing">{providers.length > 1 ? `${providers.length}개 도구 공유` : '개별 구성'}</span><span className="harness-resource-arrow" aria-hidden="true">↗</span>
                      </button></li>
                    })}</ul>
                    <button type="button" className="harness-mobile-detail-link" onClick={() => detailRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })}>선택한 리소스 상세 보기 ↓</button>
                    {pageCount > 1 && <div className="harness-pagination"><span>{visiblePage * pageSize + 1}–{Math.min((visiblePage + 1) * pageSize, filteredResources.length)} / {filteredResources.length.toLocaleString('ko-KR')}</span><div><button type="button" disabled={visiblePage === 0} onClick={() => { setPage(visiblePage - 1); listRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }) }}>이전</button><span>{visiblePage + 1} / {pageCount}</span><button type="button" disabled={visiblePage >= pageCount - 1} onClick={() => { setPage(visiblePage + 1); listRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }) }}>다음</button></div></div>}
                  </>}
                </div>
              </div>
              <div ref={detailRef} className="harness-detail-wrapper"><ResourceDetail resource={selected} bindings={selectedBindings} example={example} /></div>
            </div>
          </section>
          <section className="harness-workflow-teaser"><div><p className="harness-eyebrow">02 / FROM TOOLS TO WORK</p><h2>연결된 AI는 어떤 일을 할까요?</h2><p>조사, 상담 준비, 콘텐츠 기획. 업무가 결과로 이어지는 과정을 살펴보세요.</p></div><button type="button" className="harness-text-button" onClick={() => setView('workflows')}>세 가지 업무 흐름 보기 <span aria-hidden="true">→</span></button></section>
        </>}
      </main>
      <footer className="harness-footer"><span>QJC · AI 업무 시스템 설계와 구축</span><a href="https://qjc.app/contact?utm_source=harness_demo&utm_medium=product&utm_campaign=ax_showcase" target="_blank" rel="noopener noreferrer">우리 회사 AX 적용 상담 <span aria-hidden="true">→</span><span className="harness-sr-only"> (새 탭)</span></a></footer>
    </div>
  )
}
