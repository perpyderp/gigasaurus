/**
 * Stat calculation utilities for ARK creature exports.
 *
 * Since the .ini export only provides final stat values (post-tame, post-level),
 * we use normalized comparisons against configured maximums to estimate stat
 * strength and percentile rankings. This is an approximation — for exact point
 * breakdowns, species-specific base values from the game files would be required.
 */

import type { ArkCreatureStats } from './ark-parser'

/** Maximum realistic values for each stat (used for normalization). */
export const STAT_MAXES: Record<keyof ArkCreatureStats, number> = {
  health: 20000,
  stamina: 5000,
  oxygen: 3000,
  food: 25000,
  water: 1000,
  temperature: 100,
  weight: 5000,
  meleeDamage: 8,      // stored as multiplier (e.g. 3.5 = 350%)
  movementSpeed: 2,    // stored as multiplier (e.g. 1.3 = 130%)
  torpidity: 50000,
  fortitude: 1000,
  craftingSkill: 1,
}

/** Stats shown in UI — subset that's relevant for players. */
export const RELEVANT_STATS = [
  'health', 'stamina', 'oxygen', 'food', 'weight', 'meleeDamage', 'movementSpeed', 'torpidity',
] as const satisfies ReadonlyArray<keyof ArkCreatureStats>

export type RelevantStat = typeof RELEVANT_STATS[number]

/** Stat display configuration. */
export const STAT_CONFIG: Record<RelevantStat, { label: string; color: string; ringColor: string }> = {
  health:        { label: 'Health',     color: 'text-red-500',      ringColor: 'text-red-500' },
  stamina:       { label: 'Stamina',    color: 'text-emerald-500',  ringColor: 'text-emerald-500' },
  oxygen:        { label: 'Oxygen',     color: 'text-cyan-400',     ringColor: 'text-cyan-400' },
  food:          { label: 'Food',       color: 'text-orange-500',   ringColor: 'text-orange-500' },
  weight:        { label: 'Weight',     color: 'text-yellow-500',   ringColor: 'text-yellow-500' },
  meleeDamage:   { label: 'Melee',      color: 'text-rose-500',     ringColor: 'text-rose-500' },
  movementSpeed: { label: 'Move Speed', color: 'text-fuchsia-500',  ringColor: 'text-fuchsia-500' },
  torpidity:     { label: 'Torpidity',  color: 'text-violet-500',   ringColor: 'text-violet-500' },
}

/** Format a raw stat value for display (percentages for melee/speed, integer otherwise). */
export function formatStatValue(stat: RelevantStat, value: number): string {
  if (stat === 'meleeDamage' || stat === 'movementSpeed') {
    return `${Math.round(value * 100)}%`
  }
  return Math.round(value).toLocaleString()
}

/** Returns 0–100 percentage of this stat relative to the configured max. */
export function statPercent(stat: RelevantStat, value: number): number {
  return Math.min(100, Math.round((value / STAT_MAXES[stat]) * 100))
}

/**
 * Estimates the number of wild/domestic levels invested in each stat.
 *
 * Method: distribute the creature's total effective level budget proportionally
 * across stats, weighted by how each stat compares to its configured max.
 * This is a rough approximation since we lack species-specific base values.
 */
export function estimateStatPoints(
  stats: ArkCreatureStats,
  level: number,
): Record<RelevantStat, number> {
  // Wild levels are roughly (level - 1), before taming bonuses.
  // Assume taming bonus adds ~15% to level, so wild portion ≈ level / 1.15
  const wildLevelBudget = Math.max(0, Math.round(level / 1.15) - 1)

  const scores: Record<RelevantStat, number> = {} as Record<RelevantStat, number>
  let totalScore = 0

  for (const stat of RELEVANT_STATS) {
    const pct = Math.min(1, stats[stat] / STAT_MAXES[stat])
    scores[stat] = pct
    totalScore += pct
  }

  const result: Record<RelevantStat, number> = {} as Record<RelevantStat, number>
  for (const stat of RELEVANT_STATS) {
    result[stat] = totalScore > 0
      ? Math.round((scores[stat] / totalScore) * wildLevelBudget)
      : 0
  }
  return result
}

/**
 * Returns a "top X%" label for a stat's percentile.
 *
 * Based on the stat's percentage of the configured max.
 * Higher is rarer — a creature at 90%+ of max health is very rare.
 */
export function getStatTopPercent(stat: RelevantStat, value: number): string {
  const pct = value / STAT_MAXES[stat]
  if (pct >= 0.90) return 'top 1%'
  if (pct >= 0.80) return 'top 5%'
  if (pct >= 0.65) return 'top 15%'
  if (pct >= 0.50) return 'top 35%'
  if (pct >= 0.35) return 'top 55%'
  return 'common'
}

/**
 * Returns the single strongest stat for a creature — useful for card summaries.
 */
export function getBestStat(stats: ArkCreatureStats): { stat: RelevantStat; pct: number } {
  let best: RelevantStat = 'health'
  let bestPct = 0
  for (const stat of RELEVANT_STATS) {
    const pct = stats[stat] / STAT_MAXES[stat]
    if (pct > bestPct) {
      bestPct = pct
      best = stat
    }
  }
  return { stat: best, pct: Math.min(1, bestPct) }
}
