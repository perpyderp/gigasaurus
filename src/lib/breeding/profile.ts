/**
 * Creature level profiles: per-stat wild / mutated / tamed (player) points,
 * taming effectiveness and bonus levels, mutation counters and parent links.
 *
 * Levels come from the ASE-style extractor. On ASA a mutated level has the same
 * effect as a wild level for almost every species, so the extractor's "wild"
 * count is wild + mutated. The split is recovered here:
 *  - not bred (tamed from the wild): no mutated levels;
 *  - bred with a mutation counter of 0: nothing in the ancestry ever mutated;
 *  - bred with both parents imported: the inheritance rules (high/low pair per
 *    stat, +2 mutated levels per new mutation, new-mutation count from the
 *    counters) usually pin the split down exactly;
 *  - otherwise the split stays unknown and `mutated` is null.
 */

import { combineArkId } from '@/lib/ark-id'
import type { StoredCreature } from '@/lib/db'
import { extractLevels, type ExtractionResult } from '@/lib/ark-stat-solver/extractor'
import {
  ASE_STAT_KEYS,
  STATS_COUNT,
  TORPIDITY,
  type AseSpeciesEntry,
  type AseStatKey,
} from '@/lib/ark-stat-solver/ase-data'
import { LEVELS_PER_MUTATION, MUTATION_COUNTER_LIMIT, MUTATION_ROLLS, WILD_LEVEL_STEP } from './constants'

export interface StatLevels {
  /** Inheritable wild levels. When `mutated` is null this is wild + mutated combined. */
  wild: number
  /** Mutated levels, or null when the split can't be determined. */
  mutated: number | null
  /** Player-assigned (tamed) levels. Not inherited. */
  dom: number
  /** wild + mutated — what breeding passes on for this stat. */
  total: number
}

export interface StatInheritance {
  /** Which roll the stat came from: the parents' higher pair (55%) or lower pair (45%). */
  roll: 'high' | 'low' | 'same'
  /** New mutations that landed in this stat on this creature. */
  newMutations: number
}

export type MutationSplit =
  /** Not bred, or counter 0 — certainly no mutated levels. */
  | 'none'
  /** Derived from the imported parents. */
  | 'lineage'
  /** Bred with mutations in the ancestry, parents not imported (or inconsistent). */
  | 'unknown'

export interface CreatureProfile {
  id: string
  creature: StoredCreature
  species: AseSpeciesEntry | null
  isBred: boolean
  /** Extraction satisfied every constraint (level sums, one TE). */
  solved: boolean
  extraction: ExtractionResult | null
  /** Per-stat levels for stats the species uses (torpidity excluded). */
  levels: Partial<Record<AseStatKey, StatLevels>>
  /** Stats that can be inherited and mutated (wild-levelable, not torpidity). */
  eligible: AseStatKey[]
  totals: { wild: number; mutated: number | null; dom: number }
  /** Taming effectiveness 0–1 for tames; null for bred creatures or when unknown. */
  te: number | null
  /** Tames only: level before taming and the bonus levels TE added. */
  taming: { preTameLevel: number; bonusLevels: number; exact: boolean } | null
  counters: { maternal: number; paternal: number; total: number }
  /** Counter below the limit — this creature can still produce new mutations. */
  canMutate: boolean
  motherId: string | null
  fatherId: string | null
  mutationSplit: MutationSplit
  /** New mutations on this creature (vs its parents' counters); null when parents unknown. */
  newMutations: number | null
  /** Per-stat inheritance, when derived from imported parents. */
  inheritance: Partial<Record<AseStatKey, StatInheritance>> | null
}

const bit = (mask: number | undefined, s: number) => ((mask ?? 0) & (1 << s)) !== 0

/** Stats a species can inherit and mutate: uses the stat, gets wild levels, not torpidity. */
export function eligibleStats(entry: AseSpeciesEntry | null): AseStatKey[] {
  if (!entry) return []
  const out: AseStatKey[] = []
  for (let s = 0; s < STATS_COUNT; s++) {
    if (s === TORPIDITY) continue
    const raw = entry.stats[s]
    if (!raw || raw[1] <= 0 || bit(entry.skipWildLevels, s)) continue
    out.push(ASE_STAT_KEYS[s])
  }
  return out
}

/**
 * Bred per ARKStatsExtractor's rule (imprinter, imprint, baby age < 1 or ancestry
 * present), plus a nonzero mutation counter — only bred creatures have one.
 */
export function isBredCreature(c: StoredCreature): boolean {
  return (
    c.mutationsFemale + c.mutationsMale > 0 ||
    c.imprinter.trim() !== '' ||
    c.imprintQuality > 0 ||
    c.babyAge < 1 ||
    c.ancestors.length > 0 ||
    c.ancestorsMale.length > 0
  )
}

/**
 * Parent ARK IDs. Manual assignments win; otherwise the last ancestry entry —
 * ARK appends each generation, so the last pair is the direct parents.
 */
export function parentIds(c: StoredCreature): { motherId: string | null; fatherId: string | null } {
  const last = c.ancestorsMale.at(-1) ?? c.ancestors.at(-1)
  const fromExport = last
    ? {
        motherId: last.femaleDinoId1 || last.femaleDinoId2 ? combineArkId(last.femaleDinoId1, last.femaleDinoId2) : null,
        fatherId: last.maleDinoId1 || last.maleDinoId2 ? combineArkId(last.maleDinoId1, last.maleDinoId2) : null,
      }
    : { motherId: null, fatherId: null }
  return {
    motherId: c.manualParentFemaleId || fromExport.motherId,
    fatherId: c.manualParentMaleId || fromExport.fatherId,
  }
}

/** Pre-tame level and TE bonus levels: postTame = floor(pre × (1 + TE/2)). */
export function tamingBreakdown(postTameLevel: number, te: number): { preTameLevel: number; bonusLevels: number; exact: boolean } {
  const factor = 1 + te / 2
  const guess = Math.round(postTameLevel / factor)
  let best: { pre: number; score: number } | null = null
  for (let pre = Math.max(1, guess - 3); pre <= guess + 3; pre++) {
    const matches = Math.floor(pre * factor) === postTameLevel
    // Prefer exact matches, then official level steps, then the closest guess.
    const score = (matches ? 0 : 10) + (pre % WILD_LEVEL_STEP === 0 ? 0 : 1) + Math.abs(pre - guess) * 0.1
    if (!best || score < best.score) best = { pre, score }
  }
  const pre = best!.pre
  return { preTameLevel: pre, bonusLevels: postTameLevel - pre, exact: Math.floor(pre * factor) === postTameLevel }
}

function baseProfile(c: StoredCreature, species: AseSpeciesEntry | null): CreatureProfile {
  const isBred = isBredCreature(c)
  const extraction = species
    ? extractLevels(species, {
        statValues: c.stats as Partial<Record<AseStatKey, number>>,
        level: c.level,
        imprintingBonus: c.imprintQuality,
        isBred,
      })
    : null

  const eligible = eligibleStats(species)
  const levels: Partial<Record<AseStatKey, StatLevels>> = {}
  let wildTotal = 0
  let domTotal = 0
  if (extraction && species) {
    for (let s = 0; s < STATS_COUNT; s++) {
      if (s === TORPIDITY || !species.stats[s]) continue
      const key = ASE_STAT_KEYS[s]
      const sol = extraction.solutions[key]
      if (!sol) continue
      // Stats that can't get wild levels (e.g. speed on ASA) can't mutate either.
      levels[key] = { wild: sol.wild, mutated: eligible.includes(key) ? null : 0, dom: sol.dom, total: sol.wild }
      wildTotal += sol.wild
      domTotal += sol.dom
    }
  }

  const counters = {
    maternal: c.mutationsFemale,
    paternal: c.mutationsMale,
    total: c.mutationsFemale + c.mutationsMale,
  }
  const te = !isBred && extraction?.te != null ? extraction.te : null
  const { motherId, fatherId } = parentIds(c)

  return {
    id: c.id,
    creature: c,
    species,
    isBred,
    solved: extraction?.valid ?? false,
    extraction,
    levels,
    eligible,
    totals: { wild: wildTotal, mutated: null, dom: domTotal },
    te,
    taming: te != null && extraction ? tamingBreakdown(1 + wildTotal, te) : null,
    counters,
    canMutate: counters.total < MUTATION_COUNTER_LIMIT,
    motherId,
    fatherId,
    mutationSplit: 'unknown',
    newMutations: null,
    inheritance: null,
  }
}

function setNoMutations(p: CreatureProfile) {
  for (const lv of Object.values(p.levels)) lv!.mutated = 0
  p.totals.mutated = 0
  p.mutationSplit = 'none'
}

interface StatOption {
  wild: number
  mutated: number
  roll: 'high' | 'low' | 'same'
  newMutations: number
}

/** One candidate (wild, dom) allocation per stat, from the extractor's alternatives. */
type Allocation = { levels: Partial<Record<AseStatKey, { wild: number; dom: number }>>; te: number | null }

/** Allocations worth trying: all extractor alternatives, unless lineage already fixed this creature. */
function allocationsOf(p: CreatureProfile): Allocation[] {
  const current: Allocation = {
    levels: Object.fromEntries(Object.entries(p.levels).map(([k, lv]) => [k, { wild: lv!.total, dom: lv!.dom }])),
    te: p.te,
  }
  if (p.mutationSplit === 'lineage' || !p.extraction?.alternatives.length) return [current]
  return p.extraction.alternatives
}

/** Apply an allocation to a profile whose wild/mutated split is not yet derived. */
function applyAllocation(p: CreatureProfile, alloc: Allocation) {
  let wild = 0
  let dom = 0
  for (const [key, lv] of Object.entries(p.levels)) {
    const a = alloc.levels[key as AseStatKey]
    if (a) {
      lv!.total = a.wild
      lv!.wild = a.wild
      lv!.dom = a.dom
    }
    wild += lv!.wild
    dom += lv!.dom
  }
  p.totals.wild = wild
  p.totals.dom = dom
  if (!p.isBred && alloc.te != null) {
    p.te = alloc.te
    p.taming = tamingBreakdown(1 + wild, alloc.te)
  }
}

type ParentLevels = Partial<Record<AseStatKey, { wild: number; mutated: number }>>

function parentLevels(p: CreatureProfile, alloc: Allocation): ParentLevels | null {
  const out: ParentLevels = {}
  for (const key of p.eligible) {
    const lv = p.levels[key]
    if (!lv || lv.mutated === null) return null
    // An untouched (no-mutation) parent can take any alternative; a lineage-fixed one keeps its split.
    out[key] = p.mutationSplit === 'none' ? { wild: alloc.levels[key]?.wild ?? lv.wild, mutated: 0 } : { wild: lv.wild, mutated: lv.mutated }
  }
  return out
}

/**
 * Try to explain a child's per-stat totals from one parent allocation pair:
 * each stat takes the parents' max (wild, mutated) pair or min pair, then gains
 * 2 mutated levels per new mutation, and the new mutations add up to `newMut`.
 * Returns every consistent combination (capped).
 */
function explain(
  eligible: AseStatKey[],
  childTotals: Partial<Record<AseStatKey, number>>,
  m: ParentLevels,
  f: ParentLevels,
  newMut: number,
): { key: AseStatKey; options: StatOption[] }[] | null {
  const perStat: { key: AseStatKey; options: StatOption[] }[] = []
  for (const key of eligible) {
    const total = childTotals[key]
    const ml = m[key]
    const fl = f[key]
    if (total === undefined || !ml || !fl) return null
    const pairs = [
      { roll: 'high' as const, wild: Math.max(ml.wild, fl.wild), mutated: Math.max(ml.mutated, fl.mutated) },
      { roll: 'low' as const, wild: Math.min(ml.wild, fl.wild), mutated: Math.min(ml.mutated, fl.mutated) },
    ]
    const same = pairs[0].wild === pairs[1].wild && pairs[0].mutated === pairs[1].mutated
    const options: StatOption[] = []
    for (const pair of same ? [{ ...pairs[0], roll: 'same' as const }] : pairs) {
      const extra = total - pair.wild - pair.mutated
      if (extra < 0 || extra % LEVELS_PER_MUTATION !== 0 || extra / LEVELS_PER_MUTATION > newMut) continue
      options.push({ wild: pair.wild, mutated: total - pair.wild, roll: pair.roll, newMutations: extra / LEVELS_PER_MUTATION })
    }
    if (options.length === 0) return null
    perStat.push({ key, options })
  }
  return perStat
}

function solutionsFor(perStat: { key: AseStatKey; options: StatOption[] }[], newMut: number): StatOption[][] {
  const solutions: StatOption[][] = []
  const pick: StatOption[] = []
  const walk = (i: number, remaining: number) => {
    if (remaining < 0 || solutions.length > 64) return
    if (i === perStat.length) {
      if (remaining === 0) solutions.push([...pick])
      return
    }
    for (const o of perStat[i].options) {
      pick[i] = o
      walk(i + 1, remaining - o.newMutations)
    }
  }
  walk(0, newMut)
  return solutions
}

/**
 * Split each eligible stat of a bred child into wild + mutated using both
 * parents. When stat values alone are ambiguous (several valid allocations for
 * the child or a parent), the first combination consistent with inheritance
 * wins — and an ambiguous parent adopts the allocation its child confirms.
 */
function splitFromParents(child: CreatureProfile, mother: CreatureProfile, father: CreatureProfile): boolean {
  const newMut =
    child.counters.maternal - mother.counters.total + (child.counters.paternal - father.counters.total)
  if (newMut < 0 || newMut > MUTATION_ROLLS) return false

  for (const ca of allocationsOf(child)) {
    const childTotals = Object.fromEntries(child.eligible.map((k) => [k, ca.levels[k]?.wild ?? child.levels[k]?.total]))
    for (const ma of allocationsOf(mother)) {
      const m = parentLevels(mother, ma)
      if (!m) return false
      for (const fa of allocationsOf(father)) {
        const f = parentLevels(father, fa)
        if (!f) return false
        const perStat = explain(child.eligible, childTotals, m, f, newMut)
        if (!perStat) continue
        const solutions = solutionsFor(perStat, newMut)
        if (solutions.length === 0) continue

        applyAllocation(child, ca)
        if (mother.mutationSplit === 'none') applyAllocation(mother, ma)
        if (father.mutationSplit === 'none') applyAllocation(father, fa)

        const inheritance: Partial<Record<AseStatKey, StatInheritance>> = {}
        let mutatedTotal: number | null = 0
        perStat.forEach(({ key }, i) => {
          const first = solutions[0][i]
          const agreed = solutions.every((sol) => sol[i].wild === first.wild && sol[i].mutated === first.mutated)
          const lv = child.levels[key]!
          if (agreed) {
            lv.wild = first.wild
            lv.mutated = first.mutated
            if (mutatedTotal !== null) mutatedTotal += first.mutated
            const rollAgreed = solutions.every((sol) => sol[i].roll === first.roll)
            inheritance[key] = { roll: rollAgreed ? first.roll : 'same', newMutations: first.newMutations }
          } else {
            mutatedTotal = null // ambiguous for this stat — keep combined
          }
        })
        child.totals.mutated = mutatedTotal
        child.totals.wild = Object.values(child.levels).reduce((sum, lv) => sum + lv!.wild, 0)
        child.mutationSplit = 'lineage'
        child.newMutations = newMut
        child.inheritance = inheritance
        return true
      }
    }
  }
  return false
}

/**
 * Build profiles for a whole collection so lineage can be followed.
 * `speciesFor` returns the solver species entry for a creature's blueprint.
 */
export function buildProfiles(
  creatures: StoredCreature[],
  speciesFor: (c: StoredCreature) => AseSpeciesEntry | null,
): Map<string, CreatureProfile> {
  const profiles = new Map<string, CreatureProfile>()
  for (const c of creatures) profiles.set(c.id, baseProfile(c, speciesFor(c)))

  const resolved = new Set<string>()
  const resolving = new Set<string>()

  const resolve = (p: CreatureProfile) => {
    if (resolved.has(p.id) || resolving.has(p.id)) return
    resolving.add(p.id)

    const mother = p.motherId ? profiles.get(p.motherId) : undefined
    const father = p.fatherId ? profiles.get(p.fatherId) : undefined
    if (mother) resolve(mother)
    if (father) resolve(father)
    if (mother && father) {
      const newMut = p.counters.maternal - mother.counters.total + (p.counters.paternal - father.counters.total)
      p.newMutations = newMut >= 0 ? newMut : null
    }

    if (!p.isBred) {
      setNoMutations(p)
    } else {
      const split = p.solved && mother?.solved && father?.solved ? splitFromParents(p, mother, father) : false
      // Counter 0: nothing in the ancestry ever mutated, even without parents imported.
      if (!split && p.counters.total === 0) setNoMutations(p)
    }

    resolving.delete(p.id)
    resolved.add(p.id)
  }

  for (const p of profiles.values()) resolve(p)
  return profiles
}
