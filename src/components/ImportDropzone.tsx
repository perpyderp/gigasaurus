'use client'

import { useCallback, useState } from 'react'
import { parseArkExport } from '@/lib/ark-parser'
import { resolveSlug, deriveDisplayName } from '@/lib/dino-map'
import { upsertCreature } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'

interface ImportResult {
  name: string
  status: 'new' | 'updated' | 'error'
  message?: string
}

interface ImportDropzoneProps {
  onImported: (creatures: StoredCreature[]) => void
}

export function ImportDropzone({ onImported }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [importing, setImporting] = useState(false)

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => f.name.endsWith('.ini'))
      if (!fileArray.length) return

      setImporting(true)
      setResults([])
      const imported: StoredCreature[] = []
      const newResults: ImportResult[] = []

      for (const file of fileArray) {
        try {
          const text = await file.text()
          const parsed = parseArkExport(text)
          const apiSlug = resolveSlug(parsed.dinoNameTag, parsed.dinoClass)
          const name = deriveDisplayName(parsed.tamedName, parsed.dinoNameTag)
          const now = Date.now()

          const creature: StoredCreature = {
            id: parsed.id,
            dinoId1: parsed.dinoId1,
            dinoId2: parsed.dinoId2,
            dinoClass: parsed.dinoClass,
            dinoNameTag: parsed.dinoNameTag,
            name,
            isFemale: parsed.isFemale,
            isNeutered: parsed.isNeutered,
            tamer: parsed.tamer,
            imprinter: parsed.imprinter,
            babyAge: parsed.babyAge,
            level: parsed.level,
            imprintQuality: parsed.imprintQuality,
            mutationsMale: parsed.mutationsMale,
            mutationsFemale: parsed.mutationsFemale,
            colors: parsed.colors,
            stats: parsed.stats,
            ancestors: parsed.ancestors,
            ancestorsMale: parsed.ancestorsMale,
            apiSlug,
            rawIni: text,
            importedAt: now,
            updatedAt: now,
          }

          // Check if existing — if so, preserve importedAt and mark as updated
          const { getCreature } = await import('@/lib/db')
          const existing = await getCreature(creature.id)
          if (existing) {
            creature.importedAt = existing.importedAt
          }

          await upsertCreature(creature)
          imported.push(creature)
          newResults.push({
            name: `${name || parsed.dinoNameTag} (Lv ${parsed.level})`,
            status: existing ? 'updated' : 'new',
          })
        } catch (err) {
          newResults.push({
            name: file.name,
            status: 'error',
            message: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      setResults(newResults)
      setImporting(false)
      if (imported.length) onImported(imported)
    },
    [onImported]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files)
    },
    [processFiles]
  )

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
        }`}
      >
        <input
          type="file"
          accept=".ini"
          multiple
          className="sr-only"
          onChange={onFileChange}
          disabled={importing}
        />
        <span className="text-3xl">📂</span>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {importing ? 'Importing…' : 'Drop .ini export files here'}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            or click to browse · multiple files supported
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Found in: ShooterGame/Saved/DinoExports/
          </p>
        </div>
      </label>

      {results.length > 0 && (
        <ul className="space-y-1 text-sm">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <span>
                {r.status === 'new' ? '✅' : r.status === 'updated' ? '🔄' : '❌'}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">{r.name}</span>
              {r.status === 'updated' && (
                <span className="text-xs text-zinc-400">updated</span>
              )}
              {r.message && (
                <span className="text-xs text-red-500">{r.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
