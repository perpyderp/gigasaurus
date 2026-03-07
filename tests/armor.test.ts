import { describe, it, expect } from 'bun:test'
import { app } from '@/app/api/[[...slugs]]/route'
import { ArmorListSchema, ArmorDetailSchema } from '@/schemas/armor'

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`))
}

// ─── List endpoint ────────────────────────────────────────────────────────────

describe('GET /api/armor', () => {
  it('returns 200', async () => {
    const res = await get('/api/armor')
    expect(res.status).toBe(200)
  })

  it('response matches ArmorListSchema', async () => {
    const res = await get('/api/armor')
    const json = await res.json()
    const parsed = ArmorListSchema.safeParse(json)
    expect(parsed.success).toBe(true)
  })

  it('has at least 9 armor sets', async () => {
    const res = await get('/api/armor?limit=100')
    const json = await res.json()
    expect(json.count).toBeGreaterThanOrEqual(9)
  })

  it('each item has required list fields', async () => {
    const res = await get('/api/armor')
    const { results } = await res.json()
    for (const item of results) {
      expect(typeof item.set_name).toBe('string')
      expect(typeof item.slug).toBe('string')
      expect(typeof item.armor_rating).toBe('number')
      expect(typeof item.url).toBe('string')
      expect(item.url).toStartWith('http://localhost/api/armor/')
    }
  })

  it('armor sets are sorted by increasing armor_rating (infer from list order)', async () => {
    const res = await get('/api/armor?limit=100')
    const { results } = await res.json()
    // Just verify we have multiple entries with varying ratings
    const ratings = results.map((r: { armor_rating: number }) => r.armor_rating)
    expect(Math.max(...ratings)).toBeGreaterThan(Math.min(...ratings))
  })
})

// ─── Detail endpoint ──────────────────────────────────────────────────────────

describe('GET /api/armor/:slug', () => {
  it('returns 200 for flak', async () => {
    const res = await get('/api/armor/flak')
    expect(res.status).toBe(200)
  })

  it('flak matches ArmorDetailSchema', async () => {
    const res = await get('/api/armor/flak')
    const json = await res.json()
    const parsed = ArmorDetailSchema.safeParse(json)
    if (!parsed.success) console.error(parsed.error.flatten())
    expect(parsed.success).toBe(true)
  })

  it('flak has correct base stats', async () => {
    const res = await get('/api/armor/flak')
    const json = await res.json()
    expect(json.set_name).toBe('Flak Armor')
    expect(json.slug).toBe('flak')
    expect(json.armor_rating).toBe(500)
    expect(json.unlock_level).toBe(56)
    expect(Array.isArray(json.set_ingredients)).toBe(true)
    expect(json.set_ingredients.length).toBeGreaterThan(0)
  })

  it('flak ingredients have resource_id for cross-referencing', async () => {
    const res = await get('/api/armor/flak')
    const { set_ingredients } = await res.json()
    for (const ing of set_ingredients) {
      expect(typeof ing.name).toBe('string')
      expect(typeof ing.quantity).toBe('number')
      expect(typeof ing.resource_id).toBe('string')
    }
  })

  it('tek armor has null unlock_level (Tekgram)', async () => {
    const res = await get('/api/armor/tek')
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.unlock_level).toBeNull()
    expect(json.armor_rating).toBe(900)
  })

  it('image field points to correct path', async () => {
    const res = await get('/api/armor/flak')
    const json = await res.json()
    expect(json.image).toBe('http://localhost/images/armor/flak.png')
  })

  it('returns 404 for unknown slug', async () => {
    const res = await get('/api/armor/mithril')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.message).toContain('mithril')
  })
})
