import type { StoredCreature } from '@/lib/db'

/**
 * Give a creature a new name, keeping the one it replaces in `pastNames` with
 * the time of the change. Unchanged or blank names leave the creature as is.
 */
export function withName(
  creature: StoredCreature,
  name: string,
  changedAt: number = Date.now(),
  /** False when the old name was only an automatic default (nothing worth remembering). */
  record = true,
): StoredCreature {
  const next = name.trim()
  if (!next || next === creature.name) return creature
  const pastNames =
    record && creature.name ? [...(creature.pastNames ?? []), { name: creature.name, changedAt }] : creature.pastNames
  return { ...creature, name: next, pastNames, updatedAt: changedAt }
}
