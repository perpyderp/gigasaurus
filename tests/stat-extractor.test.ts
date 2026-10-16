import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseArkExport } from '@/lib/ark-parser'
import {
  buildStatParamsFromAse,
  extractLevels,
  forwardTamedValue,
} from '@/lib/ark-stat-solver/extractor'
import {
  ASE_STAT_KEYS,
  normalizeBlueprintPath,
  type AseSpeciesEntry,
  type AseSpeciesFile,
  type AseStatKey,
} from '@/lib/ark-stat-solver/ase-data'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const aseData: AseSpeciesFile = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'ase-species.json'), 'utf-8'),
)

function species(bp: string): AseSpeciesEntry {
  const entry = aseData.species[normalizeBlueprintPath(bp)]
  if (!entry) throw new Error(`fixture species missing: ${bp}`)
  return entry
}

const REX_BP = '/Game/PrimalEarth/Dinos/Rex/Rex_Character_BP.Rex_Character_BP_C'

/**
 * Build the observed stat values an export would contain for given levels,
 * by running the forward formula and rounding to float32 like the game does.
 */
function makeObserved(
  entry: AseSpeciesEntry,
  levels: Partial<Record<AseStatKey, { w: number; d?: number }>>,
  te: number,
  ib: number,
  wildSum: number,
): Partial<Record<AseStatKey, number>> {
  const params = buildStatParamsFromAse(entry, ib)
  const observed: Partial<Record<AseStatKey, number>> = {}
  for (let s = 0; s < ASE_STAT_KEYS.length; s++) {
    const p = params[s]
    if (!p) continue
    const key = ASE_STAT_KEYS[s]
    const lw = key === 'torpidity' ? wildSum : (levels[key]?.w ?? 0)
    const ld = key === 'torpidity' ? 0 : (levels[key]?.d ?? 0)
    const statTe = p.tm > 0 ? te : 1
    observed[key] = Math.fround(forwardTamedValue(p, lw, ld, statTe))
  }
  return observed
}

// ─── API endpoint ────────────────────────────────────────────────────────────

describe('GET /api/creatures/stat-params', () => {
  it('returns species data for a known blueprint path', async () => {
    const { app } = await import('@/app/api/[[...slugs]]/route')
    const res = await app.handle(
      new Request(`http://localhost/api/creatures/stat-params?bp=${encodeURIComponent(REX_BP)}`),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('Rex')
    expect(json.stats).toHaveLength(12)
  })

  it('404s for an unknown blueprint path', async () => {
    const { app } = await import('@/app/api/[[...slugs]]/route')
    const res = await app.handle(
      new Request('http://localhost/api/creatures/stat-params?bp=%2FGame%2FNope%2FNope_BP.Nope_BP'),
    )
    expect(res.status).toBe(404)
  })
})

// ─── Parser: stat units and position-based parsing ───────────────────────────

describe('parseArkExport stat section', () => {
  const ini = [
    '[Dino Data]',
    'DinoID1=111',
    'DinoID2=222',
    `DinoClass=${REX_BP}`,
    'DinoNameTag=Rex',
    'bIsFemale=True',
    'CharacterLevel=252',
    'DinoImprintingQuality=1.000000',
    '[Max Character Status Values]',
    // localized keys (German) — must be parsed by position, not name
    'Gesundheit=5060.5',
    'Ausdauer=945',
    'Benommenheit=2201.6',
    'Sauerstoff=420',
    'Nahrung=9450',
    'Wasser=100',
    'Temperatur=0',
    'Gewicht=730',
    'Nahkampfschaden=0.858',
    'Bewegungsgeschwindigkeit=0.0',
    'Tapferkeit=0',
    'Fertigkeit=0',
  ].join('\n')

  const parsed = parseArkExport(ini)

  it('parses localized stat keys by position', () => {
    expect(parsed.stats.health).toBe(5060.5)
    expect(parsed.stats.torpidity).toBe(2201.6)
    expect(parsed.stats.weight).toBe(730)
  })

  it('normalizes multiplier stats from value−1 to full multipliers', () => {
    expect(parsed.stats.meleeDamage).toBeCloseTo(1.858, 6)
    expect(parsed.stats.movementSpeed).toBe(1) // unleveled = 100%
    expect(parsed.stats.fortitude).toBe(1)
    expect(parsed.stats.craftingSkill).toBe(1)
  })
})

// ─── Forward formula sanity ──────────────────────────────────────────────────

describe('forward formula (ASE parity)', () => {
  it('matches known Rex values', () => {
    const rex = species(REX_BP)
    const params = buildStatParamsFromAse(rex, 0)
    const hp = params[0]!
    // wild level-35 HP Rex, tamed: 1100×(1+35×0.2)+0.5 = 8800.5
    expect(forwardTamedValue(hp, 35, 0, 1)).toBeCloseTo(8800.5, 3)

    const melee = params[8]!
    // 30 wild melee at TE 80%: (1×(1+30×0.05)+0.5)×(1+0.8×0.4) = 3×1.32 = 3.96
    expect(forwardTamedValue(melee, 30, 0, 0.8)).toBeCloseTo(3.96, 5)
  })

  it('applies imprinting per ASE rules (no stamina/oxygen imprint, food imprints)', () => {
    const rex = species(REX_BP)
    const params = buildStatParamsFromAse(rex, 1) // 100% imprint
    expect(forwardTamedValue(params[1]!, 0, 0, 1)).toBeCloseTo(420, 3) // stamina unchanged
    expect(forwardTamedValue(params[3]!, 0, 0, 1)).toBeCloseTo(150, 3) // oxygen unchanged
    expect(forwardTamedValue(params[4]!, 0, 0, 1)).toBeCloseTo(3000 * 1.2, 3) // food +20%
    expect(forwardTamedValue(params[0]!, 0, 0, 1)).toBeCloseTo(1100 * 1.2 + 0.5, 3) // health +20%
  })
})

// ─── Extraction ──────────────────────────────────────────────────────────────

describe('extractLevels', () => {
  it('recovers levels for a bred, imprinted ASA Rex', () => {
    const rex = species(REX_BP)
    const levels = {
      health: { w: 40, d: 10 },
      stamina: { w: 35 },
      oxygen: { w: 30 },
      food: { w: 33 },
      weight: { w: 38 },
      meleeDamage: { w: 45, d: 20 },
    } satisfies Partial<Record<AseStatKey, { w: number; d?: number }>>
    const wildSum = 40 + 35 + 30 + 33 + 38 + 45
    const domSum = 30
    const ib = 0.47

    const result = extractLevels(rex, {
      statValues: makeObserved(rex, levels, 1, ib, wildSum),
      level: 1 + wildSum + domSum,
      imprintingBonus: ib,
      isBred: true,
    })

    expect(result.valid).toBe(true)
    expect(result.solutions.health).toMatchObject({ wild: 40, dom: 10 })
    expect(result.solutions.stamina).toMatchObject({ wild: 35, dom: 0 })
    expect(result.solutions.oxygen).toMatchObject({ wild: 30, dom: 0 })
    expect(result.solutions.food).toMatchObject({ wild: 33, dom: 0 })
    expect(result.solutions.weight).toMatchObject({ wild: 38, dom: 0 })
    expect(result.solutions.meleeDamage).toMatchObject({ wild: 45, dom: 20 })
    expect(result.solutions.torpidity.wild).toBe(wildSum)
    expect(result.solutions.movementSpeed).toMatchObject({ wild: 0, dom: 0 }) // ASA: no speed levels
    expect(result.summary.computedLevel).toBe(1 + wildSum + domSum)
    expect(result.summary.levelDelta).toBe(0)
  })

  it('recovers levels and TE for a wild-tamed ASA Rex', () => {
    const rex = species(REX_BP)
    const te = 0.9
    const levels = {
      health: { w: 31, d: 5 },
      stamina: { w: 24 },
      oxygen: { w: 27 },
      food: { w: 25 },
      weight: { w: 26 },
      meleeDamage: { w: 32, d: 12 },
    } satisfies Partial<Record<AseStatKey, { w: number; d?: number }>>
    const wildSum = 31 + 24 + 27 + 25 + 26 + 32
    const domSum = 17

    const result = extractLevels(rex, {
      statValues: makeObserved(rex, levels, te, 0, wildSum),
      level: 1 + wildSum + domSum,
      imprintingBonus: 0,
      isBred: false,
    })

    expect(result.valid).toBe(true)
    expect(result.solutions.health).toMatchObject({ wild: 31, dom: 5 })
    expect(result.solutions.meleeDamage).toMatchObject({ wild: 32, dom: 12 })
    expect(result.te).not.toBeNull()
    expect(Math.abs((result.te ?? 0) - te)).toBeLessThan(0.01)
  })

  it('credits hidden wild levels to the sink stat (ASE speed)', () => {
    // Synthetic ASE-game species: speed has Iw=0 but is not skipped, so wild
    // points land there invisibly — the classic ASE "lost levels".
    const entry: AseSpeciesEntry = {
      name: 'Sink Test',
      game: 'ASE',
      stats: [
        [1100, 0.2, 0.27, 0.5, 0],
        [420, 0.1, 0.1, 0, 0],
        [1550, 0.06, 0, 0.5, 0],
        [150, 0.1, 0.1, 0, 0],
        [3000, 0.1, 0.1, 0, 0],
        null,
        null,
        [500, 0.02, 0.04, 0, 0],
        [1, 0.05, 0.1, 0.5, 0.4],
        [1, 0, 0.01, 0, 0],
        null,
        null,
      ],
    }
    const levels = {
      health: { w: 20 },
      stamina: { w: 18 },
      oxygen: { w: 15 },
      food: { w: 17 },
      weight: { w: 19 },
      meleeDamage: { w: 21 },
    } satisfies Partial<Record<AseStatKey, { w: number; d?: number }>>
    const visibleWild = 20 + 18 + 15 + 17 + 19 + 21
    const hiddenSpeed = 14
    const wildSum = visibleWild + hiddenSpeed

    const result = extractLevels(entry, {
      statValues: makeObserved(entry, levels, 1, 0, wildSum),
      level: 1 + wildSum,
      imprintingBonus: 0,
      isBred: false,
    })

    expect(result.valid).toBe(true)
    expect(result.solutions.health.wild).toBe(20)
    expect(result.solutions.movementSpeed.wild).toBe(hiddenSpeed)
    expect(result.summary.levelDelta).toBe(0)
  })

  it('handles TBHM species (Basilisk health halved when tamed)', () => {
    const basilisk = species('/Game/Aberration/Dinos/Basilisk/Basilisk_Character_BP.Basilisk_Character_BP')
    expect(basilisk.tbhm).toBe(0.5)
    const params = buildStatParamsFromAse(basilisk, 0)
    const hp = params[0]!
    // tamed lvl-0 health = base × TBHM + Ta
    expect(forwardTamedValue(hp, 0, 0, 1)).toBeCloseTo(hp.base * 0.5 + hp.ta, 3)
  })
})
