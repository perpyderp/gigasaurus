import { z } from 'zod'

export const SaddleSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  /** data/creatures slugs that can wear this saddle. */
  creatures: z.array(z.string()),
  tek: z.boolean(),
  /** Platform saddles let you build structures on the creature's back. */
  platform: z.boolean(),
  armor: z.number().nullable(),
  weight: z.number().nullable(),
  /** Player level that unlocks the engram; null for Tekgrams and boss-reward saddles. */
  engram_level: z.number().int().nullable(),
  engram_points: z.number().int().nullable(),
  crafting_xp: z.number().nullable(),
  crafting_time: z.number().nullable(),
  crafted_in: z.array(z.string()),
  ingredients: z.array(z.object({ name: z.string(), quantity: z.number() })),
  blueprint: z.string().nullable(),
  wiki_url: z.string().url(),
  /** File in public/images/saddles, or null when the wiki has no icon. */
  image_file: z.string().nullable(),
})

export type Saddle = z.infer<typeof SaddleSchema>

// ─── API response shapes ──────────────────────────────────────────────────────

export const SaddleDetailSchema = SaddleSchema.extend({
  slug: z.string(),
  image: z.string().nullable(),
})

export type SaddleDetail = z.infer<typeof SaddleDetailSchema>

export const SaddleListItemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  creatures: z.array(z.string()),
  engram_level: z.number().int().nullable(),
  image: z.string().nullable(),
  url: z.string(),
})

export type SaddleListItem = z.infer<typeof SaddleListItemSchema>

export const SaddleListSchema = z.object({
  count: z.number().int(),
  results: z.array(SaddleListItemSchema),
})
