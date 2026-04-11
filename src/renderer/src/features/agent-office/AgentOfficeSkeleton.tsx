import { memo } from 'react'

const PLACEHOLDER_COUNT = 10

function SkeletonAgent() {
  return (
    <div
      className="flex flex-col items-center animate-pulse"
      style={{ width: 80 }}
      aria-hidden="true"
    >
      {/* 머리 */}
      <div
        className="rounded"
        style={{ width: 36, height: 36, backgroundColor: '#252A31' }}
      />
      {/* 몸통 */}
      <div
        className="rounded mt-1"
        style={{ width: 44, height: 28, backgroundColor: '#1C2127' }}
      />
      {/* 책상 */}
      <div
        className="rounded mt-1"
        style={{ width: 52, height: 12, backgroundColor: '#1C2127' }}
      />
      {/* 이름 */}
      <div
        className="rounded mt-2"
        style={{ width: 44, height: 8, backgroundColor: '#252A31' }}
      />
    </div>
  )
}

function AgentOfficeSkeleton() {
  return (
    <div
      className="h-full flex flex-col"
      role="status"
      aria-live="polite"
      aria-label="에이전트 오피스 로딩 중"
      style={{ backgroundColor: '#0d0f14' }}
      data-testid="agent-office-skeleton"
    >
      {/* 툴바 placeholder */}
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ backgroundColor: '#1C2127', borderBottom: '1px solid #404854' }}
      >
        <div className="h-4 w-32 rounded animate-pulse" style={{ backgroundColor: '#252A31' }} />
        <div className="h-4 w-16 rounded animate-pulse" style={{ backgroundColor: '#252A31' }} />
        <div className="h-4 w-16 rounded animate-pulse" style={{ backgroundColor: '#252A31' }} />
        <div
          className="ml-auto h-4 w-40 rounded animate-pulse"
          style={{ backgroundColor: '#252A31' }}
        />
      </div>

      {/* 캔버스 placeholder */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div className="grid grid-cols-5 gap-x-6 gap-y-8">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
            <SkeletonAgent key={i} />
          ))}
        </div>
      </div>

      <span className="sr-only">에이전트 오피스를 불러오는 중입니다. 잠시만 기다려 주세요.</span>
    </div>
  )
}

export default memo(AgentOfficeSkeleton)
