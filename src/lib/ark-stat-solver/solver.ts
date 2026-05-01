/**
 * Per-stat inverse solver.
 *
 * For bred creatures or stats with Tm=0, TE doesn't affect the result so we
 * solve once at TE=1.0. For wild-tamed creatures with Tm > 0 (melee, sometimes
 * speed), we scan TE from 1.0 down to 0.0 looking for a clean integer Lw.
 *
 * See docs/stat-solver.md "Inverting the formula".
 */

import { MAX_DOM_LEVELS, TE_SCAN_STEP } from './constants'
import { breedingValueAt, inverseLw, projectMaxPotential } from './formula'
import type { SpeciesStatParams, StatSolution } from './types'

function tryAt(
  observed: number,
  params: SpeciesStatParams,
  ib: number,
  te: number,
): { wild: number; dom: number } | null {
  for (let ld = 0; ld <= MAX_DOM_LEVELS; ld++) {
    const { lw, isInteger } = inverseLw(observed, params, ld, ib, te)
    if (isInteger) return { wild: Math.round(Math.max(0, lw)), dom: ld }
  }
  return null
}

export function solveStat(
  observed: number,
  params: SpeciesStatParams,
  ib: number,
  isBred: boolean,
): StatSolution {
  const { base, iw, tm } = params

  if (base === 0 || iw === 0) {
    return { wild: 0, dom: 0, solved: false, te: 1.0, breedingValue: base, maxPotential: observed }
  }

  // TE is irrelevant when Tm=0 or the creature is bred (TE locked to 1.0).
  if (isBred || tm === 0) {
    const sol = tryAt(observed, params, ib, 1.0)
    if (sol) {
      return {
        ...sol, solved: true, te: 1.0,
        breedingValue: breedingValueAt(params, sol.wild),
        maxPotential: projectMaxPotential(observed, sol.dom, params),
      }
    }
    return { wild: 0, dom: 0, solved: false, te: 1.0, breedingValue: base, maxPotential: observed }
  }

  const steps = Math.round(1.0 / TE_SCAN_STEP)
  for (let i = steps; i >= 0; i--) {
    const te = i * TE_SCAN_STEP
    const sol = tryAt(observed, params, ib, te)
    if (sol) {
      return {
        ...sol, solved: true, te,
        breedingValue: breedingValueAt(params, sol.wild),
        maxPotential: projectMaxPotential(observed, sol.dom, params),
      }
    }
  }

  return { wild: 0, dom: 0, solved: false, te: 1.0, breedingValue: base, maxPotential: observed }
}
