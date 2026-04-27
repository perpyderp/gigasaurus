# Testing

Gigasaurus uses **`bun:test`** as the test runner — `package.json` declares a `jest` script for compatibility, but the test files themselves import from `bun:test`. Always invoke tests with the Bun runtime.

## Running tests

```bash
# Run the full suite once
bun test

# Watch mode — re-runs on file save
bun test --watch

# Run a single file
bun test tests/armor.test.ts

# Filter by test name (regex)
bun test --test-name-pattern "GET /api/armor"
```

Tests live in [`tests/`](../tests/) at the repo root and resolve `@/` aliases via [`tsconfig.json`](../tsconfig.json).

## What the suites cover

| File | Scope |
| --- | --- |
| [`tests/creatures.test.ts`](../tests/creatures.test.ts) | `GET /api/creatures` list + `GET /api/creatures/:slug` detail. Validates response shape against `CreatureListSchema` / `CreatureDetailSchema`, plus pagination and `?category=` filtering. |
| [`tests/creature-images.test.ts`](../tests/creature-images.test.ts) | Asserts every creature JSON has a matching `public/images/creatures/<slug>.png`. Catches missing artwork on new contributions. |
| [`tests/armor.test.ts`](../tests/armor.test.ts) | `GET /api/armor` and `GET /api/armor/:slug`. Schema validation + minimum item count. |
| [`tests/weapons.test.ts`](../tests/weapons.test.ts) | `GET /api/weapons` and detail route, including `?category=` filtering across the `WeaponCategoryEnum`. |
| [`tests/resources.test.ts`](../tests/resources.test.ts) | `GET /api/resources` list + detail. Validates rarity enum and optional `hexagon_exchange`. |

## Patterns

All API tests share the same setup — the Elysia `app` is imported directly and called with a `Request`, no HTTP server required:

```ts
import { describe, it, expect } from 'bun:test'
import { app } from '@/app/api/[[...slugs]]/route'

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`))
}
```

Schemas (`CreatureListSchema`, `ArmorDetailSchema`, etc.) double as test contracts — when a schema field is added, the suite fails until response shape catches up.

## Adding a new test

1. Create `tests/<feature>.test.ts`.
2. Import `describe`, `it`, `expect` from `bun:test`.
3. Import the relevant Zod schema from `@/schemas/...` and validate response shape with `safeParse`.
4. Run `bun test tests/<feature>.test.ts` to verify.

## CI gotchas

- Tests do **not** spin up `next dev`; they hit the Elysia handler in-process.
- Zod **v3** is required — Zod v4 breaks Elysia v1 at request time, which surfaces as runtime errors in tests, not type errors. Do not upgrade.
- The creature image test reads the filesystem; if you remove a creature JSON, also remove its image (or vice versa) or the suite will fail.
