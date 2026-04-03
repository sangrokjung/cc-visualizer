import { useSystemDataContext } from '../../lib/DataProvider'

// 파이프라인 step의 타입에 따른 스타일
function stepStyle(auto: boolean): React.CSSProperties {
  return auto
    ? {
        backgroundColor: 'rgba(41,166,52,0.1)',
        border: '1px solid rgba(41,166,52,0.3)',
        color: '#29A634'
      }
    : {
        backgroundColor: 'rgba(209,152,11,0.1)',
        border: '1px solid rgba(209,152,11,0.3)',
        color: '#D1980B'
      }
}

// 11개 파이프라인을 카드 형태로 표시
export function PipelineCards() {
  const { systemData } = useSystemDataContext()
  const pipelines = systemData.pipelines

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: '#1C2127', borderColor: '#404854' }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#F6F7F9' }}>
        파이프라인
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {pipelines.map((pipeline) => (
          <div
            key={pipeline.name}
            className="rounded-xl p-4"
            style={{ backgroundColor: 'rgba(37,42,49,0.6)' }}
          >
            {/* 상단: 파이프라인명 + step 수 */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-sm font-medium truncate mr-2"
                style={{ color: '#F6F7F9' }}
              >
                {pipeline.name}
              </span>
              <span
                className="text-xs rounded-full px-2 shrink-0"
                style={{
                  backgroundColor: 'rgba(45,114,210,0.2)',
                  color: '#2D72D2'
                }}
              >
                {pipeline.steps.length}
              </span>
            </div>

            {/* 하단: steps flow */}
            <div className="max-h-20 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1">
                {pipeline.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1">
                    {/* from 뱃지 (첫 step에서 from이 비어있으면 생략) */}
                    {step.from && i === 0 && (
                      <>
                        <span
                          className="text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap"
                          style={stepStyle(step.auto)}
                        >
                          {step.from}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: '#404854' }}
                        >
                          &rarr;
                        </span>
                      </>
                    )}
                    {/* to 뱃지 */}
                    <span
                      className="text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap"
                      style={stepStyle(step.auto)}
                    >
                      {step.to}
                    </span>
                    {/* 화살표 (마지막이 아닐 때) */}
                    {i < pipeline.steps.length - 1 && (
                      <span
                        className="text-[10px]"
                        style={{ color: '#404854' }}
                      >
                        &rarr;
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
