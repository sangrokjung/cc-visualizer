import { useEffect } from 'react'
import { useSystemDataContext } from './DataProvider'

interface UseRefreshShortcutOptions {
  enabled?: boolean
}

// 텍스트 입력 중 단축키 무시할 태그 목록
const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

// 새로고침 단축키 감지 — (Cmd|Ctrl)+R 또는 F5
const REFRESH_KEYS = ['r', 'F5'] as const

function isTextInputFocused(): boolean {
  const tag = document.activeElement?.tagName ?? ''
  return IGNORED_TAGS.has(tag)
}

function isRefreshShortcut(event: KeyboardEvent): boolean {
  if (event.key === 'F5') return true
  if ((event.metaKey || event.ctrlKey) && REFRESH_KEYS.includes(event.key as typeof REFRESH_KEYS[number])) return true
  return false
}

export function useRefreshShortcut({ enabled = true }: UseRefreshShortcutOptions = {}) {
  const { refreshSystem } = useSystemDataContext()

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (isTextInputFocused()) return
      if (!isRefreshShortcut(event)) return
      event.preventDefault()
      refreshSystem()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, refreshSystem])
}
