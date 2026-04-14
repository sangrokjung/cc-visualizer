import { useEffect, useRef, useState } from 'react'

// easeOutQuart 이징 함수: 빠르게 시작 → 느리게 도착
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

// 0에서 target까지 카운트업 애니메이션 훅
export function useCountUp(target: number, duration = 1000): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = performance.now()

    function animate(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutQuart(progress)
      setValue(Math.round(eased * target))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
