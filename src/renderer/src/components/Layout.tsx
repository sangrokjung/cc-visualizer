import type { ViewType } from '../App'
import { Suspense, lazy } from 'react'
import AgentOfficeErrorBoundary from '../features/agent-office/AgentOfficeErrorBoundary'
import AgentOfficeSkeleton from '../features/agent-office/AgentOfficeSkeleton'
import ViewErrorBoundary from './ViewErrorBoundary'

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
        {activeView === 'dashboard' && (
          <ViewErrorBoundary viewName="시스템 개요">
            <DashboardView />
          </ViewErrorBoundary>
        )}
        {activeView === 'agent-map' && (
          <ViewErrorBoundary viewName="에이전트 맵">
            <AgentMapView />
          </ViewErrorBoundary>
        )}
        {activeView === 'architecture' && (
          <ViewErrorBoundary viewName="시스템 아키텍처">
            <ArchitectureView />
          </ViewErrorBoundary>
        )}
        {activeView === 'live-monitor' && (
          <ViewErrorBoundary viewName="실시간 모니터">
            <LiveMonitorView />
          </ViewErrorBoundary>
        )}
        {activeView === 'catalog' && (
          <ViewErrorBoundary viewName="카탈로그">
            <CatalogView />
          </ViewErrorBoundary>
        )}
        {activeView === 'systems' && (
          <ViewErrorBoundary viewName="자동화 생태계">
            <SystemsView />
          </ViewErrorBoundary>
        )}
        {activeView === 'usage' && (
          <ViewErrorBoundary viewName="사용 통계">
            <UsageView />
          </ViewErrorBoundary>
        )}
        {activeView === 'process' && (
          <ViewErrorBoundary viewName="개발 프로세스">
            <ProcessView />
          </ViewErrorBoundary>
        )}
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
