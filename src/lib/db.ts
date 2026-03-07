/**
 * IndexedDB store for imported ARK creatures.
 * Uses the `idb` library for a Promise-based API.
 *
 * Database: "gigasaurus" v1
 * Object store: "creatures" — keyed by the creature's unique ARK id (DinoID1_DinoID2)
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { StoredCreature } from '@/schemas/stored-creature'

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
    dbPromise = openDB<GigasaurusDB>('gigasaurus', 1, {
      upgrade(db) {
        const store = db.createObjectStore('creatures', { keyPath: 'id' })
        store.createIndex('by_slug', 'apiSlug')
        store.createIndex('by_level', 'level')
        store.createIndex('by_updated', 'updatedAt')
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
