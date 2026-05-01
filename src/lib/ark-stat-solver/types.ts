/**
 * Shared types for the ARK stat solver. See ../../../docs/stat-solver.md for the
 * canonical formula and variable definitions.
 */

/** Solver params for a single stat, normalised to formula units. */
export interface SpeciesStatParams {
  /** Effective formula base (wiki base for absolute stats; 1.0 for multiplier stats). */
  base: number
  /** Wild-level increase as a fraction of `base`. */
  iw: number
  /** Dom-level increase as a fraction of post-tame value. */
  id: number
  /** Additive taming bonus in absolute formula units (HP for Health, fraction for melee). */
  ta: number
  /** Multiplicative taming bonus (fraction). */
  tm: number
}

/** Per-stat solution returned by the inverse solver. */
export interface StatSolution {
  /** Wild levels (includes mutated levels — see docs/stat-solver.md "Mutation levels"). */
  wild: number
  /** Dom (tamed) levels. */
  dom: number
  /** True if a clean integer solution was found within tolerance. */
  solved: boolean
  /** Taming effectiveness used (1.0 for bred; best-fit for wild-tamed). */
  te: number
  /**
   * Stat value with only wild levels applied — no taming bonus, no imprint, no dom levels.
   * What a baby would inherit genetically. Same units as the observed value.
   */
  breedingValue: number
  /**
   * Projected stat value with all 88 dom levels assigned to THIS stat (Lw, TE, IB held constant).
   */
  maxPotential: number
}

export type StatSolutionMap = Record<string, StatSolution>

/** Aggregate level information across a creature's stats. */
export interface LevelSummary {
  /** Sum of solved wild levels across all stats except torpidity. */
  totalWild: number
  /** Sum of solved dom levels across stats. */
  totalDom: number
  /** Computed creature level: 1 + totalWild + totalDom. */
  computedLevel: number
  /** Difference vs the level recorded in the export. Positive = solver over, negative = under. */
  levelDelta: number
  /** Whether all stats solved cleanly. */
  allSolved: boolean
}
