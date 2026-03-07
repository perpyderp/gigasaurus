'use client'

import { useCallback, useState } from 'react'
import { IconUpload, IconX, IconCheck, IconAlertCircle } from '@tabler/icons-react'
import { parseArkExport } from '@/lib/ark-parser'
import { resolveSlug, deriveDisplayName } from '@/lib/dino-map'
import { upsertCreature } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
  FileUploadList,
  FileUploadItem,
  FileUploadItemMetadata,
  FileUploadItemDelete,
  FileUploadClear,
} from '@/components/ui/file-upload'
import { Button } from '@/components/ui/button'

interface ImportResult {
  name: string
  status: 'new' | 'updated' | 'error'
  message?: string
}

interface ImportDropzoneProps {
  onImported: (creatures: StoredCreature[]) => void
}

export function ImportDropzone({ onImported }: ImportDropzoneProps) {
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [files, setFiles] = useState<File[]>([])

  const processFiles = useCallback(
    async (accepted: File[]) => {
      const iniFiles = accepted.filter((f) => f.name.endsWith('.ini'))
      if (!iniFiles.length) return

      setImporting(true)
      setResults([])
      const imported: StoredCreature[] = []
      const newResults: ImportResult[] = []

      for (const file of iniFiles) {
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

          const { getCreature } = await import('@/lib/db')
          const existing = await getCreature(creature.id)
          if (existing) creature.importedAt = existing.importedAt

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
    [onImported],
  )

  return (
    <div className="space-y-3">
      <FileUpload
        accept=".ini"
        multiple
        disabled={importing}
        value={files}
        onValueChange={setFiles}
        onAccept={processFiles}
      >
        <FileUploadDropzone className="gap-3 p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <IconUpload size={32} className="text-muted-foreground" />
            <div>
              <p className="text-foreground text-sm font-medium">
                {importing ? 'Importing…' : 'Drop .ini export files here'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">or click to browse · multiple files supported</p>
              <p className="text-muted-foreground/60 mt-1 font-mono text-xs">ShooterGame/Saved/DinoExports/</p>
            </div>
          </div>
          <FileUploadTrigger asChild>
            <Button variant="outline" size="sm" disabled={importing}>
              Browse files
            </Button>
          </FileUploadTrigger>
        </FileUploadDropzone>

        <FileUploadList>
          {files.map((file) => (
            <FileUploadItem key={file.name} value={file} className="text-sm">
              <FileUploadItemMetadata />
              <FileUploadItemDelete asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <IconX size={14} />
                </Button>
              </FileUploadItemDelete>
            </FileUploadItem>
          ))}
        </FileUploadList>

        <FileUploadClear asChild>
          <Button variant="ghost" size="sm" className="self-start text-xs">
            Clear all
          </Button>
        </FileUploadClear>
      </FileUpload>

      {results.length > 0 && (
        <ul className="space-y-1 text-sm">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              {r.status === 'new' && <IconCheck size={14} className="text-emerald-500 shrink-0" />}
              {r.status === 'updated' && <IconCheck size={14} className="text-sky-500 shrink-0" />}
              {r.status === 'error' && <IconAlertCircle size={14} className="text-destructive shrink-0" />}
              <span className="text-foreground">{r.name}</span>
              {r.status === 'updated' && <span className="text-muted-foreground text-xs">updated</span>}
              {r.message && <span className="text-xs text-destructive">{r.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
