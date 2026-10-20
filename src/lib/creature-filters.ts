/**
 * Search, filter and sort for lists of the user's imported creatures. Shared by
 * the My Creatures page and the "your tames" list on species pages.
 */

import type { StoredCreature } from '@/lib/db'
import { readTamedName } from '@/lib/ark-parser'

export type CreatureSort = 'updated' | 'imported' | 'level' | 'melee' | 'health' | 'mutations' | 'name'

export interface CreatureFilterState {
  search: string
  /** '' = any, 'm' = male, 'f' = female */
  gender: string
  sort: string
  /** '' = any, '1' = has mutations, '0' = no mutations */
  mutations: string
  /** dinoNameTag without the AA suffix; '' = all species */
  species: string
}

export const DEFAULT_SORT: CreatureSort = 'updated'

export const EMPTY_FILTERS: CreatureFilterState = { search: '', gender: '', sort: DEFAULT_SORT, mutations: '', species: '' }

// value → label maps so Base UI's Select.Value shows clean text (e.g. "Any gender")
// instead of the raw stored value (e.g. "__all"). See @/components/ui/select.
export const GENDER_LABELS: Record<string, string> = { __all: 'Any gender', m: '♂ Male', f: '♀ Female' }
export const SORT_LABELS: Record<CreatureSort, string> = {
  updated: 'Recently updated',
  imported: 'Recently imported',
  level: 'Highest level',
  melee: 'Highest melee',
  health: 'Highest health',
  mutations: 'Most mutations',
  name: 'Name A–Z',
}
export const MUTATION_LABELS: Record<string, string> = { __all: 'Any', '1': 'Has mutations', '0': 'No mutations' }

export function speciesTag(c: StoredCreature): string {
  return c.dinoNameTag.replace(/AA$/, '')
}

export function totalMutations(c: StoredCreature): number {
  return c.mutationsMale + c.mutationsFemale
}

/** The name the creature has in game, which may differ from the label it was given here. */
export function inGameName(c: StoredCreature): string {
  return readTamedName(c.rawIni)
}

/** Filters that narrow the list (search and sort order aside). */
export function activeFilterCount(state: CreatureFilterState): number {
  return [state.gender !== '', state.species !== '', state.mutations !== '', state.sort !== DEFAULT_SORT].filter(Boolean).length
}

export function filterAndSortCreatures(creatures: StoredCreature[], state: CreatureFilterState): StoredCreature[] {
  let result = [...creatures]

  const q = state.search.trim().toLowerCase()
  if (q) {
    result = result.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      inGameName(c).toLowerCase().includes(q) ||
      c.dinoNameTag.toLowerCase().includes(q) ||
      c.tribe.toLowerCase().includes(q) ||
      c.tamer.toLowerCase().includes(q)
    )
  }
  if (state.species) result = result.filter((c) => speciesTag(c) === state.species)
  if (state.gender === 'm') result = result.filter((c) => !c.isFemale)
  if (state.gender === 'f') result = result.filter((c) => c.isFemale)
  if (state.mutations === '1') result = result.filter((c) => totalMutations(c) > 0)
  if (state.mutations === '0') result = result.filter((c) => totalMutations(c) === 0)

  result.sort((a, b) => {
    switch (state.sort as CreatureSort) {
      case 'level': return b.level - a.level
      case 'melee': return b.stats.meleeDamage - a.stats.meleeDamage
      case 'health': return b.stats.health - a.stats.health
      case 'mutations': return totalMutations(b) - totalMutations(a)
      case 'name': return a.name.localeCompare(b.name)
      case 'imported': return b.importedAt - a.importedAt
      default: return b.updatedAt - a.updatedAt
    }
  })

  return result
}

/** Clamp the page and slice out its items. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  return { totalPages, page: current, items: items.slice((current - 1) * pageSize, current * pageSize) }
}
