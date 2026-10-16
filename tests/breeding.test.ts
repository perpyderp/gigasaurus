import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { combineArkId } from '@/lib/ark-id'
import type { StoredCreature } from '@/lib/db'
import { buildStatParamsFromAse, forwardTamedValue } from '@/lib/ark-stat-solver/extractor'
import {
  ASE_STAT_KEYS,
  TORPIDITY,
  normalizeBlueprintPath,
  type AseSpeciesEntry,
  type AseSpeciesFile,
  type AseStatKey,
} from '@/lib/ark-stat-solver/ase-data'
import {
  buildProfiles,
  computeBests,
  eligibleStats,
  mutationProbability,
  pairOdds,
  parentIds,
  rankPairs,
  tamingBreakdown,
  topFlags,
} from '@/lib/breeding'

const aseData: AseSpeciesFile = JSON.parse(readFileSync(join(process.cwd(), 'data', 'ase-species.json'), 'utf-8'))
const REX_BP = '/Game/PrimalEarth/Dinos/Rex/Rex_Character_BP.Rex_Character_BP_C'
const rex: AseSpeciesEntry = aseData.species[normalizeBlueprintPath(REX_BP)]

type Levels = Partial<Record<AseStatKey, { w: number; d?: number }>>

/** The TE each fixture tame was actually built with (snapped to a real spawn level). */
const trueTe = new WeakMap<StoredCreature, number>()

/**
 * A TE near `approx` that a real tame can have: some pre-tame level on the official
 * 5-level step must satisfy floor(pre × (1 + TE/2)) = post-tame level.
 */
function realisticTe(postTameLevel: number, approx: number): number {
  const pre = Math.round(postTameLevel / (1 + approx / 2) / 5) * 5
  return Math.min(1, 2 * ((postTameLevel + 0.5) / pre - 1))
}

/** A StoredCreature whose stat values are exactly what the game would export for these levels. */
function makeRex(opts: {
  n: number
  female: boolean
  levels: Levels
  te?: number
  bred?: boolean
  maternal?: number
  paternal?: number
  mother?: number
  father?: number
}): StoredCreature {
  const bred = opts.bred ?? false
  const wildTotal = Object.values(opts.levels).reduce((n, lv) => n + (lv?.w ?? 0), 0)
  const te = bred ? 1 : realisticTe(1 + wildTotal, opts.te ?? 1)
  const params = buildStatParamsFromAse(rex, 0)
  const stats = {} as Record<AseStatKey, number>
  let wildSum = 0
  let domSum = 0
  ASE_STAT_KEYS.forEach((key, s) => {
    const p = params[s]
    if (s === TORPIDITY) return
    const lv = opts.levels[key] ?? { w: 0 }
    wildSum += lv.w
    domSum += lv.d ?? 0
    stats[key] = p ? forwardTamedValue(p, lv.w, lv.d ?? 0, te) : 0
  })
  stats.torpidity = forwardTamedValue(params[TORPIDITY]!, wildSum, 0, te)

  const ancestors =
    opts.mother != null && opts.father != null
      ? [{ maleName: 'Dad', maleDinoId1: opts.father, maleDinoId2: opts.father, femaleName: 'Mum', femaleDinoId1: opts.mother, femaleDinoId2: opts.mother }]
      : []
  const creature = {
    id: combineArkId(opts.n, opts.n),
    dinoId1: opts.n,
    dinoId2: opts.n,
    dinoClass: REX_BP,
    dinoNameTag: 'Rex',
    name: `Rex ${opts.n}`,
    isFemale: opts.female,
    isNeutered: false,
    tribe: '',
    tamer: '',
    imprinter: '',
    babyAge: 1,
    level: 1 + wildSum + domSum,
    imprintQuality: 0,
    mutationsMale: opts.paternal ?? 0,
    mutationsFemale: opts.maternal ?? 0,
    colors: [],
    stats,
    ancestors,
    ancestorsMale: ancestors,
    apiSlug: 'rex',
    rawIni: '',
    importFilename: null,
    manualParentMaleId: null,
    manualParentFemaleId: null,
    importedAt: 0,
    updatedAt: 0,
  } as StoredCreature
  trueTe.set(creature, te)
  return creature
}

const profilesOf = (cs: StoredCreature[]) => buildProfiles(cs, () => rex)

// Tamed parents (no mutations possible on wild tames).
const mother = makeRex({ n: 1, female: true, te: 0.9, levels: { health: { w: 40 }, stamina: { w: 30 }, oxygen: { w: 20 }, food: { w: 25 }, weight: { w: 28 }, meleeDamage: { w: 38 } } })
const father = makeRex({ n: 2, female: false, te: 0.8, levels: { health: { w: 35 }, stamina: { w: 33 }, oxygen: { w: 22 }, food: { w: 21 }, weight: { w: 30 }, meleeDamage: { w: 42 } } })

describe('eligible stats', () => {
  it('Rex can inherit and mutate Health, Stamina, Oxygen, Food, Weight and Melee — not Speed or Torpidity', () => {
    expect(eligibleStats(rex)).toEqual(['health', 'stamina', 'oxygen', 'food', 'weight', 'meleeDamage'])
  })
})

describe('parent links', () => {
  it('uses the last ancestry entry as the direct parents', () => {
    const c = makeRex({ n: 9, female: true, bred: true, levels: {}, mother: 1, father: 2 })
    c.ancestorsMale = [
      { maleName: 'Grandad', maleDinoId1: 7, maleDinoId2: 7, femaleName: 'Grandma', femaleDinoId1: 8, femaleDinoId2: 8 },
      ...c.ancestorsMale,
    ]
    expect(parentIds(c)).toEqual({ motherId: combineArkId(1, 1), fatherId: combineArkId(2, 2) })
  })

  it('prefers manually assigned parents', () => {
    const c = makeRex({ n: 9, female: true, bred: true, levels: {}, mother: 1, father: 2 })
    c.manualParentFemaleId = 'm'
    expect(parentIds(c).motherId).toBe('m')
  })
})

describe('taming breakdown', () => {
  it('splits a post-tame level into pre-tame level and TE bonus levels', () => {
    expect(tamingBreakdown(225, 1)).toEqual({ preTameLevel: 150, bonusLevels: 75, exact: true })
    expect(tamingBreakdown(128, 0.85)).toEqual({ preTameLevel: 90, bonusLevels: 38, exact: true })
  })
})

describe('profiles', () => {
  it('gives tames zero mutated levels and solves TE', () => {
    const p = profilesOf([mother, father]).get(mother.id)!
    expect(p.solved).toBe(true)
    expect(p.mutationSplit).toBe('none')
    expect(p.levels.health).toEqual({ wild: 40, mutated: 0, dom: 0, total: 40 })
    expect(p.te).toBeCloseTo(trueTe.get(mother)!, 2)
    expect(p.taming?.bonusLevels).toBe(p.totals.wild + 1 - p.taming!.preTameLevel)
  })

  it('splits a bred baby into wild + mutated levels using its parents', () => {
    // Health rolls high (40) and gains one mutation (+2), melee rolls low (38), the rest mixed.
    const baby = makeRex({
      n: 3, female: true, bred: true, mother: 1, father: 2, paternal: 1,
      levels: { health: { w: 42 }, stamina: { w: 33 }, oxygen: { w: 20 }, food: { w: 25 }, weight: { w: 30 }, meleeDamage: { w: 38 } },
    })
    const p = profilesOf([mother, father, baby]).get(baby.id)!
    expect(p.mutationSplit).toBe('lineage')
    expect(p.newMutations).toBe(1)
    expect(p.levels.health).toMatchObject({ wild: 40, mutated: 2, total: 42 })
    expect(p.levels.meleeDamage).toMatchObject({ wild: 38, mutated: 0 })
    expect(p.inheritance?.health).toEqual({ roll: 'high', newMutations: 1 })
    expect(p.inheritance?.meleeDamage).toEqual({ roll: 'low', newMutations: 0 })
    expect(p.totals.mutated).toBe(2)
  })

  it('carries a parent\'s mutated levels through a high roll even when the other parent has more wild levels', () => {
    const baby = makeRex({
      n: 3, female: true, bred: true, mother: 1, father: 2, paternal: 1,
      levels: { health: { w: 42 }, stamina: { w: 33 }, oxygen: { w: 22 }, food: { w: 25 }, weight: { w: 30 }, meleeDamage: { w: 42 } },
    })
    // Grandchild: mutated mother (health 40+2) × tame father with more wild health.
    const strongDad = makeRex({ n: 4, female: false, te: 1, levels: { health: { w: 45 }, stamina: { w: 30 }, oxygen: { w: 20 }, food: { w: 20 }, weight: { w: 30 }, meleeDamage: { w: 40 } } })
    const grandchild = makeRex({
      n: 5, female: true, bred: true, mother: 3, father: 4, maternal: 1,
      levels: { health: { w: 47 }, stamina: { w: 33 }, oxygen: { w: 22 }, food: { w: 25 }, weight: { w: 30 }, meleeDamage: { w: 42 } },
    })
    const p = profilesOf([mother, father, baby, strongDad, grandchild]).get(grandchild.id)!
    expect(p.levels.health).toMatchObject({ wild: 45, mutated: 2, total: 47 })
    expect(p.newMutations).toBe(0)
  })

  it('uses a baby to settle a parent whose stat values fit more than one allocation', () => {
    // Rex Weight: 31 wild + 0 tamed gives the same value as 25 wild + 2 tamed.
    const ambiguousMum = makeRex({ n: 11, female: true, te: 0.92, levels: { health: { w: 38, d: 10 }, stamina: { w: 30 }, oxygen: { w: 22 }, food: { w: 27 }, weight: { w: 31 }, meleeDamage: { w: 36, d: 15 } } })
    const dad = makeRex({ n: 12, female: false, te: 0.85, levels: { health: { w: 33 }, stamina: { w: 35 }, oxygen: { w: 20 }, food: { w: 24 }, weight: { w: 35, d: 20 }, meleeDamage: { w: 41 } } })
    const alone = profilesOf([ambiguousMum]).get(ambiguousMum.id)!
    expect(alone.extraction!.alternatives.length).toBeGreaterThan(1)

    const baby = makeRex({
      n: 13, female: true, bred: true, mother: 11, father: 12, paternal: 1,
      levels: { health: { w: 38 }, stamina: { w: 35 }, oxygen: { w: 20 }, food: { w: 27 }, weight: { w: 31 }, meleeDamage: { w: 43 } },
    })
    const profiles = profilesOf([ambiguousMum, dad, baby])
    expect(profiles.get(ambiguousMum.id)!.levels.weight).toMatchObject({ wild: 31, dom: 0 })
    expect(profiles.get(ambiguousMum.id)!.te).toBeCloseTo(trueTe.get(ambiguousMum)!, 2)
    expect(profiles.get(baby.id)!.levels.meleeDamage).toMatchObject({ wild: 41, mutated: 2 })
  })

  it('leaves the split unknown when a mutated line\'s parents are not imported', () => {
    const baby = makeRex({ n: 6, female: false, bred: true, paternal: 3, levels: { health: { w: 44 } } })
    const p = profilesOf([baby]).get(baby.id)!
    expect(p.mutationSplit).toBe('unknown')
    expect(p.levels.health?.mutated).toBeNull()
    expect(p.levels.health?.total).toBe(44)
  })

  it('knows a bred creature with a zero counter has no mutated levels', () => {
    const baby = makeRex({ n: 6, female: false, bred: true, levels: { health: { w: 44 } } })
    expect(profilesOf([baby]).get(baby.id)!.mutationSplit).toBe('none')
  })
})

describe('odds', () => {
  const profiles = profilesOf([mother, father])
  const m = profiles.get(mother.id)!
  const f = profiles.get(father.id)!

  it('gives 7.31% for at least one mutation when both parents are under the limit', () => {
    expect(mutationProbability(m, f, m.eligible)).toBeCloseTo(0.07314, 4)
  })

  it('gives 0 when both parents reached the limit and the 45%/55% source odds otherwise', () => {
    const capped = (p: typeof m) => ({ ...p, counters: { ...p.counters, total: 20 } })
    expect(mutationProbability(capped(m), capped(f), m.eligible)).toBe(0)
    // Only the mother can mutate; she has more wild levels in 2 of 6 stats (Health, Food).
    const expected = 1 - (1 - ((2 * 0.55 + 4 * 0.45) / 6) * 0.025) ** 3
    expect(mutationProbability(m, capped(f), m.eligible)).toBeCloseTo(expected, 6)
  })

  it('computes record holders, best-baby chance and level range for a pair', () => {
    const tracked = ['health', 'meleeDamage'] as AseStatKey[]
    const bests = computeBests([m, f], m.eligible)
    expect(bests.health).toMatchObject({ wild: 40, mutated: 0, total: 40, wildHolders: [m.id] })
    expect(topFlags(m.levels.meleeDamage, bests.meleeDamage).total).toBe(false)

    const odds = pairOdds(m, f, tracked, bests)
    expect(odds.pBestOffspring).toBeCloseTo(0.55 * 0.55, 6)
    expect(odds.expectedTopStats).toBeCloseTo(1.1, 6)
    expect(odds.levelRange).toEqual({ min: 1 + 35 + 30 + 20 + 21 + 28 + 38, max: 1 + 40 + 33 + 22 + 25 + 30 + 42 })

    const [best] = rankPairs([m, f], tracked, bests)
    expect(best.mother.id).toBe(m.id)
  })
})
