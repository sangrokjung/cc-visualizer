import { useEffect, useState } from 'react'

type ToastProps = {
  message: string
  /** 표시 시간 (ms). 기본 4000 */
  durationMs?: number
  onClose: () => void
}

// 우상단 슬라이드인 토스트 — 새로고침 결과 시각 피드백
// auto-dismiss + 사용자가 X 버튼으로 즉시 종료 가능
export function RefreshToast({ message, durationMs = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 마운트 직후 visible=true → translate-x 애니메이션 시작
    const showTimer = setTimeout(() => setVisible(true), 10)
    const hideTimer = setTimeout(() => setVisible(false), durationMs - 400)
    const closeTimer = setTimeout(onClose, durationMs)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
      clearTimeout(closeTimer)
    }
  }, [durationMs, onClose])

  return (
    <div
      className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3"
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: 'rgba(28, 33, 39, 0.95)',
        backdropFilter: 'blur(10px)',
        borderColor: '#2D72D2',
        boxShadow: '0 0 30px rgba(45,114,210,0.4), 0 10px 30px rgba(0,0,0,0.5)',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease'
      }}
    >
      <span className="text-lg" aria-hidden style={{ filter: 'drop-shadow(0 0 8px #29A634)' }}>
        ✨
      </span>
      <span className="text-sm font-medium" style={{ color: '#F6F7F9' }}>
        {message}
      </span>
      <button
        onClick={onClose}
        aria-label="닫기"
        className="ml-2 text-base leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
        style={{ color: '#738091' }}
      >
        ×
      </button>
    </div>
  )
}
