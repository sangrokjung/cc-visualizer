import { useEffect, useState, useCallback } from 'react'
import { api } from '../../lib/api'

type Props = {
  filePath: string
  onClose: () => void
}

export default function FilePreview({ filePath, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.readFile(filePath).then((result) => {
      if (cancelled) return
      if (result.ok && result.content) {
        const lines = result.content.split('\n').slice(0, 50)
        setContent(lines.join('\n'))
      } else {
        setError(result.error ?? '파일을 읽을 수 없습니다')
      }
    })
    return () => { cancelled = true }
  }, [filePath])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-[720px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <code className="text-xs text-gray-400 truncate max-w-[600px]">
            {filePath}
          </code>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-lg ml-3"
          >
            x
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          {content !== null && (
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-5">
              {content}
            </pre>
          )}
          {content === null && !error && (
            <p className="text-gray-500 text-sm">로딩 중...</p>
          )}
        </div>
      </div>
    </div>
  )
}
