import { useState } from 'react'
import type { RuleFile } from '../../lib/types'
import FilePreview from './FilePreview'

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-600/30 text-red-400 border-red-600/40',
  important: 'bg-yellow-600/30 text-yellow-400 border-yellow-600/40',
  normal: 'bg-gray-600/30 text-gray-400 border-gray-600/40',
}

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'CRITICAL',
  important: 'IMPORTANT',
  normal: 'NORMAL',
}

function resolveHomePath(p: string): string {
  return p.replace(/^~/, process.env.HOME ?? '/Users/sangrok')
}

type Props = {
  rules: RuleFile[]
}

export default function RulesList({ rules }: Props) {
  const [previewPath, setPreviewPath] = useState<string | null>(null)

  const criticalCount = rules.filter((r) => r.priority === 'critical').length
  const importantCount = rules.filter((r) => r.priority === 'important').length
  const normalCount = rules.filter((r) => r.priority === 'normal').length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-1">
        <h2 className="text-sm font-semibold text-gray-300">
          Rules ({rules.length}개)
        </h2>
        <div className="flex gap-2 text-[10px]">
          <span className="text-red-400">{criticalCount} CRITICAL</span>
          <span className="text-yellow-400">{importantCount} IMPORTANT</span>
          <span className="text-gray-400">{normalCount} NORMAL</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rules.map((rule) => (
          <button
            key={rule.name}
            onClick={() => setPreviewPath(resolveHomePath(rule.path))}
            className="text-left bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 hover:bg-gray-800 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_BADGE[rule.priority]}`}>
                {PRIORITY_LABEL[rule.priority]}
              </span>
            </div>
            <code className="text-[11px] text-gray-300 font-mono">
              {rule.name}
            </code>
          </button>
        ))}
      </div>
      {previewPath && (
        <FilePreview
          filePath={previewPath}
          onClose={() => setPreviewPath(null)}
        />
      )}
    </div>
  )
}
