import type { ViewType } from '../App'
import { Suspense, lazy } from 'react'

const AgentMapView = lazy(() => import('../features/agent-map/AgentMapView'))
const ArchitectureView = lazy(() => import('../features/architecture/ArchitectureView'))
const LiveMonitorView = lazy(() => import('../features/live-monitor/LiveMonitorView'))

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
        {activeView === 'agent-map' && <AgentMapView />}
        {activeView === 'architecture' && <ArchitectureView />}
        {activeView === 'live-monitor' && <LiveMonitorView />}
      </Suspense>
    </main>
  )
}
