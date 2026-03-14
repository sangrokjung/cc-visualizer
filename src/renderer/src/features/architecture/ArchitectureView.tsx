import { useState, lazy, Suspense } from 'react'

const PipelineFlow = lazy(() => import('./PipelineFlow'))
const HookFlow = lazy(() => import('./HookFlow'))

type Tab = 'pipeline' | 'hookflow'

const TABS: { key: Tab; label: string }[] = [
  { key: 'pipeline', label: '파이프라인 플로우' },
  { key: 'hookflow', label: '훅 이벤트 플로우' }
]

export default function ArchitectureView() {
  const [tab, setTab] = useState<Tab>('pipeline')

  return (
    <div className="h-full flex flex-col">
      {/* 탭 헤더 */}
      <div className="flex items-center border-b border-gray-800 bg-gray-900 px-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === t.key
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              로딩 중...
            </div>
          }
        >
          {tab === 'pipeline' && <PipelineFlow />}
          {tab === 'hookflow' && <HookFlow />}
        </Suspense>
      </div>
    </div>
  )
}
