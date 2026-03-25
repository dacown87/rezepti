import React, { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

interface ChangelogModalProps {
  onClose: () => void
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [currentVersion, setCurrentVersion] = useState('')

  const close = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    fetch('/changelog.json')
      .then(r => r.json())
      .then(data => {
        setCurrentVersion(data.version ?? '')
        setEntries(data.entries ?? [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={close}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-warmgray/10">
          <div>
            <h2 className="text-xl font-display font-bold">Changelog</h2>
            {currentVersion && (
              <p className="text-sm text-warmgray mt-0.5">Aktuelle Version: v{currentVersion}</p>
            )}
          </div>
          <button
            onClick={close}
            className="p-2 hover:bg-warmgray/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-6">
          {entries.length === 0
            ? <p className="text-warmgray text-sm">Keine Einträge vorhanden.</p>
            : entries.map((log) => (
              <div key={log.version} className="border-b border-warmgray/10 pb-4 last:border-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-paprika text-white px-3 py-1 rounded-full text-sm font-bold">
                    {log.version}
                  </span>
                  <span className="text-warmgray text-sm">{log.date}</span>
                </div>
                <ul className="space-y-1">
                  {log.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-warmgray">
                      <span className="w-1.5 h-1.5 bg-paprika rounded-full mt-1.5 flex-shrink-0" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

export default ChangelogModal
