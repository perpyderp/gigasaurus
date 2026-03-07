'use client'

import { useState } from 'react'
import { uploadToDrive, downloadFromDrive } from '@/lib/drive'
import { exportAll, importFromBackup } from '@/lib/db'

interface DriveSyncProps {
  onRestored: () => void
}

type Status = 'idle' | 'uploading' | 'downloading' | 'success' | 'error'

export function DriveSync({ onRestored }: DriveSyncProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  if (!clientId) {
    return (
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Google Drive sync is not configured.{' '}
        <span className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span> missing.
      </p>
    )
  }

  const handleBackup = async () => {
    setStatus('uploading')
    setMessage('')
    try {
      const creatures = await exportAll()
      const count = await uploadToDrive(creatures)
      setStatus('success')
      setMessage(`Backed up ${count} creature${count === 1 ? '' : 's'} to Google Drive.`)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Backup failed')
    }
  }

  const handleRestore = async () => {
    setStatus('downloading')
    setMessage('')
    try {
      const creatures = await downloadFromDrive()
      if (!creatures) {
        setStatus('success')
        setMessage('No backup found in Google Drive.')
        return
      }
      const imported = await importFromBackup(creatures)
      setStatus('success')
      setMessage(`Restored ${imported} creature${imported === 1 ? '' : 's'} from Google Drive.`)
      onRestored()
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Restore failed')
    }
  }

  const busy = status === 'uploading' || status === 'downloading'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleBackup}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {status === 'uploading' ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <span>☁️</span>
          )}
          Backup to Drive
        </button>
        <button
          onClick={handleRestore}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {status === 'downloading' ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <span>⬇️</span>
          )}
          Restore from Drive
        </button>
      </div>

      {message && (
        <p
          className={`text-xs ${
            status === 'error'
              ? 'text-red-500'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {message}
        </p>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Stored privately in your Google Drive AppData — not visible in your Drive.
      </p>
    </div>
  )
}
