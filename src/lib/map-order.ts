/**
 * Maps in release order; the canonical names used by creature and resource
 * `maps` fields. Kept free of zod so client components can import it.
 */
export const MAP_ORDER = [
  'The Island', 'The Center', 'Scorched Earth', 'Ragnarok', 'Aberration',
  'Extinction', 'Valguero', 'Crystal Isles', 'Genesis: Part 1',
  'Genesis: Part 2', 'Lost Island', 'Fjordur', 'Astraeos', 'Lost Colony',
] as const

/** "Genesis: Part 1" → "genesis_part_1", the slug of its /maps page and data file. */
export const mapSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
