import { z } from 'zod'

const ArmorIngredient = z.object({
  name: z.string(),
  quantity: z.number().int(),
  /** Slug of the resource, used to link to /api/resources/:slug */
  resource_id: z.string(),
})

export const ArmorSchema = z.object({
  set_name: z.string(),
  /** null for Tekgram-locked sets */
  unlock_level: z.number().int().nullable(),
  engram_points: z.number().int().nullable(),
  armor_rating: z.number(),
  cold_protection: z.number(),
  heat_protection: z.number(),
  weight: z.number(),
  /** null for unbreakable sets (e.g. Federation Exo) */
  durability: z.number().nullable(),
  found_in: z.array(z.string()),
  /** Total ingredient cost for the complete 5-piece set */
  set_ingredients: z.array(ArmorIngredient),
})

export type Armor = z.infer<typeof ArmorSchema>

// ─── API response shapes ──────────────────────────────────────────────────────

export const ArmorDetailSchema = ArmorSchema.extend({
  slug: z.string(),
  image: z.string().nullable(),
})

export type ArmorDetail = z.infer<typeof ArmorDetailSchema>

export const ArmorListItemSchema = z.object({
  set_name: z.string(),
  slug: z.string(),
  armor_rating: z.number(),
  unlock_level: z.number().int().nullable(),
  image: z.string().nullable(),
  url: z.string(),
})

export type ArmorListItem = z.infer<typeof ArmorListItemSchema>

export const ArmorListSchema = z.object({
  count: z.number().int(),
  results: z.array(ArmorListItemSchema),
})

export type ArmorList = z.infer<typeof ArmorListSchema>
