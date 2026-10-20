import { z } from 'zod'

export { MAP_ORDER } from '@/lib/map-order'

/** Lat/lon box [x1, y1, x2, y2] plus rarity 0 (very rare) … 5 (very common). */
const Region = z.tuple([z.number(), z.number(), z.number(), z.number(), z.number().int()])
/** Lat/lon point [x, y] plus rarity. */
const Point = z.tuple([z.number(), z.number(), z.number().int()])
const Node = z.tuple([z.number(), z.number()])
/** Lat/lon box [x1, y1, x2, y2]. */
const Box = z.tuple([z.number(), z.number(), z.number(), z.number()])
const Place = z.object({ name: z.string(), x: z.number(), y: z.number() })
/** A titled list from the wiki article ("Bosses", "Other Spawns (Ascended only)"). */
const NamedGroup = z.object({ group: z.string(), names: z.array(z.string()) })

export const MapCreatureSpawnSchema = z.object({
  /** Name as the game's spawn tables call it ("Alpha Raptor", "Sarco"). */
  name: z.string(),
  /** data/creatures slug, when the creature has a page. */
  creature: z.string().nullable(),
  /** False when every spawn of it on this map is untameable. */
  tameable: z.boolean(),
  regions: z.array(Region),
  points: z.array(Point),
})

export const MapResourceSchema = z.object({
  /** Wiki DataMaps marker group, e.g. `metal-rich`. */
  key: z.string(),
  name: z.string(),
  /** data/resources slug, when it's a tracked resource. */
  resource: z.string().nullable(),
  nodes: z.array(Node),
  cave_nodes: z.array(Node),
})

export const GameMapSchema = z.object({
  name: z.string(),
  content_type: z.string().nullable(),
  release: z.object({ ase: z.string().nullable(), asa: z.string().nullable() }),
  summary: z.string().nullable(),
  /** In-game level name for Ascended (`TheIsland_WP`), used by server configs. */
  level_name: z.string().nullable(),
  /** Unique environmental features, one per bullet. */
  features: z.array(z.string()),
  /** What changed in Ascended compared to Evolved. */
  asa_changes: z.array(z.string()),
  /** Named regions as lat/lon boxes (from the wiki's region map). */
  regions: z.array(z.object({ name: z.string(), areas: z.array(Box) })),
  caves: z.array(Place.extend({ holds: z.array(z.string()) })),
  /** Obelisks and boss terminals. */
  landmarks: z.array(Place),
  artifacts: z.array(Place),
  /** Spawn zones offered on the respawn screen, with their spawn points. */
  player_spawns: z.array(z.object({ name: z.string(), points: z.array(Node) })),
  explorer_notes: z.number().int(),
  dossiers: z.number().int(),
  /** The article's creature lists, grouped as the wiki groups them. */
  roster: z.array(NamedGroup),
  /** Items specific to this map (saddles, consumables, trophies…), grouped likewise. */
  items: z.array(NamedGroup),
  wiki_url: z.string().url(),
  /** Which game the wiki's spawn and resource data was mined from. */
  spawn_data: z.enum(['ASA', 'ASE']),
  resource_data: z.enum(['ASA', 'ASE']).nullable(),
  creatures: z.array(MapCreatureSpawnSchema),
  resources: z.array(MapResourceSchema),
})

export type GameMap = z.infer<typeof GameMapSchema>
export type MapCreatureSpawn = z.infer<typeof MapCreatureSpawnSchema>
export type MapResource = z.infer<typeof MapResourceSchema>

// ─── API response shapes ──────────────────────────────────────────────────────

export const MapDetailSchema = GameMapSchema.extend({
  slug: z.string(),
  image: z.string().nullable(),
})

export type MapDetail = z.infer<typeof MapDetailSchema>

export const MapListItemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  creature_count: z.number().int(),
  resource_count: z.number().int(),
  image: z.string().nullable(),
  url: z.string(),
})

export type MapListItem = z.infer<typeof MapListItemSchema>

export const MapListSchema = z.object({
  count: z.number().int(),
  results: z.array(MapListItemSchema),
})
