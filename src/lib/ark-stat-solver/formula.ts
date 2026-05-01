/**
 * Forward and inverse formula primitives.
 *
 * V = (B × (1 + Lw × Iw) × (1 + IB × 0.2 × IBM) + Ta) × (1 + TE × Tm) × (1 + Ld × Id)
 *
 * Server multipliers and TBHM are folded into Iw / Id / Ta upstream — for now
 * we assume vanilla (all server multipliers = 1.0). See docs/stat-solver.md.
 */

import { INT_TOLERANCE, MAX_DOM_LEVELS } from './constants'
import type { SpeciesStatParams } from './types'

export function isNearInteger(n: number): boolean {
  return Math.abs(n - Math.round(n)) <= INT_TOLERANCE
}

/**
 * Forward: compute V given (Lw, Ld, TE, IB) and species params.
 * Useful for testing and for max-potential projection.
 */
export function forwardValue(
  params: SpeciesStatParams,
  lw: number,
  ld: number,
  ib: number,
  te: number,
): number {
  const { base, iw, id, ta, tm } = params
  const wildScale = base * (1 + lw * iw)
  const imprinted = wildScale * (1 + ib * 0.2)
  const afterTame = (imprinted + ta) * (1 + te * tm)
  return afterTame * (1 + ld * id)
}

/**
 * Inverse: try to solve for Lw at a fixed (Ld, TE, IB).
 * Returns the candidate Lw if it's a non-negative near-integer.
 */
export function inverseLw(
  observed: number,
  params: SpeciesStatParams,
  ld: number,
  ib: number,
  te: number,
): { lw: number; isInteger: boolean } {
  const { base, iw, ta, tm } = params
  const teFactor = 1 + te * tm
  const ibFactor = 1 + ib * 0.2
  const domFactor = 1 + ld * id_safe(params)
  const inner = observed / (teFactor * domFactor)
  const lw = ((inner - ta) / (base * ibFactor) - 1) / iw
  return { lw, isInteger: lw >= -INT_TOLERANCE && isNearInteger(lw) }
}

function id_safe(params: SpeciesStatParams): number {
  return params.id
}

/**
 * Project an observed stat value to its max potential — what it would be if
 * Ld=88 with the same Lw, TE, IB held constant. Returns the input value when
 * we can't reason about the dom-level scale.
 */
export function projectMaxPotential(observed: number, ld: number, params: SpeciesStatParams): number {
  const cur = 1 + ld * params.id
  if (cur === 0) return observed
  const max = 1 + MAX_DOM_LEVELS * params.id
  return observed * (max / cur)
}

/** Breeding value: B × (1 + Lw × Iw). Strips taming, imprint, dom. */
export function breedingValueAt(params: SpeciesStatParams, lw: number): number {
  return params.base * (1 + lw * params.iw)
}
