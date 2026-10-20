/** Lat/lon boxes are [x1, y1, x2, y2]; spawn regions add a rarity (0–5) as the fifth value. */
type Box = readonly [number, number, number, number, ...number[]]

function overlap(a: Box, b: Box): number {
  const w = Math.min(Math.max(a[0], a[2]), Math.max(b[0], b[2])) - Math.max(Math.min(a[0], a[2]), Math.min(b[0], b[2]))
  const h = Math.min(Math.max(a[1], a[3]), Math.max(b[1], b[3])) - Math.max(Math.min(a[1], a[3]), Math.min(b[1], b[3]))
  return w > 0 && h > 0 ? w * h : 0
}

const inside = (x: number, y: number, b: Box) =>
  x >= Math.min(b[0], b[2]) && x <= Math.max(b[0], b[2]) && y >= Math.min(b[1], b[3]) && y <= Math.max(b[1], b[3])

/**
 * Named regions a creature spawns in, most likely first. Each spawn area adds
 * its overlap with a region, weighted by rarity, so a big common area counts
 * for more than a sliver of a rare one. Regions under 4% of the total are
 * dropped, and map-spanning ones (Deep Ocean, Underwater: over 15% of the map)
 * only count when nothing more specific matches.
 */
export function regionsForSpawns(
  regions: { name: string; areas: Box[] }[],
  spawnAreas: readonly (readonly [number, number, number, number, number])[],
  spawnPoints: readonly (readonly [number, number, number])[],
  limit = 4,
): string[] {
  const score = new Map<string, number>()
  const broad = new Set<string>()
  for (const region of regions) {
    if (region.areas.reduce((sum, a) => sum + Math.abs((a[2] - a[0]) * (a[3] - a[1])), 0) > 1500) broad.add(region.name)
    let s = 0
    for (const area of region.areas) {
      for (const spawn of spawnAreas) s += overlap(area, spawn) * (spawn[4] + 1)
      for (const [x, y, r] of spawnPoints) if (inside(x, y, area)) s += (r + 1) * 0.5
    }
    if (s > 0) score.set(region.name, s)
  }
  const specific = [...score].filter(([name]) => !broad.has(name))
  const ranked = specific.length ? specific : [...score]
  const total = ranked.reduce((a, [, s]) => a + s, 0)
  return ranked
    .filter(([, s]) => s / total >= 0.04)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name)
}
