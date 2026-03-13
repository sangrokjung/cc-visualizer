import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Layout from './components/Layout'

export type ViewType = 'agent-map' | 'architecture' | 'live-monitor'

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('agent-map')

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <Layout activeView={activeView} />
    </div>
  )
}
