import { z } from 'zod'

const StatBlock = z.object({
  base: z.number().nullable(),
  level_increase: z
    .object({
      wild: z.number().nullable().optional(),
      tamed: z.number().nullable().optional(),
    })
    .optional(),
  taming_bonus: z
    .object({
      additive: z.number().nullable().optional(),
      multiplicative: z.number().nullable().optional(),
    })
    .optional(),
})

const SaddleEntry = z.object({
  name: z.string().nullable(),
  engram_level: z.number().int().nullable(),
})

export const CreatureSchema = z.object({
  name: z.string(),
  category: z.enum(['dinosaur', 'fantasy', 'bird', 'fish', 'invertebrate', 'mammal', 'reptile', 'other']),
  class: z.string().optional(),
  diet: z.enum([
    "Herbivore",
    "Carnivore",
    "Bottom Feeder",
    "Omnivore",
    "Cnidaria",
    "Carrion-Feeder",
    "Unknown",
    "Piscivore",
    "Sanguinivore",
    "Soft-Bodied Prey",
    "Flame Eater",
    "Insectivore"
  ]).optional(),
  dossier: z
    .object({
      species: z.string(),
      time: z.string(),
      diet: z.string(),
      temperament: z.string(),
      wild: z.string(),
      domesticated: z.string(),
    })
    .nullable(),
  base_stats_growth: z.object({
    health: StatBlock,
    stamina: StatBlock,
    oxygen: StatBlock,
    food: StatBlock,
    weight: StatBlock,
    melee: StatBlock,
    movement: StatBlock,
    torpidity: StatBlock,
  }),
  tameable: z.boolean(),
  rideable: z.boolean(),
  breedable: z.boolean(),
  taming: z
    .object({
      method: z.string().nullable(),
      kibble: z.string().nullable(),
    })
    .nullable(),
  /** Normalized to array at read time; JSON may store a single object or array */
  saddle: z.union([z.array(SaddleEntry), SaddleEntry, z.null()]),
  rider_weaponry: z.boolean(),
  /**
   * Egg-layers (dinosaurs, birds, fish, reptiles) have `name` + `incubation`.
   * Live-bearers (mammals, invertebrates) have `gestation_time` instead.
   * Both share baby/juvenile/adolescent maturation times and breeding_interval.
   */
  egg: z
    .object({
      /** Only present for egg-laying creatures. */
      name: z.union([z.string(), z.array(z.string())]).optional(),
      /** Only present for egg-laying creatures. */
      incubation: z
        .object({
          range: z.string(),
          incubation_range: z.string(),
          incubation_time: z.string(),
        })
        .optional(),
      /** Only present for live-bearing creatures (mammals, invertebrates). */
      gestation_time: z.string().optional(),
      baby_time: z.string(),
      juvenile_time: z.string(),
      adolescent_time: z.string(),
      total_maturation: z.string(),
      breeding_interval: z.string(),
    })
    .nullable(),
  reproduction: z.record(z.unknown()).nullable().optional(),
  drag_weight: z.number().nullable(),
  cloneable: z.boolean().nullable(),
  entity_id: z.string().nullable(),
  /** Direct link to the ARK wiki page this entry was scraped from. */
  wiki_url: z.string().url().nullable().optional(),
})

export type Creature = z.infer<typeof CreatureSchema>

// ─── API response shapes ──────────────────────────────────────────────────────

export const CreatureDetailSchema = CreatureSchema.extend({
  slug: z.string(),
  image: z.string().nullable(),
  /** saddle is always returned as an array (or null) */
  saddle: z.array(SaddleEntry).nullable(),
})

export type CreatureDetail = z.infer<typeof CreatureDetailSchema>

export const CreatureListItemSchema = z.object({
  name: z.string(),
  slug: z.string(),
  category: z.string(),
  image: z.string().nullable(),
  url: z.string(),
})

export type CreatureListItem = z.infer<typeof CreatureListItemSchema>

export const CreatureListSchema = z.object({
  count: z.number().int(),
  results: z.array(CreatureListItemSchema),
})

export type CreatureList = z.infer<typeof CreatureListSchema>
