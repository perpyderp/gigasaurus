'use client'

import { useState } from 'react'
import { IconCloudUpload, IconCloudDown, IconLoader2 } from '@tabler/icons-react'
import { uploadToDrive, downloadFromDrive } from '@/lib/drive'
import { exportAll, importFromBackup } from '@/lib/db'
import { Button } from '@/components/ui/button'

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
      <p className="text-muted-foreground text-xs">
        Google Drive sync is not configured.{' '}
        <code className="text-foreground">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> missing.
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
        <Button variant="outline" size="sm" onClick={handleBackup} disabled={busy} className="gap-2">
          {status === 'uploading'
            ? <IconLoader2 size={14} className="animate-spin" />
            : <IconCloudUpload size={14} />
          }
          Backup to Drive
        </Button>
        <Button variant="outline" size="sm" onClick={handleRestore} disabled={busy} className="gap-2">
          {status === 'downloading'
            ? <IconLoader2 size={14} className="animate-spin" />
            : <IconCloudDown size={14} />
          }
          Restore from Drive
        </Button>
      </div>

      {message && (
        <p className={`text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {message}
        </p>
      )}

      <p className="text-muted-foreground/60 text-xs">
        Stored privately in your Google Drive AppData — not visible in your Drive.
      </p>
    </div>
  )
}
