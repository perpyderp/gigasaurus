import { z } from 'zod'

const WeaponIngredient = z.object({
  name: z.string(),
  quantity: z.number().int(),
  /** Slug of the resource, used to link to /api/resources/:slug */
  resource_id: z.string(),
})

export const WeaponCategoryEnum = z.enum([
  'tool',
  'melee',
  'ranged',
  'firearm',
  'explosive',
  'tek',
  'shield',
  'turret',
  'attachment',
])

export const WeaponSchema = z.object({
  name: z.string(),
  category: WeaponCategoryEnum,
  /** Base damage; null for utility/non-damage weapons */
  damage: z.number().nullable(),
  /** null for starter or Tekgram-locked weapons */
  unlock_level: z.number().int().nullable(),
  engram_points: z.number().int().nullable(),
  /** Ammo type name; null for weapons that don't use ammo */
  ammo_type: z.string().nullable(),
  ingredients: z.array(WeaponIngredient),
})

export type WeaponCategory = z.infer<typeof WeaponCategoryEnum>
export type Weapon = z.infer<typeof WeaponSchema>

// ─── API response shapes ──────────────────────────────────────────────────────

export const WeaponDetailSchema = WeaponSchema.extend({
  slug: z.string(),
  image: z.string().nullable(),
})

export type WeaponDetail = z.infer<typeof WeaponDetailSchema>

export const WeaponListItemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  category: WeaponCategoryEnum,
  damage: z.number().nullable(),
  unlock_level: z.number().int().nullable(),
  image: z.string().nullable(),
  url: z.string(),
})

export type WeaponListItem = z.infer<typeof WeaponListItemSchema>

export const WeaponListSchema = z.object({
  count: z.number().int(),
  results: z.array(WeaponListItemSchema),
})

export type WeaponList = z.infer<typeof WeaponListSchema>
