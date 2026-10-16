import type { AseStatKey } from '@/lib/ark-stat-solver/ase-data'

/** Display metadata for all 12 solver stats. Class names are literal so Tailwind generates them. */
export const STAT_META: Record<AseStatKey, { label: string; short: string; dot: string; text: string }> = {
  health:        { label: 'Health',     short: 'HP',   dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400' },
  stamina:       { label: 'Stamina',    short: 'St',   dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  torpidity:     { label: 'Torpidity',  short: 'To',   dot: 'bg-violet-500',  text: 'text-violet-600 dark:text-violet-400' },
  oxygen:        { label: 'Oxygen',     short: 'Ox',   dot: 'bg-cyan-400',    text: 'text-cyan-700 dark:text-cyan-400' },
  food:          { label: 'Food',       short: 'Fo',   dot: 'bg-orange-500',  text: 'text-orange-700 dark:text-orange-400' },
  water:         { label: 'Water',      short: 'Wa',   dot: 'bg-sky-500',     text: 'text-sky-700 dark:text-sky-400' },
  temperature:   { label: 'Temperature', short: 'Te',  dot: 'bg-amber-600',   text: 'text-amber-700 dark:text-amber-400' },
  weight:        { label: 'Weight',     short: 'We',   dot: 'bg-yellow-500',  text: 'text-yellow-700 dark:text-yellow-400' },
  meleeDamage:   { label: 'Melee',      short: 'Me',   dot: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400' },
  movementSpeed: { label: 'Speed',      short: 'Sp',   dot: 'bg-fuchsia-500', text: 'text-fuchsia-600 dark:text-fuchsia-400' },
  fortitude:     { label: 'Fortitude',  short: 'Fr',   dot: 'bg-stone-400',   text: 'text-stone-600 dark:text-stone-300' },
  craftingSkill: { label: 'Crafting',   short: 'Cr',   dot: 'bg-lime-500',    text: 'text-lime-700 dark:text-lime-400' },
}

const MULTIPLIER_STATS = new Set<AseStatKey>(['meleeDamage', 'movementSpeed', 'craftingSkill'])

/** Format a stat value the way ARK's stat screen does: one decimal, multiplier stats as a percentage. */
export function formatInGame(stat: AseStatKey, value: number): string {
  if (MULTIPLIER_STATS.has(stat)) return `${(value * 100).toFixed(1)}%`
  return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export const formatPercent = (p: number, digits = 1) => `${(p * 100).toFixed(digits)}%`
