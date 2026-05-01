/**
 * Constants shared across solver modules. See docs/stat-solver.md.
 */

export const INT_TOLERANCE = 0.015
/** Vanilla ASA per-creature dom level cap. */
export const MAX_DOM_LEVELS = 88
/** TE scan resolution for tamed creatures with Tm > 0. Smaller = more accurate, slower. */
export const TE_SCAN_STEP = 0.005

/**
 * Stat fields that are stored as multipliers in the .ini (formula base = 1.0).
 * Everything else is absolute (formula base = species wikiBase).
 */
export const MULTIPLIER_STATS: ReadonlySet<string> = new Set(['meleeDamage', 'movementSpeed'])

/**
 * Mapping from .ini stat key (ArkCreatureStats field) to wiki JSON stat key
 * (`base_stats_growth` field on the creature API response).
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

/**
 * Per-stat imprint scale (matches ASE values.json `imprintingMultiplier`).
 * Stats listed as `0.0` do NOT receive the +20% imprint bonus.
 * See docs/stat-solver.md for context.
 */
export const IMPRINT_MULTIPLIER: Record<string, number> = {
  health: 1.0,
  stamina: 1.0,
  oxygen: 0.0,
  food: 0.0,
  weight: 1.0,
  meleeDamage: 1.0,
  movementSpeed: 1.0,
  torpidity: 1.0,
}
