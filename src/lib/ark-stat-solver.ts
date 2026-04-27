/**
 * ARK stat solver — resolves wild/domesticated level counts from observed stat values.
 *
 * ARK stat formula (tamed/bred):
 *   V = (B × (1 + Lw × Iw) × (1 + IB × 0.2) + Ta) × (1 + TE × Tm) × (1 + Ld × Id)
 *
 * Where:
 *   B   = base stat value (in formula units)
 *   Lw  = wild level count for this stat
 *   Iw  = wild level increment fraction (per level, as proportion of B)
 *   IB  = imprint quality [0–1]
 *   Ta  = additive taming bonus (absolute, in formula units)
 *   TE  = taming effectiveness [0–1]; always 1.0 for bred creatures
 *   Tm  = multiplicative taming bonus (fraction)
 *   Ld  = domesticated level count for this stat
 *   Id  = domesticated level increment (fraction of current value per level)
 *
 * Unit notes:
 *   - Absolute stats (health, stamina, …): B = wiki base (e.g. 1100 HP for rex),
 *     observed value is in the same units (HP), Ta = taming_bonus.additive × B.
 *   - Multiplier stats (meleeDamage, movementSpeed): the internal ARK stat base is
 *     1.0 (= 100%), so B = 1.0 regardless of the wiki's absolute-damage base value.
 *     Observed value is the INI multiplier (e.g. 1.5 = 150%). Ta = taming_bonus.additive.
 *
 * For tamed creatures where TE is unknown: stats with Tm = 0 (health, stamina, etc.)
 * are unaffected by TE and solve exactly. Stats with Tm > 0 (melee) scan TE from
 * 1.0 → 0.0 in small steps to find the TE that yields an integer solution.
 *
 * Reference: github.com/cadon/ARKStatsExtractor (ArkBreedingStats)
 *            https://ark.fandom.com/wiki/Creature_stats_calculation
 */

/** Parsed stat parameters for a single species stat. */
export interface SpeciesStatParams {
  /** Effective formula base (wiki base for absolute stats, 1.0 for multiplier stats). */
  base: number
  /** Wild level increment as a fraction of base (per level). */
  iw: number
  /** Dom level increment as a fraction of current value (per level). */
  id: number
  /** Additive taming bonus in formula units (absolute HP / or fraction for multiplier stats). */
  ta: number
  /** Multiplicative taming bonus (fraction). */
  tm: number
}

export interface StatSolution {
  wild: number
  dom: number
  /** true if a clean integer solution was found. */
  solved: boolean
  /** The taming effectiveness used (1.0 for bred; best-fit for tamed). */
  te: number
  /**
   * Stat value with only wild levels applied — no taming bonus, no imprint,
   * no dom levels. This is what would transfer to offspring genetically.
   * Same units as the observed value (absolute for HP/etc., multiplier for melee/speed).
   */
  breedingValue: number
}

export type StatSolutionMap = Record<string, StatSolution>

const INT_TOLERANCE = 0.015
const MAX_DOM_LEVELS = 80
/** TE scan step for tamed creatures with Tm > 0. Smaller = more accurate, slower. */
const TE_SCAN_STEP = 0.005

function isNearInteger(n: number): boolean {
  return Math.abs(n - Math.round(n)) <= INT_TOLERANCE
}

/**
 * Convert wiki stat JSON fields to solver params.
 *
 * @param wikiBase   The `base` field from the wiki JSON.
 * @param wikiIw     The `level_increase.wild` field (absolute increment per level).
 * @param id         The `level_increase.tamed` field (fraction per dom level).
 * @param ta_frac    The `taming_bonus.additive` field (fraction of wikiBase).
 * @param tm         The `taming_bonus.multiplicative` field (fraction).
 * @param isMultiplier Whether this is a multiplier stat (melee, speed) — see unit notes above.
 */
export function buildStatParams(
  wikiBase: number | null | undefined,
  wikiIw: number | null | undefined,
  id: number | null | undefined,
  ta_frac: number | null | undefined,
  tm: number | null | undefined,
  isMultiplier: boolean,
): SpeciesStatParams | null {
  if (!wikiBase) return null
  const iw_abs = wikiIw ?? 0
  const id_ = id ?? 0
  const ta_f = ta_frac ?? 0
  const tm_ = tm ?? 0

  if (isMultiplier) {
    // Normalize: effective B = 1.0, Iw = iw_abs / wikiBase, Ta = ta_frac (fraction of 1.0)
    return { base: 1.0, iw: iw_abs / wikiBase, id: id_, ta: ta_f, tm: tm_ }
  } else {
    // Absolute: B = wikiBase, Iw = iw_abs / wikiBase, Ta = ta_frac * wikiBase
    return { base: wikiBase, iw: iw_abs / wikiBase, id: id_, ta: ta_f * wikiBase, tm: tm_ }
  }
}

/**
 * Attempt to solve wild/dom levels for a single stat at a fixed TE.
 * Returns a solution if Lw lands on a non-negative integer, otherwise null.
 */
function trysolveAt(
  observed: number,
  params: SpeciesStatParams,
  ib: number,
  te: number,
): { wild: number; dom: number } | null {
  const { base, iw, id, ta, tm } = params
  const teFactor = 1 + te * tm
  const ibFactor = 1 + ib * 0.2

  for (let ld = 0; ld <= MAX_DOM_LEVELS; ld++) {
    const domFactor = 1 + ld * id
    // Rearranging the formula for Lw:
    //   V = (B * (1 + Lw * iw) * ibFactor + ta) * teFactor * domFactor
    //   Lw = ((V / (teFactor * domFactor) - ta) / (B * ibFactor) - 1) / iw
    const inner = observed / (teFactor * domFactor)
    const lw = ((inner - ta) / (base * ibFactor) - 1) / iw

    if (lw >= -INT_TOLERANCE && isNearInteger(lw)) {
      return { wild: Math.round(Math.max(0, lw)), dom: ld }
    }
  }
  return null
}

/**
 * Solve wild and domesticated levels for a single stat.
 *
 * For bred creatures (isBred=true), TE is fixed at 1.0.
 * For tamed creatures with Tm=0, TE has no effect so we use 1.0.
 * For tamed creatures with Tm>0 (melee, etc.), we scan TE from 1.0 down to 0.0
 * to find the best-fit taming effectiveness that yields an integer solution.
 */
export function solveStat(
  observed: number,
  params: SpeciesStatParams,
  ib: number,
  isBred: boolean,
): StatSolution {
  const { base, iw, tm } = params
  const breedingValueAt = (lw: number) => base * (1 + lw * iw)

  if (base === 0 || iw === 0) return { wild: 0, dom: 0, solved: false, te: 1.0, breedingValue: base }

  // When Tm=0 or creature is bred, TE doesn't affect the result — use 1.0 directly
  if (isBred || tm === 0) {
    const sol = trysolveAt(observed, params, ib, 1.0)
    if (sol) return { ...sol, solved: true, te: 1.0, breedingValue: breedingValueAt(sol.wild) }
    return { wild: 0, dom: 0, solved: false, te: 1.0, breedingValue: base }
  }

  // Tamed creature with Tm > 0: scan TE from 1.0 → 0.0 to find an integer solution
  const steps = Math.round(1.0 / TE_SCAN_STEP)
  for (let tei = steps; tei >= 0; tei--) {
    const te = tei * TE_SCAN_STEP
    const sol = trysolveAt(observed, params, ib, te)
    if (sol) return { ...sol, solved: true, te, breedingValue: breedingValueAt(sol.wild) }
  }

  return { wild: 0, dom: 0, solved: false, te: 1.0, breedingValue: base }
}

/**
 * Stat fields that are stored as multipliers in the INI (B = 1.0 in formula units).
 * All other relevant stats are absolute.
 */
const MULTIPLIER_STATS = new Set(['meleeDamage', 'movementSpeed'])

/**
 * Mapping from INI stat key (ArkCreatureStats field) to wiki JSON stat key
 * (base_stats_growth field in creature API response).
 */
export const INI_TO_WIKI_STAT: Record<string, string> = {
  health:        'health',
  stamina:       'stamina',
  oxygen:        'oxygen',
  food:          'food',
  weight:        'weight',
  meleeDamage:   'melee',
  movementSpeed: 'movement',
  torpidity:     'torpidity',
}

type WikiStatBlock = {
  base: number | null
  level_increase?: { wild?: number | null; tamed?: number | null }
  taming_bonus?: { additive?: number | null; multiplicative?: number | null }
}

/**
 * Build a SpeciesStatParams map from the wiki creature API `base_stats_growth` object.
 */
export function buildSpeciesParams(baseStats: Record<string, WikiStatBlock>): Record<string, SpeciesStatParams> {
  const result: Record<string, SpeciesStatParams> = {}
  for (const [iniKey, wikiKey] of Object.entries(INI_TO_WIKI_STAT)) {
    const block = baseStats[wikiKey]
    if (!block) continue
    const params = buildStatParams(
      block.base,
      block.level_increase?.wild,
      block.level_increase?.tamed,
      block.taming_bonus?.additive,
      block.taming_bonus?.multiplicative,
      MULTIPLIER_STATS.has(iniKey),
    )
    if (params) result[iniKey] = params
  }
  return result
}

/**
 * Solve wild/dom levels for all stats of a creature.
 *
 * @param observedStats  The creature's current stat values (from INI export).
 * @param speciesParams  Per-stat solver params from buildSpeciesParams().
 * @param ib             Imprint quality [0–1].
 * @param isBred         True if the creature was bred (TE=1.0 exactly); false if wild-tamed.
 */
export function solveAllStats(
  observedStats: Record<string, number>,
  speciesParams: Record<string, SpeciesStatParams>,
  ib: number,
  isBred: boolean,
): StatSolutionMap {
  const result: StatSolutionMap = {}
  for (const [iniKey, params] of Object.entries(speciesParams)) {
    const observed = observedStats[iniKey]
    if (observed === undefined) continue
    result[iniKey] = solveStat(observed, params, ib, isBred)
  }
  return result
}
