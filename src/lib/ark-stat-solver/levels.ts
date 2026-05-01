/**
 * Whole-creature level math: solve every stat and summarise wild/dom totals.
 */

import { IMPRINT_MULTIPLIER } from './constants'
import { solveStat } from './solver'
import type { SpeciesStatParams, StatSolutionMap, LevelSummary } from './types'

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
    const ibForStat = ib * (IMPRINT_MULTIPLIER[iniKey] ?? 1.0)
    result[iniKey] = solveStat(observed, params, ibForStat, isBred)
  }
  return result
}

/**
 * Summarise per-stat solutions into a level breakdown.
 *
 * ARK level identity:
 *   creatureLevel = 1 + Σ(Lw across non-torpidity stats) + Σ(Ld across all stats)
 *
 * Torpidity's wild count mirrors total wild distribution, so we exclude it.
 * `levelDelta != 0` is a strong hint that the solver disagrees with the export —
 * usually due to non-vanilla server multipliers or species params we don't model.
 */
export function summarizeLevels(
  solutions: StatSolutionMap,
  recordedLevel: number,
): LevelSummary {
  let totalWild = 0
  let totalDom = 0
  let allSolved = true
  for (const [iniKey, sol] of Object.entries(solutions)) {
    if (!sol.solved) allSolved = false
    if (iniKey !== 'torpidity') totalWild += sol.wild
    totalDom += sol.dom
  }
  const computedLevel = 1 + totalWild + totalDom
  return { totalWild, totalDom, computedLevel, levelDelta: computedLevel - recordedLevel, allSolved }
}
