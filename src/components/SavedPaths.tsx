'use client'

import { useEffect, useState, useCallback } from 'react'
import { IconFolderPlus, IconRefresh, IconTrash, IconPencil, IconX, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import {
  isFsaSupported,
  listPaths,
  addPath,
  deletePath,
  renamePath,
  importAllFromPath,
} from '@/lib/import-paths'
import type { StoredCreature } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SavedPath {
  id: string
  label: string
  addedAt: number
}

interface Props {
  onImported: (creatures: StoredCreature[]) => void
}

export function SavedPaths({ onImported }: Props) {
  const [paths, setPaths] = useState<SavedPath[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPathId, setBusyPathId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultsByPath, setResultsByPath] = useState<Record<string, { ok: number; failed: number }>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const reload = useCallback(async () => {
    const all = await listPaths()
    setPaths(all.map(({ id, label, addedAt }) => ({ id, label, addedAt })))
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleAdd = async () => {
    setError(null)
    try {
      await addPath()
      await reload()
    } catch (err) {
      // User-cancelled directory pickers throw AbortError — swallow silently.
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    await deletePath(id)
    await reload()
  }

  const handleReimport = async (id: string) => {
    setBusyPathId(id)
    setError(null)
    try {
      const { imported, results } = await importAllFromPath(id)
      const ok = results.filter((r) => r.status !== 'error').length
      const failed = results.filter((r) => r.status === 'error').length
      setResultsByPath((prev) => ({ ...prev, [id]: { ok, failed } }))
      if (imported.length) onImported(imported)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-import failed')
    } finally {
      setBusyPathId(null)
    }
  }

  const handleSaveLabel = async (id: string) => {
    if (editLabel.trim()) await renamePath(id, editLabel.trim())
    setEditingId(null)
    await reload()
  }

  if (!isFsaSupported()) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-4 text-xs">
          Saved folders aren&apos;t supported in this browser. Use Chrome, Edge, or Brave to save your{' '}
          <code className="font-mono">DinoExports/</code> folder for one-click re-imports.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground text-sm font-medium">Saved Folders</p>
        <Button variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
          <IconFolderPlus size={13} /> Add folder
        </Button>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
          <IconAlertTriangle size={13} /> {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-xs">Loading…</p>
      ) : paths.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Save a folder to re-import all <code className="font-mono">.ini</code> exports inside it with one click.
        </p>
      ) : (
        <ul className="space-y-2">
          {paths.map((p) => {
            const result = resultsByPath[p.id]
            return (
              <li key={p.id}>
                <Card className="p-0">
                  <CardContent className="flex items-center gap-2 p-3">
                    {editingId === p.id ? (
                      <Input
                        autoFocus
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveLabel(p.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="h-7 flex-1 text-sm"
                      />
                    ) : (
                      <span className="text-foreground flex-1 truncate text-sm font-medium">{p.label}</span>
                    )}

                    {result && (
                      <Badge
                        variant={result.failed > 0 ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {result.ok} ok{result.failed > 0 ? ` / ${result.failed} failed` : ''}
                      </Badge>
                    )}

                    {editingId === p.id ? (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleSaveLabel(p.id)} title="Save name">
                          <IconCheck size={14} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(null)} title="Cancel">
                          <IconX size={14} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={busyPathId === p.id}
                          onClick={() => handleReimport(p.id)}
                        >
                          <IconRefresh size={12} />
                          {busyPathId === p.id ? 'Importing…' : 'Re-import'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setEditingId(p.id); setEditLabel(p.label) }}
                          title="Rename"
                        >
                          <IconPencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(p.id)}
                          title="Remove saved path"
                          className="text-destructive hover:text-destructive"
                        >
                          <IconTrash size={13} />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
