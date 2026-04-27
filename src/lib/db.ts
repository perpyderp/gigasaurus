/**
 * IndexedDB store for imported ARK creatures.
 * Uses the `idb` library for a Promise-based API.
 *
 * Database: "gigasaurus" v2
 * Object store: "creatures" — keyed by the creature's 64-bit ARK ID (decimal string)
 *
 * Migration v1→v2:
 *   - id format changed from `${dinoId1}_${dinoId2}` to combined BigInt decimal string
 *   - Added fields: tribe, importFilename, manualParentMaleId, manualParentFemaleId
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { StoredCreature } from '@/schemas/stored-creature'
import { combineArkId } from '@/lib/ark-id'

export type { StoredCreature }

interface GigasaurusDB extends DBSchema {
  creatures: {
    key: string
    value: StoredCreature
    indexes: { by_slug: string; by_level: number; by_updated: number }
  }
}

let dbPromise: Promise<IDBPDatabase<GigasaurusDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<GigasaurusDB>('gigasaurus', 2, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion === 0) {
          // Fresh install — create store directly at v2 schema
          const store = db.createObjectStore('creatures', { keyPath: 'id' })
          store.createIndex('by_slug', 'apiSlug')
          store.createIndex('by_level', 'level')
          store.createIndex('by_updated', 'updatedAt')
          return
        }

        if (oldVersion === 1) {
          // Migrate v1 → v2:
          //   • Re-key id from "dinoId1_dinoId2" to combined 64-bit ARK ID string
          //   • Populate new nullable fields with defaults
          const store = tx.objectStore('creatures')
          const all = await store.getAll()
          for (const c of all as unknown as (StoredCreature & { tribe?: string; importFilename?: string | null; manualParentMaleId?: string | null; manualParentFemaleId?: string | null })[]) {
            const oldKey = c.id
            const newId = combineArkId(c.dinoId1, c.dinoId2)
            await store.delete(oldKey)
            await store.put({
              ...c,
              id: newId,
              tribe: c.tribe ?? '',
              importFilename: c.importFilename ?? null,
              manualParentMaleId: c.manualParentMaleId ?? null,
              manualParentFemaleId: c.manualParentFemaleId ?? null,
            } as StoredCreature)
          }
        }
      },
    })
  }
  return dbPromise
}

// ─── CRUD operations ───────────────────────────────────────────────────────────

export async function upsertCreature(creature: StoredCreature): Promise<void> {
  const db = await getDB()
  await db.put('creatures', creature)
}

export async function getCreature(id: string): Promise<StoredCreature | undefined> {
  const db = await getDB()
  return db.get('creatures', id)
}

export async function getAllCreatures(): Promise<StoredCreature[]> {
  const db = await getDB()
  const all = await db.getAll('creatures')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteCreature(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('creatures', id)
}

export async function getCreaturesBySlug(apiSlug: string): Promise<StoredCreature[]> {
  const db = await getDB()
  return db.getAllFromIndex('creatures', 'by_slug', apiSlug)
}

export async function clearAllCreatures(): Promise<void> {
  const db = await getDB()
  await db.clear('creatures')
}

/** Export all creatures as a plain JSON-serialisable array (for Drive backup). */
export async function exportAll(): Promise<StoredCreature[]> {
  return getAllCreatures()
}

/** Import creatures from a Drive backup, merging by id (newest updatedAt wins). */
export async function importFromBackup(creatures: StoredCreature[]): Promise<number> {
  const db = await getDB()
  let imported = 0
  for (const creature of creatures) {
    const existing = await db.get('creatures', creature.id)
    if (!existing || creature.updatedAt > existing.updatedAt) {
      await db.put('creatures', creature)
      imported++
    }
  }
  return imported
}
