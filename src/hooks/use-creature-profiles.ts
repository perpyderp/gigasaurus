'use client'

import { useEffect, useMemo, useState } from 'react'
import type { StoredCreature } from '@/lib/db'
import { normalizeBlueprintPath, type AseSpeciesEntry } from '@/lib/ark-stat-solver/ase-data'
import { buildProfiles, type CreatureProfile } from '@/lib/breeding'

// One request per blueprint for the lifetime of the page; species data never changes at runtime.
const speciesCache = new Map<string, Promise<AseSpeciesEntry | null>>()

function loadSpecies(dinoClass: string): Promise<AseSpeciesEntry | null> {
  const key = normalizeBlueprintPath(dinoClass)
  let pending = speciesCache.get(key)
  if (!pending) {
    pending = fetch(`/api/creatures/stat-params?bp=${encodeURIComponent(dinoClass)}`)
      .then((r) => (r.ok ? (r.json() as Promise<AseSpeciesEntry>) : null))
      .catch(() => null)
    speciesCache.set(key, pending)
  }
  return pending
}

/**
 * Level profiles (wild / mutated / tamed points, TE, lineage) for a set of
 * creatures. Pass the whole collection, not one creature, so parents can be
 * found to split wild from mutated levels.
 */
export function useCreatureProfiles(creatures: StoredCreature[] | null) {
  const [species, setSpecies] = useState<Map<string, AseSpeciesEntry | null> | null>(null)

  // Stable dependency: the set of distinct blueprints, not the array identity.
  const blueprintKey = useMemo(
    () => (creatures ? [...new Set(creatures.map((c) => c.dinoClass).filter(Boolean))].sort().join('\n') : null),
    [creatures],
  )

  useEffect(() => {
    if (blueprintKey === null) return
    let cancelled = false
    const classes = blueprintKey ? blueprintKey.split('\n') : []
    Promise.all(classes.map(async (dc) => [normalizeBlueprintPath(dc), await loadSpecies(dc)] as const)).then(
      (entries) => {
        if (!cancelled) setSpecies(new Map(entries))
      },
    )
    return () => {
      cancelled = true
    }
  }, [blueprintKey])

  const profiles = useMemo<Map<string, CreatureProfile> | null>(() => {
    if (!creatures || !species) return null
    return buildProfiles(creatures, (c) => (c.dinoClass ? (species.get(normalizeBlueprintPath(c.dinoClass)) ?? null) : null))
  }, [creatures, species])

  return { profiles, loading: profiles === null }
}

/** Grouping key for "same species" in the collection. */
export function speciesGroupKey(c: StoredCreature): string {
  return c.apiSlug ?? c.dinoNameTag.replace(/AA$/, '')
}
