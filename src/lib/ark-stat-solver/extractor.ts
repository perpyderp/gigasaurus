/**
 * ASE-style level extraction from ARKStatsExtractor species data.
 *
 * Mirrors ARKStatsExtractor's Extraction.cs (vanilla server multipliers):
 *  1. Observed values are float32 ranges, not exact numbers.
 *  2. Total wild levels come from Torpidity (never dom-leveled, +1 point per
 *     creature wild level); dom total = level − 1 − wild total.
 *  3. Per-stat candidates are enumerated within those sums; TE-dependent stats
 *     (Tm > 0) yield a TE *range* per candidate.
 *  4. A combination is valid only if level sums match exactly and a single TE
 *     fits every TE-dependent stat.
 *
 * See .claude/skills/ark-stat-calculation for the full reference.
 *
 * Not modeled (rare; extraction falls back to best-effort): Troodonism
 * alt-base values, per-stat mutation multipliers ≠ 1 (ASA Dreadnoughtus HP),
 * non-vanilla server multipliers, mutagen.
 */

import { MAX_DOM_LEVELS } from './constants'
import type { LevelSummary, StatSolutionMap } from './types'
import {
  ASE_STAT_KEYS,
  DEFAULT_IMPRINT_MULT,
  HEALTH,
  OFFICIAL_STAT_MULTIPLIERS,
  SPEED,
  STATS_COUNT,
  TORPIDITY,
  type AseSpeciesEntry,
  type AseStatKey,
  type StatMultipliers,
} from './ase-data'

export interface ExtractionInput {
  /** Observed values in ASE units (multiplier stats as full multipliers, 1.0 = 100%). */
  statValues: Partial<Record<AseStatKey, number>>
  /** Total creature level from the export. */
  level: number
  /** Exact imprinting bonus 0–1 (DinoImprintingQuality). */
  imprintingBonus: number
  isBred: boolean
}

/** One complete, constraint-satisfying set of (wild, dom) levels. */
export interface ExtractionAlternative {
  levels: Partial<Record<AseStatKey, { wild: number; dom: number }>>
  te: number | null
}

export interface ExtractionResult {
  solutions: StatSolutionMap
  summary: LevelSummary
  /** Taming effectiveness 0–1, or null when no stat depends on TE. 1 for bred. */
  te: number | null
  /** True when level sums and TE constraints were satisfied exactly. */
  valid: boolean
  /**
   * Every valid level assignment found (first = `solutions`), capped. More than one
   * means the stat values alone are ambiguous — e.g. a Rex's Weight is identical for
   * 31 wild + 0 dom and 25 wild + 2 dom. Lineage can pick the right one.
   */
  alternatives: ExtractionAlternative[]
}

// ─── Per-stat effective params ─────────────────────────────────────────────────

interface StatParams {
  base: number
  iw: number
  id: number
  ta: number
  tm: number
  /** Imprint+TBHM factor applied to the base term (1 when not applicable). */
  imf: number
  /** False → additive level-ups (statLevelUpsAdditive). */
  asPercentage: boolean
  cap: number
  /** Stat can receive wild level points (even if hidden, e.g. ASE speed). */
  canWild: boolean
  /** Stat can receive dom levels (displayed and Id > 0). */
  canDom: boolean
}

function bit(mask: number | undefined, s: number): boolean {
  return ((mask ?? 0) & (1 << s)) !== 0
}

/**
 * Resolve species data to effective per-stat params, applying vanilla game
 * rules: TBHM on Health when tamed, imprint multipliers, ASA/flyer speed
 * restrictions (official settings: no speed dom-leveling in ASA, no flyer
 * speed leveling in ASE).
 */
export function buildStatParamsFromAse(
  entry: AseSpeciesEntry,
  ib: number,
  statMultipliers: (StatMultipliers | null)[] = OFFICIAL_STAT_MULTIPLIERS,
): (StatParams | null)[] {
  const imprintMult = entry.imprintMult ?? DEFAULT_IMPRINT_MULT
  const usedStats = entry.stats.map((s) => s !== null)
  const displayed = (s: number) =>
    entry.displayedStats != null ? bit(entry.displayedStats, s) : usedStats[s]

  const params: (StatParams | null)[] = []
  for (let s = 0; s < STATS_COUNT; s++) {
    const raw = entry.stats[s]
    if (!raw) {
      params.push(null)
      continue
    }
    const [taM, tmM, idM, iwM] = statMultipliers[s] ?? [1, 1, 1, 1]
    // Negative bonuses (e.g. Giganotosaurus HP Ta) are used as-is, never scaled.
    const ta = raw[3] > 0 ? raw[3] * taM : raw[3]
    const tm = raw[4] > 0 ? raw[4] * tmM : raw[4]
    const base = raw[0]
    const iw = raw[1] * iwM
    const idRaw = raw[2] * idM

    let id = idRaw
    let imprint = imprintMult[s] ?? 0
    const speedLevelingDisabled = s === SPEED && (entry.game === 'ASA' || entry.flyer === true)
    if (speedLevelingDisabled) {
      id = 0
      imprint = 0
    }

    const tbhm = s === HEALTH ? (entry.tbhm ?? 1) : 1
    const imf = (1 + (ib > 0 ? ib * imprint : 0)) * tbhm

    params.push({
      base,
      iw,
      id,
      ta,
      tm: tm > 0 ? tm : 0,
      imf,
      asPercentage: !bit(entry.levelUpsAdditive, s),
      cap: entry.statCaps?.[String(s)] ?? Number.MAX_VALUE,
      canWild: !bit(entry.skipWildLevels, s),
      canDom: displayed(s) && id > 0,
    })
  }
  return params
}

// ─── Forward formula (tamed; vanilla multipliers) ──────────────────────────────

/** Stat value before TE and dom levels: (B·(1+Lw·Iw))·IMF + Ta (or additive variant). */
function valueWoTeWoDom(p: StatParams, lw: number): number {
  return p.asPercentage
    ? p.base * (1 + lw * p.iw) * p.imf + p.ta
    : (p.base + lw * p.iw) * p.imf + p.ta
}

function applyDom(p: StatParams, v: number, ld: number): number {
  return p.asPercentage ? v * (1 + ld * p.id) : v + ld * p.id
}

/** Full tamed value for (Lw, Ld) at a given TE. */
export function forwardTamedValue(p: StatParams, lw: number, ld: number, te: number): number {
  const v = valueWoTeWoDom(p, lw) * (1 + p.tm * te)
  return Math.min(applyDom(p, v, ld), p.cap)
}

// ─── Float tolerance ───────────────────────────────────────────────────────────

/**
 * Possible aberration of an export-file value (full float32 precision):
 * the float's representable gap × 20 to absorb calculation error, min 0.001.
 * Mirrors ASE's StatValueCalculation.DisplayedAberration.
 */
export function exportValueTolerance(value: number): number {
  const f = Math.fround(Math.abs(value))
  if (f === 0) return 0.001
  const gap = 2 ** (Math.floor(Math.log2(f)) - 23)
  return Math.max(0.001, gap * 20)
}

// ─── Candidate enumeration ─────────────────────────────────────────────────────

interface Candidate {
  lw: number
  ld: number
  teMin: number
  teMax: number
}

const TE_EPSILON = 0.0006 // float-precision guard, same as ASE

function enumerateCandidates(
  p: StatParams,
  observed: number,
  lwMax: number,
  ldMax: number,
  teBounds: { min: number; max: number },
): Candidate[] {
  const tol = exportValueTolerance(observed)
  const obsMin = observed - tol
  const obsMax = observed + tol
  const out: Candidate[] = []

  const lwTop = p.canWild && p.iw > 0 ? lwMax : 0

  for (let lw = 0; lw <= lwTop; lw++) {
    const baseV = valueWoTeWoDom(p, lw)

    if (p.tm > 0) {
      // TE-dependent: each (lw, ld) implies a TE range
      if (baseV <= 0) continue
      for (let ld = 0; ld <= (p.canDom ? ldMax : 0); ld++) {
        const woTe = p.asPercentage
          ? { min: obsMin / (1 + ld * p.id), max: obsMax / (1 + ld * p.id) }
          : { min: obsMin - ld * p.id, max: obsMax - ld * p.id }
        const teLow = (woTe.min / baseV - 1) / p.tm
        const teHigh = (woTe.max / baseV - 1) / p.tm
        if (teHigh < teBounds.min) break // TE shrinks as ld grows — no further ld can work
        if (teLow > teBounds.max) continue
        out.push({
          lw,
          ld,
          teMin: Math.max(teLow, teBounds.min),
          teMax: Math.min(teHigh, teBounds.max),
        })
      }
      // early exit: smallest achievable value already above range
      if (p.canDom === false && (baseV * (1 + p.tm * teBounds.min) > obsMax) && p.iw > 0) break
      continue
    }

    // TE-independent
    if (p.canDom) {
      // `|| 0` normalizes Math.round's -0
      const ld = (p.asPercentage
        ? Math.round((observed / baseV - 1) / p.id)
        : Math.round((observed - baseV) / p.id)) || 0
      if (ld >= 0 && ld <= ldMax) {
        const v = applyDom(p, baseV, ld)
        if (v >= obsMin && v <= obsMax) out.push({ lw, ld, teMin: 0, teMax: 1 })
      }
    } else if (baseV >= obsMin && baseV <= obsMax) {
      out.push({ lw, ld: 0, teMin: 0, teMax: 1 })
    }

    if (p.iw > 0 && baseV > obsMax) break // monotonic in lw — done
  }

  return out
}

// ─── Combination search ────────────────────────────────────────────────────────

interface Pick {
  statIndex: number
  candidate: Candidate
}

/**
 * DFS over per-stat candidate lists looking for an assignment where wild and
 * dom levels sum exactly to the torpor-derived totals and all TE ranges
 * intersect. `sinkCount` is the number of stats that can absorb wild points
 * invisibly (Iw = 0 but not skipped, e.g. ASE Movement Speed) — when present,
 * the wild sum becomes an upper bound instead of an exact target.
 */
const MAX_ALTERNATIVES = 32

function findValidCombinations(
  statCandidates: { statIndex: number; candidates: Candidate[] }[],
  wildSum: number,
  domSum: number,
  hasSink: boolean,
): { picks: Pick[]; teMin: number; teMax: number }[] {
  // most-constrained first keeps the search tiny
  const order = [...statCandidates].sort((a, b) => a.candidates.length - b.candidates.length)
  const picks: Pick[] = []
  const found: { picks: Pick[]; teMin: number; teMax: number }[] = []

  function dfs(i: number, remWild: number, remDom: number, teMin: number, teMax: number) {
    if (remWild < 0 || remDom < 0 || found.length >= MAX_ALTERNATIVES) return
    if (i === order.length) {
      if (remDom === 0 && (hasSink ? remWild >= 0 : remWild === 0)) found.push({ picks: [...picks], teMin, teMax })
      return
    }
    for (const c of order[i].candidates) {
      const tMin = Math.max(teMin, c.teMin)
      const tMax = Math.min(teMax, c.teMax)
      if (tMin > tMax) continue
      picks[i] = { statIndex: order[i].statIndex, candidate: c }
      dfs(i + 1, remWild - c.lw, remDom - c.ld, tMin, tMax)
    }
  }

  dfs(0, wildSum, domSum, -TE_EPSILON, 1 + TE_EPSILON)
  return found
}

// ─── Taming-level plausibility ─────────────────────────────────────────────────

const WILD_LEVEL_STEP = 5
/** Highest official wild spawn level (difficulty 5); X- and R-variants reach 180. */
const MAX_WILD_LEVEL = 150
const MAX_WILD_LEVEL_VARIANTS = 180

/**
 * Score a TE range by the most plausible pre-tame level it implies:
 * 0 = official 5-level step and ≤ 150, 1 = step and ≤ 180 (X/R variants),
 * 2 = any integer level (unofficial servers), 3 = none.
 * `window` is the TE sub-range of the best fit.
 */
function tamingLevelScore(teMin: number, teMax: number, postTameLevel: number): { score: number; window: [number, number] | null } {
  const lo = Math.max(0, teMin)
  const hi = Math.min(1, teMax)
  if (lo > hi) return { score: 3, window: null }
  let best = 3
  let window: [number, number] | null = null
  // pre ranges over levels whose post-tame level could be postTameLevel within [lo, hi]
  const preMin = Math.floor(postTameLevel / (1 + hi / 2)) - 1
  const preMax = Math.ceil(postTameLevel / (1 + lo / 2)) + 1
  for (let pre = Math.max(1, preMin); pre <= preMax; pre++) {
    // TE values in [lo, hi] with floor(pre × (1 + TE/2)) === postTameLevel
    const teLow = Math.max(lo, (postTameLevel / pre - 1) * 2)
    const teHigh = Math.min(hi, ((postTameLevel + 1) / pre - 1) * 2)
    if (teLow < teHigh || (teLow === teHigh && Math.floor(pre * (1 + teLow / 2)) === postTameLevel)) {
      const onStep = pre % WILD_LEVEL_STEP === 0
      const score = onStep && pre <= MAX_WILD_LEVEL ? 0 : onStep && pre <= MAX_WILD_LEVEL_VARIANTS ? 1 : 2
      if (score < best) {
        best = score
        window = [teLow, teHigh]
      }
      if (best === 0) break
    }
  }
  return { score: best, window }
}

/**
 * Order tamed alternatives by plausibility, then by higher TE (most tames are
 * kibble tames), and narrow each TE range to its plausible window.
 */
function rankByTamingLevel<T extends { teMin: number; teMax: number }>(combos: T[], postTameLevel: number): T[] {
  return combos
    .map((c, i) => {
      const { score, window } = tamingLevelScore(c.teMin, c.teMax, postTameLevel)
      return { c: window ? { ...c, teMin: window[0], teMax: window[1] } : c, i, score }
    })
    .sort((a, b) => a.score - b.score || b.c.teMin + b.c.teMax - (a.c.teMin + a.c.teMax) || a.i - b.i)
    .map((x) => x.c)
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function extractLevels(entry: AseSpeciesEntry, input: ExtractionInput): ExtractionResult {
  const ib = input.isBred ? input.imprintingBonus : 0
  const params = buildStatParamsFromAse(entry, ib)
  const teBounds = input.isBred
    ? { min: 1, max: 1 }
    : { min: -TE_EPSILON, max: 1 + TE_EPSILON }

  // 1. Wild level total from Torpidity
  const pTo = params[TORPIDITY]
  const torpor = input.statValues.torpidity ?? 0
  let wildSum = 0
  if (pTo && pTo.iw > 0 && torpor > 0) {
    // torpor is never TE-dependent in practice (Tm = 0); imf covers imprint
    wildSum = Math.round(((torpor - pTo.ta) / (pTo.imf * pTo.base) - 1) / pTo.iw)
  }
  wildSum = Math.max(0, wildSum)
  const domSum = Math.max(0, input.level - 1 - wildSum)

  // 2. Per-stat candidates
  const statCandidates: { statIndex: number; candidates: Candidate[] }[] = []
  const unknownStats: number[] = []
  let hasSink = false

  for (let s = 0; s < STATS_COUNT; s++) {
    if (s === TORPIDITY) continue
    const p = params[s]
    if (!p) continue
    const observed = input.statValues[ASE_STAT_KEYS[s]]
    if (observed === undefined || observed <= 0) {
      unknownStats.push(s)
      if (p.canWild && p.iw > 0) hasSink = true
      continue
    }
    if (p.canWild && p.iw === 0) {
      // hidden wild levels possible (no visible effect) — e.g. ASE Movement Speed
      hasSink = true
    }
    statCandidates.push({
      statIndex: s,
      candidates: enumerateCandidates(p, observed, wildSum, domSum, teBounds),
    })
  }

  // 3. Globally consistent assignments, most plausible first. For tames, a TE is
  // only plausible if some pre-tame level reproduces the post-tame level
  // (postTame = floor(preTame × (1 + TE/2))); official spawns are multiples of 5.
  const found = findValidCombinations(statCandidates, wildSum, domSum, hasSink)
  const combos = input.isBred ? found : rankByTamingLevel(found, 1 + wildSum)
  const combo = combos[0] ?? null
  const valid = combo !== null
  const teOf = (c: { teMin: number; teMax: number }) => (input.isBred ? 1 : Math.min(1, Math.max(0, (c.teMin + c.teMax) / 2)))

  // Best effort when constraints can't be met (non-vanilla server, data gap):
  // take each stat's first candidate so the UI still shows plausible levels.
  const chosen = new Map<number, Candidate>()
  if (combo) {
    for (const pk of combo.picks) chosen.set(pk.statIndex, pk.candidate)
  } else {
    for (const sc of statCandidates) {
      if (sc.candidates.length > 0) chosen.set(sc.statIndex, sc.candidates[0])
    }
  }

  const anyTeStat = statCandidates.some(
    (sc) => (params[sc.statIndex]?.tm ?? 0) > 0 && chosen.has(sc.statIndex),
  )
  const te = input.isBred
    ? 1
    : combo && anyTeStat
      ? Math.min(1, Math.max(0, (combo.teMin + combo.teMax) / 2))
      : anyTeStat ? 1 : null

  // 4. Build solutions
  const solutions: StatSolutionMap = {}
  let totalWild = 0
  let totalDom = 0

  for (let s = 0; s < STATS_COUNT; s++) {
    const p = params[s]
    const key = ASE_STAT_KEYS[s]
    if (!p) continue

    if (s === TORPIDITY) {
      solutions[key] = {
        wild: wildSum,
        dom: 0,
        solved: pTo !== null && torpor > 0,
        te: te ?? 1,
        breedingValue: forwardTamedValue(p, wildSum, 0, 1),
        maxPotential: torpor,
      }
      continue
    }

    const c = chosen.get(s)
    const observed = input.statValues[key]
    if (!c) {
      const isSink = p.canWild && p.iw === 0
      solutions[key] = {
        wild: 0,
        dom: 0,
        solved: unknownStats.includes(s) ? false : isSink,
        te: te ?? 1,
        breedingValue: forwardTamedValue(p, 0, 0, 1),
        maxPotential: observed ?? 0,
      }
      continue
    }

    totalWild += c.lw
    totalDom += c.ld
    const statTe = p.tm > 0 ? (te ?? 1) : 1
    const maxPotential =
      observed !== undefined && p.canDom
        ? p.asPercentage
          ? (observed * (1 + MAX_DOM_LEVELS * p.id)) / (1 + c.ld * p.id)
          : observed + (MAX_DOM_LEVELS - c.ld) * p.id
        : (observed ?? 0)

    solutions[key] = {
      wild: c.lw,
      dom: c.ld,
      solved: true,
      te: statTe,
      breedingValue: forwardTamedValue(p, c.lw, 0, 1),
      maxPotential,
    }
  }

  // Credit leftover wild points to the sink stat (hidden levels, e.g. ASE speed)
  if (hasSink && valid) {
    const sinkIndex = [...Array(STATS_COUNT).keys()].find(
      (s) =>
        s !== TORPIDITY &&
        params[s] !== null &&
        params[s]!.canWild &&
        params[s]!.iw === 0 &&
        (input.statValues[ASE_STAT_KEYS[s]] ?? 0) > 0,
    )
    const leftover = wildSum - totalWild
    if (sinkIndex !== undefined && leftover > 0) {
      const key = ASE_STAT_KEYS[sinkIndex]
      if (solutions[key]) {
        solutions[key].wild += leftover
        totalWild += leftover
      }
    }
  }

  const computedLevel = 1 + totalWild + totalDom
  const summary: LevelSummary = {
    totalWild,
    totalDom,
    computedLevel,
    levelDelta: computedLevel - input.level,
    allSolved: valid,
  }

  const anyTeDependent = statCandidates.some((sc) => (params[sc.statIndex]?.tm ?? 0) > 0)
  const alternatives: ExtractionAlternative[] = combos.map((c) => ({
    levels: Object.fromEntries(
      c.picks.map((pk) => [ASE_STAT_KEYS[pk.statIndex], { wild: pk.candidate.lw, dom: pk.candidate.ld }]),
    ),
    te: anyTeDependent ? teOf(c) : input.isBred ? 1 : null,
  }))

  return { solutions, summary, te, valid, alternatives }
}
