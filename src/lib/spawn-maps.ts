/**
 * Maps with spawn overlays, mirroring the ARK Wiki's Module:SpawningMap.
 * Overlays and backgrounds are downloaded by scripts/download-spawn-maps.ts:
 *   public/images/spawn-maps/_backgrounds/{key}.jpg — topographic background the overlays are drawn for
 *   public/images/spawn-maps/{slug}/{key}.svg   — a creature's spawn regions
 * Source: ARK Official Community Wiki (ark.wiki.gg), CC BY-NC-SA 4.0. The wiki
 * generates them from ARK: Survival Evolved data, so ASA can differ.
 */

export interface SpawnMapInfo {
  key: string
  /** Display name, e.g. "The Island", "Midgard". */
  name: string
  /** Name used in the wiki's file names ("Spawning Rex <wikiName>.svg"). */
  wikiName: string
  /** Wiki file for the background image. */
  background: string
  /** Maps split into regions on the wiki (Fjordur) group under one name. */
  group?: string
}

export const SPAWN_MAPS: SpawnMapInfo[] = [
  { key: 'the-island', name: 'The Island', wikiName: 'The Island', background: 'The Island Topographic Map.jpg' },
  { key: 'the-center', name: 'The Center', wikiName: 'The Center', background: 'The Center Topographic Map.jpg' },
  { key: 'scorched-earth', name: 'Scorched Earth', wikiName: 'Scorched Earth', background: 'Scorched Earth Topographic Map.jpg' },
  { key: 'ragnarok', name: 'Ragnarok', wikiName: 'Ragnarok', background: 'Ragnarok Ocean Topographic Map.jpg' },
  { key: 'aberration', name: 'Aberration', wikiName: 'Aberration', background: 'Aberration Topographic Map.jpg' },
  { key: 'extinction', name: 'Extinction', wikiName: 'Extinction', background: 'Extinction Topographic Map.jpg' },
  { key: 'valguero', name: 'Valguero', wikiName: 'Valguero', background: 'Valguero Topographic Map.jpg' },
  { key: 'genesis-part-1', name: 'Genesis: Part 1', wikiName: 'Genesis Part 1', background: 'Genesis Part 1 Topographic Map.jpg' },
  { key: 'crystal-isles', name: 'Crystal Isles', wikiName: 'Crystal Isles', background: 'Crystal Isles Topographic Map.jpg' },
  { key: 'genesis-part-2', name: 'Genesis: Part 2', wikiName: 'Genesis Part 2', background: 'Genesis Part 2 Map.jpg' },
  { key: 'lost-island', name: 'Lost Island', wikiName: 'Lost Island', background: 'Lost Island Map.jpg' },
  { key: 'fjordur-midgard', name: 'Midgard', wikiName: 'Fjordur Midgard', background: 'Fjordur Map.jpg', group: 'Fjordur' },
  { key: 'fjordur-asgard', name: 'Asgard', wikiName: 'Fjordur Asgard', background: 'Fjordur Asgard Topographic Map.jpg', group: 'Fjordur' },
  { key: 'fjordur-jotunheim', name: 'Jotunheim', wikiName: 'Fjordur Jotunheim', background: 'Fjordur Jotunheim Topographic Map.jpg', group: 'Fjordur' },
  { key: 'fjordur-vanaheim', name: 'Vanaheim', wikiName: 'Fjordur Vanaheim', background: 'Fjordur Vanaheim Topographic Map.jpg', group: 'Fjordur' },
]

export const SPAWN_MAP_BY_KEY = new Map(SPAWN_MAPS.map((m) => [m.key, m]))

/** Rarity classes used in the overlays, most to least common (colors match the SVGs). */
export const SPAWN_RARITY = [
  { label: 'Very common', color: '#00ff00' },
  { label: 'Common', color: '#b2ff00' },
  { label: 'Uncommon', color: '#ffff00' },
  { label: 'Very uncommon', color: '#ffcc00' },
  { label: 'Rare', color: '#ff6600' },
  { label: 'Very rare', color: '#ff0000' },
] as const

/** The map's page in the Maps section (/maps/<slug>): its name, lowercased, non-alphanumerics → "_". */
export function mapPageSlug(map: SpawnMapInfo): string {
  return (map.group ?? map.wikiName).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export const spawnBackgroundUrl = (key: string) => `/images/spawn-maps/_backgrounds/${key}.jpg`
export const spawnOverlayUrl = (slug: string, key: string) => `/images/spawn-maps/${slug}/${key}.svg`
