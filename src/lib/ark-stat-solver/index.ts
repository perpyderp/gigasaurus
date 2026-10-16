/**
 * ARK stat solver — public entry point.
 *
 * For the canonical formula, imprint multipliers, and unit conventions, see
 * docs/stat-solver.md (always start there before changing this code).
 */

export type { SpeciesStatParams, StatSolution, StatSolutionMap, LevelSummary } from './types'
export { INI_TO_WIKI_STAT, IMPRINT_MULTIPLIER, MAX_DOM_LEVELS } from './constants'
export { buildStatParams, buildSpeciesParams } from './params'
export { forwardValue, breedingValueAt, projectMaxPotential } from './formula'
export { solveStat } from './solver'
export { solveAllStats, summarizeLevels } from './levels'
// ASE-accurate path (preferred when the species exists in data/ase-species.json)
export type { AseSpeciesEntry, AseSpeciesFile, AseStatKey } from './ase-data'
export { ASE_STAT_KEYS, normalizeBlueprintPath } from './ase-data'
export { extractLevels, type ExtractionInput, type ExtractionResult } from './extractor'
