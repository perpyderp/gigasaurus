import { describe, it, expect, beforeAll } from 'bun:test'
import { app } from '@/app/api/[[...slugs]]/route'
import { CreatureListSchema, CreatureDetailSchema } from '@/schemas/creature'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`))
}

// ─── List endpoint ────────────────────────────────────────────────────────────

describe('GET /api/creatures', () => {
  it('returns 200', async () => {
    const res = await get('/api/creatures')
    expect(res.status).toBe(200)
  })

  it('response matches CreatureListSchema', async () => {
    const res = await get('/api/creatures')
    const json = await res.json()
    const parsed = CreatureListSchema.safeParse(json)
    expect(parsed.success).toBe(true)
  })

  it('count matches results length without pagination', async () => {
    const res = await get('/api/creatures?limit=100&offset=0')
    const json = await res.json()
    expect(json.count).toBeGreaterThan(0)
    expect(json.results.length).toBeLessThanOrEqual(100)
  })

  it('each list item has required fields', async () => {
    const res = await get('/api/creatures')
    const { results } = await res.json()
    for (const item of results) {
      expect(typeof item.name).toBe('string')
      expect(typeof item.slug).toBe('string')
      expect(typeof item.category).toBe('string')
      expect(typeof item.url).toBe('string')
      expect(item.url).toStartWith('http://localhost/api/creatures/')
    }
  })

  it('filters by category=dinosaur', async () => {
    const res = await get('/api/creatures?category=dinosaur&limit=100')
    const { results } = await res.json()
    expect(results.length).toBeGreaterThan(0)
    for (const item of results) {
      expect(item.category).toBe('dinosaur')
    }
  })

  it('filters by category=fantasy', async () => {
    const res = await get('/api/creatures?category=fantasy&limit=100')
    const { results } = await res.json()
    expect(results.length).toBeGreaterThan(0)
    for (const item of results) {
      expect(item.category).toBe('fantasy')
    }
  })

  it('respects limit param', async () => {
    const res = await get('/api/creatures?limit=5')
    const { results } = await res.json()
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it('respects offset param', async () => {
    const [first, second] = await Promise.all([
      get('/api/creatures?limit=1&offset=0').then((r) => r.json()),
      get('/api/creatures?limit=1&offset=1').then((r) => r.json()),
    ])
    expect(first.results[0]?.slug).not.toBe(second.results[0]?.slug)
  })
})

// ─── Detail endpoint ──────────────────────────────────────────────────────────

describe('GET /api/creatures/:slug', () => {
  it('returns 200 for rex', async () => {
    const res = await get('/api/creatures/rex')
    expect(res.status).toBe(200)
  })

  it('response matches CreatureDetailSchema for rex', async () => {
    const res = await get('/api/creatures/rex')
    const json = await res.json()
    const parsed = CreatureDetailSchema.safeParse(json)
    if (!parsed.success) console.error(parsed.error.flatten())
    expect(parsed.success).toBe(true)
  })

  it('rex has correct name and category', async () => {
    const res = await get('/api/creatures/rex')
    const json = await res.json()
    expect(json.name).toBe('Rex')
    expect(json.category).toBe('dinosaur')
    expect(json.slug).toBe('rex')
  })

  it('rex saddle is always an array', async () => {
    const res = await get('/api/creatures/rex')
    const json = await res.json()
    expect(Array.isArray(json.saddle)).toBe(true)
  })

  it('rex has correct stat keys', async () => {
    const res = await get('/api/creatures/rex')
    const { base_stats_growth } = await res.json()
    const expected = ['health', 'stamina', 'oxygen', 'food', 'weight', 'melee', 'movement', 'torpidity']
    for (const stat of expected) {
      expect(base_stats_growth).toHaveProperty(stat)
    }
  })

  it('returns 200 for wyvern (non-tameable, null saddle)', async () => {
    const res = await get('/api/creatures/wyvern')
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.tameable).toBe(false)
    expect(json.saddle).toBeNull()
  })

  it('returns 200 for rock_elemental (saddle was single object, normalized to array)', async () => {
    const res = await get('/api/creatures/rock_elemental')
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(json.saddle)).toBe(true)
    expect(json.saddle.length).toBeGreaterThan(0)
  })

  it('returns 404 for unknown slug', async () => {
    const res = await get('/api/creatures/notacreature')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.message).toContain('notacreature')
  })

  it('image field is a string path', async () => {
    const res = await get('/api/creatures/rex')
    const json = await res.json()
    expect(typeof json.image).toBe('string')
    expect(json.image).toStartWith('http://localhost/images/creatures/')
  })
})
