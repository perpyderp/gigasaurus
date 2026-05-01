'use client'

import { useState, useRef } from 'react'
import { IconRefresh, IconPencil, IconAlertTriangle, IconCheck } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import type { StoredCreature } from '@/lib/db'
import {
  reimportCreatureFromPath,
  reimportCreatureFromFile,
} from '@/lib/import-paths'

type Status = 'idle' | 'loading' | 'success' | 'failed'

interface Props {
  creature: StoredCreature
  onReimported: (creature: StoredCreature) => void
}

export function CreatureReimportButton({ creature, onReimported }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hasSavedPath = !!creature.importPathId

  const runReimport = async () => {
    setStatus('loading')
    setErrorMessage(null)
    try {
      if (hasSavedPath) {
        const { creature: updated } = await reimportCreatureFromPath(creature)
        onReimported(updated)
        setStatus('success')
        return
      }
      // No saved path linked — fall back to one-shot file picker.
      fileInputRef.current?.click()
      setStatus('idle')
    } catch (err) {
      setStatus('failed')
      setErrorMessage(err instanceof Error ? err.message : 'Re-import failed')
    }
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatus('loading')
    setErrorMessage(null)
    try {
      const { creature: updated } = await reimportCreatureFromFile(creature, file)
      onReimported(updated)
      setStatus('success')
    } catch (err) {
      setStatus('failed')
      setErrorMessage(err instanceof Error ? err.message : 'Re-import failed')
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={runReimport}
        disabled={status === 'loading'}
      >
        <IconRefresh size={13} className={status === 'loading' ? 'animate-spin' : ''} />
        {status === 'loading' ? 'Re-importing…' : 'Re-import'}
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        title="Pick a different .ini file"
        onClick={() => fileInputRef.current?.click()}
      >
        <IconPencil size={13} />
      </Button>

      {status === 'failed' && (
        <span
          className="text-destructive flex items-center gap-1 text-xs"
          title={errorMessage ?? 'Re-import failed'}
        >
          <IconAlertTriangle size={13} />
        </span>
      )}
      {status === 'success' && (
        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-xs" title="Re-imported successfully">
          <IconCheck size={13} />
        </span>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".ini"
        onChange={handleFilePick}
        className="hidden"
      />
    </div>
  )
}
