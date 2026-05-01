/**
 * Saved import paths — persists `FileSystemDirectoryHandle` objects in IndexedDB
 * so users can re-scan their `DinoExports/` folder without re-picking it every time.
 *
 * Browser support: FSA / showDirectoryPicker is Chromium-only (Chrome, Edge, Brave).
 * `isFsaSupported()` lets callers gate UI for unsupported browsers.
 *
 * Permission model: even with a stored handle, the browser may prompt for
 * read permission on a fresh session. We always queryPermission first and
 * requestPermission only inside a user gesture.
 */

import { openDB } from 'idb'
import { parseArkExport } from '@/lib/ark-parser'
import { resolveSlug, deriveDisplayName } from '@/lib/dino-map'
import { upsertCreature, getCreature } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { combineArkId } from '@/lib/ark-id'

// ─── DB ──────────────────────────────────────────────────────────────────────

interface SavedPath {
  id: string
  label: string
  handle: FileSystemDirectoryHandle
  addedAt: number
}

const PATHS_DB_NAME = 'gigasaurus-paths'
const PATHS_STORE = 'paths'

function getPathsDB() {
  return openDB(PATHS_DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PATHS_STORE)) {
        db.createObjectStore(PATHS_STORE, { keyPath: 'id' })
      }
    },
  })
}

// ─── Browser capability ───────────────────────────────────────────────────────

export function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listPaths(): Promise<SavedPath[]> {
  const db = await getPathsDB()
  const all = (await db.getAll(PATHS_STORE)) as SavedPath[]
  return all.sort((a, b) => b.addedAt - a.addedAt)
}

export async function getPath(id: string): Promise<SavedPath | undefined> {
  const db = await getPathsDB()
  return (await db.get(PATHS_STORE, id)) as SavedPath | undefined
}

export async function deletePath(id: string): Promise<void> {
  const db = await getPathsDB()
  await db.delete(PATHS_STORE, id)
}

export async function renamePath(id: string, label: string): Promise<void> {
  const db = await getPathsDB()
  const existing = (await db.get(PATHS_STORE, id)) as SavedPath | undefined
  if (!existing) return
  await db.put(PATHS_STORE, { ...existing, label })
}

export async function addPath(): Promise<SavedPath | null> {
  if (!isFsaSupported()) throw new Error('Directory picker not supported in this browser')
  const handle = await (window as unknown as {
    showDirectoryPicker: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker({ id: 'gigasaurus-import', mode: 'read' })

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const saved: SavedPath = {
    id,
    label: handle.name,
    handle,
    addedAt: Date.now(),
  }
  const db = await getPathsDB()
  await db.put(PATHS_STORE, saved)
  return saved
}

// ─── Permission ──────────────────────────────────────────────────────────────

interface PermissibleHandle {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
}

export async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as unknown as PermissibleHandle
  const opts = { mode: 'read' as const }
  const queried = h.queryPermission ? await h.queryPermission(opts) : 'prompt'
  if (queried === 'granted') return true
  if (!h.requestPermission) return false
  const requested = await h.requestPermission(opts)
  return requested === 'granted'
}

// ─── Import flow ─────────────────────────────────────────────────────────────

export interface ImportOutcome {
  imported: StoredCreature[]
  results: Array<{ name: string; status: 'new' | 'updated' | 'error'; message?: string }>
}

async function importIniText(
  text: string,
  filename: string,
  importPathId: string | null,
): Promise<{ creature: StoredCreature; existed: boolean }> {
  const parsed = parseArkExport(text)
  const apiSlug = resolveSlug(parsed.dinoNameTag, parsed.dinoClass)
  const name = deriveDisplayName(parsed.tamedName, parsed.dinoNameTag)
  const arkId = combineArkId(parsed.dinoId1, parsed.dinoId2)
  const now = Date.now()
  const existing = await getCreature(arkId)
  const creature: StoredCreature = {
    id: arkId,
    dinoId1: parsed.dinoId1,
    dinoId2: parsed.dinoId2,
    dinoClass: parsed.dinoClass,
    dinoNameTag: parsed.dinoNameTag,
    name,
    isFemale: parsed.isFemale,
    isNeutered: parsed.isNeutered,
    tribe: parsed.tribe,
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
    importFilename: filename,
    importPathId: importPathId ?? existing?.importPathId ?? null,
    manualParentMaleId: existing?.manualParentMaleId ?? null,
    manualParentFemaleId: existing?.manualParentFemaleId ?? null,
    importedAt: existing?.importedAt ?? now,
    updatedAt: now,
  }
  await upsertCreature(creature)
  return { creature, existed: !!existing }
}

/** Re-scan a saved path: import every `.ini` file it contains. */
export async function importAllFromPath(pathId: string): Promise<ImportOutcome> {
  const saved = await getPath(pathId)
  if (!saved) throw new Error('Saved path not found')
  const granted = await ensureReadPermission(saved.handle)
  if (!granted) throw new Error('Read permission denied for saved folder')

  const imported: StoredCreature[] = []
  const results: ImportOutcome['results'] = []

  // FSA's `values()` async iterator isn't yet in the standard lib.dom typings.
  const dirIter = (saved.handle as unknown as { values: () => AsyncIterableIterator<FileSystemHandle> }).values()
  for await (const entry of dirIter) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.ini')) continue
    try {
      const file = await (entry as FileSystemFileHandle).getFile()
      const text = await file.text()
      const { creature, existed } = await importIniText(text, file.name, pathId)
      imported.push(creature)
      results.push({
        name: `${creature.name || creature.dinoNameTag} (Lv ${creature.level})`,
        status: existed ? 'updated' : 'new',
      })
    } catch (err) {
      results.push({
        name: entry.name,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return { imported, results }
}

/** Re-import a single creature by locating its filename in a saved folder. */
export async function reimportCreatureFromPath(
  creature: StoredCreature,
): Promise<{ creature: StoredCreature }> {
  if (!creature.importPathId) throw new Error('No saved path linked to this creature')
  if (!creature.importFilename) throw new Error('No filename recorded for this creature')

  const saved = await getPath(creature.importPathId)
  if (!saved) throw new Error('Saved path no longer exists — please re-add it')
  const granted = await ensureReadPermission(saved.handle)
  if (!granted) throw new Error('Read permission denied for saved folder')

  let fileHandle: FileSystemFileHandle | null = null
  try {
    fileHandle = await saved.handle.getFileHandle(creature.importFilename)
  } catch {
    throw new Error(`File "${creature.importFilename}" not found in "${saved.label}"`)
  }

  const file = await fileHandle.getFile()
  const text = await file.text()
  const { creature: updated } = await importIniText(text, file.name, creature.importPathId)
  return { creature: updated }
}

/** Manually link a creature to a single .ini file (used by the "edit" path action). */
export async function reimportCreatureFromFile(
  creature: StoredCreature,
  file: File,
): Promise<{ creature: StoredCreature }> {
  const text = await file.text()
  const { creature: updated } = await importIniText(text, file.name, creature.importPathId ?? null)
  return { creature: updated }
}
