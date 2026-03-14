import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Layout from './components/Layout'
import SearchBar from './components/SearchBar'

export type ViewType = 'dashboard' | 'agent-map' | 'architecture' | 'live-monitor' | 'catalog' | 'systems'

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard')

  const handleSearchNavigate = useCallback(
    (view: ViewType, _entityId: string) => {
      setActiveView(view)
      // TODO: 뷰 내부에서 entityId로 포커스/하이라이트 연동 (Phase 5 후속)
    },
    []
  )

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <Layout activeView={activeView} />
      <SearchBar onNavigate={handleSearchNavigate} />
    </div>
  )
}
