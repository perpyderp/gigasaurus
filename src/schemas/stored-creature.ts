import { z } from 'zod'

// ─── Primitive sub-schemas (mirror ark-parser.ts interfaces) ──────────────────

export const ArkColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  /** true when ARK marks the slot as empty (alpha = 1.0) */
  empty: z.boolean(),
})

export const AncestorEntrySchema = z.object({
  maleName: z.string(),
  maleDinoId1: z.number(),
  maleDinoId2: z.number(),
  femaleName: z.string(),
  femaleDinoId1: z.number(),
  femaleDinoId2: z.number(),
})

export const ArkCreatureStatsSchema = z.object({
  health: z.number(),
  stamina: z.number(),
  torpidity: z.number(),
  oxygen: z.number(),
  food: z.number(),
  water: z.number(),
  temperature: z.number(),
  weight: z.number(),
  meleeDamage: z.number(),
  movementSpeed: z.number(),
  fortitude: z.number(),
  craftingSkill: z.number(),
})

// ─── StoredCreature — shape persisted in IndexedDB ───────────────────────────

export const StoredCreatureSchema = z.object({
  /** ARK 64-bit combined ID: (DinoID1 × 2^32 + DinoID2) as decimal string */
  id: z.string(),
  dinoId1: z.number(),
  dinoId2: z.number(),
  dinoClass: z.string(),
  dinoNameTag: z.string(),
  /** Display name: TamedName if set, otherwise derived from dinoNameTag */
  name: z.string(),
  isFemale: z.boolean(),
  isNeutered: z.boolean(),
  tribe: z.string(),
  tamer: z.string(),
  imprinter: z.string(),
  babyAge: z.number(),
  level: z.number(),
  imprintQuality: z.number(),
  mutationsMale: z.number(),
  mutationsFemale: z.number(),
  colors: z.array(ArkColorSchema),
  stats: ArkCreatureStatsSchema,
  ancestors: z.array(AncestorEntrySchema),
  ancestorsMale: z.array(AncestorEntrySchema),
  /** Matched Gigasaurus API slug, or null if creature isn't in the API */
  apiSlug: z.string().nullable(),
  /** Raw .ini text, kept for re-parsing after API updates */
  rawIni: z.string(),
  /** Filename of the .ini file this creature was imported from (browser File.name) */
  importFilename: z.string().nullable(),
  /** ID of a saved import path the creature came from (see lib/import-paths). Null when imported via drag-and-drop. */
  importPathId: z.string().nullable().optional(),
  /** ARK ID of manually-assigned father (combined 64-bit decimal string) */
  manualParentMaleId: z.string().nullable(),
  /** ARK ID of manually-assigned mother (combined 64-bit decimal string) */
  manualParentFemaleId: z.string().nullable(),
  importedAt: z.number(),
  updatedAt: z.number(),
})

export type ArkColor = z.infer<typeof ArkColorSchema>
export type AncestorEntry = z.infer<typeof AncestorEntrySchema>
export type ArkCreatureStats = z.infer<typeof ArkCreatureStatsSchema>
export type StoredCreature = z.infer<typeof StoredCreatureSchema>
