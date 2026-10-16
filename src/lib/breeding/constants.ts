/**
 * ARK: Survival Ascended breeding constants. Values and confidence notes come
 * from the ark-breeding skill (.claude/skills/ark-breeding); mods can change
 * them, so code takes them from here rather than hardcoding.
 */

/** Chance a stat inherits the parents' higher levels (wild and mutated together). */
export const P_INHERIT_HIGHER = 0.55

/** Success chance of one mutation roll. */
export const MUTATION_CHANCE = 0.025

/** Mutation rolls per offspring. */
export const MUTATION_ROLLS = 3

/** Mutated levels added by one successful mutation (ASA). */
export const LEVELS_PER_MUTATION = 2

/** A parent can be a mutation source only while its total counter is below this. */
export const MUTATION_COUNTER_LIMIT = 20

/** Mutated levels per stat can't exceed this. */
export const MUTATED_LEVEL_CAP = 255

/** Official servers spawn wild creatures at multiples of this level. */
export const WILD_LEVEL_STEP = 5
