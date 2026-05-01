/**
 * Convert wiki stat JSON into solver-ready SpeciesStatParams.
 *
 * The wiki's `taming_bonus.additive` field is unfortunately stored inconsistently
 * across our scraped data — some creatures use a fraction of base ("+7%" → 0.07),
 * others store the raw absolute delta ("-450 HP" → -450). We disambiguate by
 * magnitude: |x| ≤ 1 is treated as a fraction × base; otherwise absolute.
 *
 * See docs/stat-solver.md "Unit conventions in our scraped data".
 */

import { INI_TO_WIKI_STAT, MULTIPLIER_STATS } from './constants'
import type { SpeciesStatParams } from './types'

type WikiStatBlock = {
  base: number | null
  level_increase?: { wild?: number | null; tamed?: number | null }
  taming_bonus?: { additive?: number | null; multiplicative?: number | null }
}

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
    return { base: 1.0, iw: iw_abs / wikiBase, id: id_, ta: ta_f, tm: tm_ }
  }
  const ta = Math.abs(ta_f) > 1 ? ta_f : ta_f * wikiBase
  return { base: wikiBase, iw: iw_abs / wikiBase, id: id_, ta, tm: tm_ }
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
