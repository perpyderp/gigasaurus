/**
 * Grain-merge color compositor — port of ARKStatsExtractor's CreatureColored.cs.
 *
 * Mask encoding (arkutils/species-images convention):
 *   region 0 = R only, region 1 = G only, region 2 = B only,
 *   region 3 = G+B,    region 4 = R+G,    region 5 = R+B
 * Per-pixel mask intensity per region is extracted by isolating each channel
 * combination, then a grain-merge blend (`final = base + tint - 128`) is mixed
 * into the base by that intensity.
 *
 * Inputs use sRGB byte triples for both base and tint colors.
 *
 * Reference: https://github.com/cadon/ARKStatsExtractor/blob/master/ARKBreedingStats/SpeciesImages/CreatureColored.cs
 */

export type RGB = readonly [number, number, number]
/** A region's tint, or null to leave that region untouched. */
export type RegionTints = ReadonlyArray<RGB | null>

const clamp255 = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n)

function regionOpacities(mr: number, mg: number, mb: number): [number, number, number, number, number, number] {
  return [
    Math.max(0, mr - mg - mb) / 255,
    Math.max(0, mg - mr - mb) / 255,
    Math.max(0, mb - mr - mg) / 255,
    Math.max(0, Math.min(mg, mb) - mr) / 255,
    Math.max(0, Math.min(mr, mg) - mb) / 255,
    Math.max(0, Math.min(mr, mb) - mg) / 255,
  ]
}

/**
 * Composite a tinted creature image from a base + mask + per-region colors.
 * Returns new ImageData; does not mutate inputs.
 */
export function colorizeCreature(
  base: ImageData,
  mask: ImageData,
  tints: RegionTints,
): ImageData {
  if (base.width !== mask.width || base.height !== mask.height) {
    throw new Error(`base/mask size mismatch: ${base.width}x${base.height} vs ${mask.width}x${mask.height}`)
  }

  const out = new Uint8ClampedArray(base.data)
  const m = mask.data
  const len = base.data.length

  for (let i = 0; i < len; i += 4) {
    const o = regionOpacities(m[i], m[i + 1], m[i + 2])

    let r = base.data[i]
    let g = base.data[i + 1]
    let b = base.data[i + 2]

    for (let region = 0; region < 6; region++) {
      const tint = tints[region]
      if (!tint) continue
      const oi = o[region]
      if (oi <= 0) continue
      const rMix = r + tint[0] - 128
      const gMix = g + tint[1] - 128
      const bMix = b + tint[2] - 128
      r = oi * rMix + (1 - oi) * r
      g = oi * gMix + (1 - oi) * g
      b = oi * bMix + (1 - oi) * b
    }

    out[i] = clamp255(r)
    out[i + 1] = clamp255(g)
    out[i + 2] = clamp255(b)
    // out[i + 3] is already the base alpha (pre-copied)
  }

  return new ImageData(out, base.width, base.height)
}

/** Linear float [0,1] → sRGB byte [0,255]. */
function linearToSRGB255(c: number): number {
  if (c <= 0) return 0
  if (c >= 1) return 255
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.round(s * 255)
}

/** Convert an ARK color from the .ini parser (linear floats + empty flag) into a tint or null. */
export function arkColorToTint(color: { r: number; g: number; b: number; empty: boolean }): RGB | null {
  if (color.empty) return null
  return [linearToSRGB255(color.r), linearToSRGB255(color.g), linearToSRGB255(color.b)]
}
