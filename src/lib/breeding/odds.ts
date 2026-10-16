/**
 * Collection bests and breeding-pair odds (ASA rules, see the ark-breeding skill).
 */

import type { AseStatKey } from '@/lib/ark-stat-solver/ase-data'
import type { CreatureProfile, StatLevels } from './profile'
import { MUTATION_CHANCE, MUTATION_COUNTER_LIMIT, MUTATION_ROLLS, P_INHERIT_HIGHER } from './constants'

// ─── Collection bests ──────────────────────────────────────────────────────────

export interface StatBest {
  /** Highest wild levels among creatures whose wild/mutated split is known. */
  wild: number | null
  /** Highest mutated levels among creatures whose split is known. */
  mutated: number | null
  /** Highest wild + mutated levels among all solved creatures. */
  total: number | null
  wildHolders: string[]
  mutatedHolders: string[]
  totalHolders: string[]
}

export type CollectionBests = Partial<Record<AseStatKey, StatBest>>

function track(best: StatBest, field: 'wild' | 'mutated' | 'total', value: number, id: string) {
  const holders = `${field}Holders` as const
  if (best[field] === null || value > best[field]!) {
    best[field] = value
    best[holders] = [id]
  } else if (value === best[field]) {
    best[holders].push(id)
  }
}

/** Best wild / mutated / total levels per stat across solved profiles of one species. */
export function computeBests(profiles: CreatureProfile[], stats: AseStatKey[]): CollectionBests {
  const bests: CollectionBests = {}
  for (const s of stats) {
    bests[s] = { wild: null, mutated: null, total: null, wildHolders: [], mutatedHolders: [], totalHolders: [] }
  }
  for (const p of profiles) {
    if (!p.solved) continue
    for (const s of stats) {
      const lv = p.levels[s]
      if (!lv) continue
      const best = bests[s]!
      track(best, 'total', lv.total, p.id)
      if (lv.mutated !== null) {
        track(best, 'wild', lv.wild, p.id)
        track(best, 'mutated', lv.mutated, p.id)
      }
    }
  }
  return bests
}

export interface TopFlags {
  wild: boolean
  mutated: boolean
  total: boolean
}

/** Which records a creature holds (ties count as holding the record). Zero values are never "top". */
export function topFlags(lv: StatLevels | undefined, best: StatBest | undefined): TopFlags {
  if (!lv || !best) return { wild: false, mutated: false, total: false }
  return {
    wild: lv.mutated !== null && best.wild !== null && best.wild > 0 && lv.wild >= best.wild,
    mutated: lv.mutated !== null && best.mutated !== null && best.mutated > 0 && lv.mutated >= best.mutated,
    total: best.total !== null && best.total > 0 && lv.total >= best.total,
  }
}

// ─── Pair odds ─────────────────────────────────────────────────────────────────

export interface OutcomeLevels {
  wild: number
  /** null when either parent's split is unknown (then `wild` is the combined level). */
  mutated: number | null
  total: number
}

export interface StatOdds {
  stat: AseStatKey
  high: OutcomeLevels
  low: OutcomeLevels
  /** Chance of the high outcome. */
  pHigh: number
  differs: boolean
  /** Chance the baby reaches the collection's best total in this stat. */
  pReachBest: number
}

export interface PairOdds {
  stats: StatOdds[]
  /** Chance every tracked stat rolls its high outcome. */
  pBestOffspring: number
  /** Expected number of tracked stats at the collection best (wild + mutated). */
  expectedTopStats: number
  /** Offspring level range before new mutations (each adds 2). */
  levelRange: { min: number; max: number }
  /** Chance of at least one new mutation. */
  pMutation: number
  motherCanMutate: boolean
  fatherCanMutate: boolean
}

function outcome(m: StatLevels, f: StatLevels, high: boolean): OutcomeLevels {
  const pickN = high ? Math.max : Math.min
  if (m.mutated === null || f.mutated === null) {
    const total = pickN(m.total, f.total)
    return { wild: total, mutated: null, total }
  }
  const wild = pickN(m.wild, f.wild)
  const mutated = pickN(m.mutated, f.mutated)
  return { wild, mutated, total: wild + mutated }
}

/**
 * Chance of ≥1 new mutation. Per roll: a uniformly random eligible stat, then a
 * source parent (the one with more wild levels in that stat with 55%), which
 * must be under the counter limit, then a 2.5% roll. Ties count the father as
 * the higher parent, as ARK Smart Breeding does.
 */
export function mutationProbability(mother: CreatureProfile, father: CreatureProfile, eligible: AseStatKey[]): number {
  const mOk = mother.counters.total < MUTATION_COUNTER_LIMIT
  const fOk = father.counters.total < MUTATION_COUNTER_LIMIT
  if (!mOk && !fOk) return 0
  if (eligible.length === 0) return 0
  let sourceOk = 0
  for (const s of eligible) {
    const mWild = mother.levels[s]?.wild ?? 0
    const fWild = father.levels[s]?.wild ?? 0
    const motherHigher = mWild > fWild
    const pMother = motherHigher ? P_INHERIT_HIGHER : 1 - P_INHERIT_HIGHER
    sourceOk += (mOk ? pMother : 0) + (fOk ? 1 - pMother : 0)
  }
  const perRoll = (sourceOk / eligible.length) * MUTATION_CHANCE
  return 1 - (1 - perRoll) ** MUTATION_ROLLS
}

/** Odds for a mother × father pair over the tracked stats, against the collection bests. */
export function pairOdds(
  mother: CreatureProfile,
  father: CreatureProfile,
  tracked: AseStatKey[],
  bests: CollectionBests,
): PairOdds {
  const stats: StatOdds[] = []
  let pBest = 1
  let expectedTop = 0
  let levelMin = 1
  let levelMax = 1

  for (const s of mother.eligible) {
    const m = mother.levels[s]
    const f = father.levels[s]
    if (!m || !f) continue
    const high = outcome(m, f, true)
    const low = outcome(m, f, false)
    levelMin += low.total
    levelMax += high.total
    if (!tracked.includes(s)) continue

    const differs = high.total !== low.total || high.mutated !== low.mutated
    const pHigh = differs ? P_INHERIT_HIGHER : 1
    const bestTotal = bests[s]?.total ?? null
    const pReachBest =
      bestTotal === null || bestTotal === 0
        ? 0
        : (high.total >= bestTotal ? pHigh : 0) + (differs && low.total >= bestTotal ? 1 - pHigh : 0)
    if (differs) pBest *= pHigh
    expectedTop += pReachBest
    stats.push({ stat: s, high, low, pHigh, differs, pReachBest })
  }

  return {
    stats,
    pBestOffspring: pBest,
    expectedTopStats: expectedTop,
    levelRange: { min: levelMin, max: levelMax },
    pMutation: mutationProbability(mother, father, mother.eligible),
    motherCanMutate: mother.canMutate,
    fatherCanMutate: father.canMutate,
  }
}

export interface RankedPair {
  mother: CreatureProfile
  father: CreatureProfile
  odds: PairOdds
}

/**
 * Rank every female × male pair: most expected record stats first, then the
 * chance of the best possible baby, then the higher possible level.
 * Neutered and unsolved creatures are skipped.
 */
export function rankPairs(
  profiles: CreatureProfile[],
  tracked: AseStatKey[],
  bests: CollectionBests,
  limit = 10,
): RankedPair[] {
  const usable = profiles.filter((p) => p.solved && !p.creature.isNeutered)
  const females = usable.filter((p) => p.creature.isFemale)
  const males = usable.filter((p) => !p.creature.isFemale)
  const ranked: RankedPair[] = []
  for (const mother of females) {
    for (const father of males) {
      ranked.push({ mother, father, odds: pairOdds(mother, father, tracked, bests) })
    }
  }
  ranked.sort(
    (a, b) =>
      b.odds.expectedTopStats - a.odds.expectedTopStats ||
      b.odds.pBestOffspring - a.odds.pBestOffspring ||
      b.odds.levelRange.max - a.odds.levelRange.max,
  )
  return ranked.slice(0, limit)
}
