import { z } from 'zod'

export const ResourceSchema = z.object({
  name: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare']),
  renewable: z.boolean(),
  refinable: z.boolean(),
  combustible: z.boolean(),
  weight: z.number(),
  stack_size: z.number().int(),
  found_in: z.array(z.string()),
  hexagon_exchange: z
    .object({
      exchange_yields: z.number().int(),
      hexagons: z.number().int(),
    })
    .nullable()
    .optional(),
})

export type Resource = z.infer<typeof ResourceSchema>

// ─── API response shapes ──────────────────────────────────────────────────────

export const ResourceDetailSchema = ResourceSchema.extend({
  slug: z.string(),
  image: z.string().nullable(),
})

export type ResourceDetail = z.infer<typeof ResourceDetailSchema>

export const ResourceListItemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  rarity: z.string(),
  image: z.string().nullable(),
  url: z.string(),
})

export type ResourceListItem = z.infer<typeof ResourceListItemSchema>

export const ResourceListSchema = z.object({
  count: z.number().int(),
  results: z.array(ResourceListItemSchema),
})

export type ResourceList = z.infer<typeof ResourceListSchema>
