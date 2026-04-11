import type { ViewType } from '../App'
import { Suspense, lazy } from 'react'
import AgentOfficeErrorBoundary from '../features/agent-office/AgentOfficeErrorBoundary'
import AgentOfficeSkeleton from '../features/agent-office/AgentOfficeSkeleton'

const DashboardView = lazy(() => import('../features/dashboard/DashboardView'))
const AgentMapView = lazy(() => import('../features/agent-map/AgentMapView'))
const ArchitectureView = lazy(() => import('../features/architecture/ArchitectureView'))
const LiveMonitorView = lazy(() => import('../features/live-monitor/LiveMonitorView'))
const CatalogView = lazy(() => import('../features/catalog/CatalogView'))
const SystemsView = lazy(() => import('../features/systems/SystemsView'))
const UsageView = lazy(() => import('../features/usage/UsageView'))
const ProcessView = lazy(() => import('../features/process/ProcessView'))
const AgentOfficeView = lazy(() => import('../features/agent-office/AgentOfficeView'))

type Props = {
  activeView: ViewType
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full text-gray-500">
      로딩 중...
    </div>
  )
}

export default function Layout({ activeView }: Props) {
  return (
    <main className="flex-1 overflow-hidden">
      <Suspense fallback={<LoadingFallback />}>
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'agent-map' && <AgentMapView />}
        {activeView === 'architecture' && <ArchitectureView />}
        {activeView === 'live-monitor' && <LiveMonitorView />}
        {activeView === 'catalog' && <CatalogView />}
        {activeView === 'systems' && <SystemsView />}
        {activeView === 'usage' && <UsageView />}
        {activeView === 'process' && <ProcessView />}
        {activeView === 'agent-office' && (
          <AgentOfficeErrorBoundary>
            <Suspense fallback={<AgentOfficeSkeleton />}>
              <AgentOfficeView />
            </Suspense>
          </AgentOfficeErrorBoundary>
        )}
      </Suspense>
    </main>
  )
}
