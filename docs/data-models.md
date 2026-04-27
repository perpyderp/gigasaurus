# Data Models

All game data lives in `data/<kind>/<slug>.json`. Each domain is governed by a Zod schema in [`src/schemas/`](../src/schemas) — the schema is the source of truth for both the REST API and the UI. Adding fields means updating the schema first, then the JSON, then any consuming pages.

## File layout

```
data/
├── creatures/<slug>.json     # 171 entries
├── armor/<slug>.json         # 9 entries
├── weapons/<slug>.json       # 13 entries
└── resources/<slug>.json     # 16 entries

public/images/
├── creatures/<slug>.png
├── armor/<slug>.png
├── weapons/<slug>.png
└── resources/<slug>.png
```

The slug (filename without extension) is the canonical identifier. The list-test suite enforces that every creature JSON has a matching PNG in `public/images/creatures/`.

## Creatures

Schema: [`src/schemas/creature.ts`](../src/schemas/creature.ts) · Service: [`src/services/creature.ts`](../src/services/creature.ts)

```ts
{
  name: string,
  category: 'dinosaur' | 'fantasy' | 'bird' | 'fish' | 'invertebrate' | 'mammal' | 'reptile' | 'other',
  class?: string,
  diet?: 'Herbivore' | 'Carnivore' | ... ,
  dossier: { species, time, diet, temperament, wild, domesticated } | null,
  base_stats_growth: {
    health | stamina | oxygen | food | weight | melee | movement | torpidity: {
      base: number | null,
      level_increase?: { wild?: number, tamed?: number },
      taming_bonus?: { additive?: number, multiplicative?: number },
    }
  },
  tameable, rideable, breedable: boolean,
  taming: { method: string | null, kibble: string | null } | null,
  saddle: SaddleEntry | SaddleEntry[] | null,    // normalized to array on read
  rider_weaponry: boolean,
  egg: {
    name?: string | string[],                    // egg-layers only
    incubation?: { range, incubation_range, incubation_time },
    gestation_time?: string,                     // live-bearers only
    baby_time, juvenile_time, adolescent_time, total_maturation, breeding_interval: string,
  } | null,
  reproduction?: Record<string, unknown> | null,
  drag_weight: number | null,
  cloneable: boolean | null,
  entity_id: string | null,
}
```

**Stat formula notes** (live in [`src/lib/ark-stat-solver.ts`](../src/lib/ark-stat-solver.ts)):

- `taming_bonus.additive` is a **fraction** of `base` for absolute stats; for multiplier stats (melee, movement) it is a fraction of 1.
- `level_increase.wild` is the absolute per-level increment for absolute stats; the multiplier-stat variant divides by `base`.
- Bred creatures always use TE = 1.0 (detected via `ancestors.length > 0 || imprintQuality > 0`).

## Armor

Schema: [`src/schemas/armor.ts`](../src/schemas/armor.ts) · Service: [`src/services/armor.ts`](../src/services/armor.ts)

```ts
{
  set_name: string,                              // displayed name — NOT `name`
  unlock_level: number | null,                   // null = Tekgram-locked
  engram_points: number | null,
  armor_rating: number,
  cold_protection: number,
  heat_protection: number,
  weight: number,
  durability: number | null,                     // null = unbreakable (Federation Exo)
  found_in: string[],                            // map regions
  set_ingredients: { name, quantity, resource_id }[],   // full 5-piece set total
}
```

The `set_ingredients[].resource_id` is a slug pointing to `data/resources/<id>.json` so the API can cross-link.

## Weapons

Schema: [`src/schemas/weapon.ts`](../src/schemas/weapon.ts) · Service: [`src/services/weapon.ts`](../src/services/weapon.ts)

```ts
{
  name: string,
  category: 'tool' | 'melee' | 'ranged' | 'firearm' | 'explosive' | 'tek' | 'shield' | 'turret' | 'attachment',
  damage: number | null,                         // null for utility/shields
  unlock_level: number | null,                   // null = starter or Tekgram
  engram_points: number | null,
  ammo_type: string | null,
  ingredients: { name, quantity, resource_id }[],
}
```

## Resources

Schema: [`src/schemas/resource.ts`](../src/schemas/resource.ts) · Service: [`src/services/resource.ts`](../src/services/resource.ts)

```ts
{
  name: string,
  rarity: 'common' | 'uncommon' | 'rare',
  renewable, refinable, combustible: boolean,
  weight: number,
  stack_size: number,
  found_in: string[],
  hexagon_exchange?: { exchange_yields: number, hexagons: number } | null,
}
```

## Stored creatures (local-only)

Schema: [`src/schemas/stored-creature.ts`](../src/schemas/stored-creature.ts)

The `My Creatures` feature persists user-imported `.ini` exports in IndexedDB via the `idb` package. This data never leaves the browser unless the user opts into Google Drive AppData sync. There is no server-side storage — the Elysia API only serves the static `data/` JSON.

## API conventions

Every list endpoint returns:

```ts
{ count: number, results: Array<ListItem> }
```

Every detail endpoint returns the full schema **plus**:

```ts
{ slug: string, image: string | null }   // image resolves to /images/<kind>/<slug>.png
```

Query params are uniform across list routes: `?limit=`, `?offset=`, and a domain-specific filter (`?category=` for creatures/weapons).

## Adding a new entry

1. Drop the JSON in the right `data/<kind>/` folder using the existing slug convention (lowercase, underscores, no spaces).
2. Drop the matching PNG in `public/images/<kind>/<slug>.png`.
3. Run `bun test` — the schema test will reject malformed JSON, and the creature-images test will catch missing artwork.
4. The list/detail pages and API routes pick the new entry up automatically (services read the directory at first request, then cache).

## Modifying a schema

The Elysia response schema field names must match the data exactly — for example, armor uses `set_name` (not `name`). When renaming a field:

1. Update the Zod schema in `src/schemas/`.
2. Migrate every JSON file under `data/<kind>/` (the schema test will iterate them all and fail loudly).
3. Update list-item projections in the matching `src/services/<kind>.ts`.
4. Update consuming UI in `src/app/<kind>/page.tsx`.
5. Re-run `bun test`.
