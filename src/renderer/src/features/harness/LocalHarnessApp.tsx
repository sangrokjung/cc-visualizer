import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import HarnessDashboard from './HarnessDashboard'
import { isDesktop, loadInventory, openContactPage } from './local-api'
import { contactUrl } from './WorkflowShowcase'
import { exampleInventory } from './example'
import type { Inventory } from './schema'

const LegacyOperations = lazy(() => import('./LegacyOperations'))

export default function LocalHarnessApp() {
  const [showcase, setShowcase] = useState(false)
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [project, setProject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactError, setContactError] = useState(false)
  const request = useRef(0)
  const refresh = useCallback(async (force: boolean) => {
    const current = ++request.current
    if (!isDesktop()) { setError('PC 수집은 데스크톱 앱에서 사용할 수 있습니다. 웹 시연은 예시 데모를 열어 주세요.'); return }
    setLoading(true)
    setError(null)
    try {
      const next = await loadInventory(project, force)
      if (current === request.current) setInventory(next)
    } catch {
      if (current === request.current) setError('수집 응답을 확인하지 못했습니다. 마지막 관측을 유지합니다. 잠시 후 다시 수집해 주세요.')
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [project])
  useEffect(() => { void refresh(false); return () => { request.current++ } }, [refresh])
  const changeProject = (value: string) => {
    if (value !== project) { request.current++; setInventory(null); setProject(value) }
  }
  const handleContact = (event: MouseEvent<HTMLDivElement>) => {
    if (!isDesktop() || !(event.target instanceof Element)) return
    const link = event.target.closest('a')
    if (link?.getAttribute('href') !== contactUrl) return
    event.preventDefault()
    setContactError(false)
    void openContactPage().catch(() => setContactError(true))
  }
  return <div onClickCapture={handleContact}>
    {contactError && <p role="alert">브라우저를 열지 못했습니다. 브라우저에서 qjc.app/contact를 열어 주세요.</p>}
    <HarnessDashboard key={showcase ? 'example' : 'local'} modeAction={<button type="button" onClick={() => setShowcase(!showcase)}>{showcase ? '내 PC로 돌아가기' : '기업 시연'}</button>} inventory={showcase ? exampleInventory : inventory} loading={!showcase && loading} error={showcase ? null : error} project={project} onProjectChange={changeProject} onRefresh={() => { void refresh(true) }} operations={!showcase && <Suspense fallback={<p>운영 상세를 불러오는 중입니다.</p>}><LegacyOperations /></Suspense>} />
  </div>
}
