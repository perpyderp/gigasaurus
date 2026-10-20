import { describe, it, expect } from 'bun:test'
import type { StoredCreature } from '@/lib/db'
import { EMPTY_FILTERS, filterAndSortCreatures, inGameName, paginate } from '@/lib/creature-filters'

function tame(id: string, over: Partial<StoredCreature> & { tamedName?: string } = {}): StoredCreature {
  const { tamedName = '', ...rest } = over
  return {
    id, dinoId1: 0, dinoId2: 0, dinoClass: 'Rex_Character_BP_C', dinoNameTag: 'Rex', name: tamedName || 'Rex',
    isFemale: false, isNeutered: false, tribe: '', tamer: '', imprinter: '', babyAge: 1, level: 1, imprintQuality: 0,
    mutationsMale: 0, mutationsFemale: 0, colors: [],
    stats: { health: 0, stamina: 0, torpidity: 0, oxygen: 0, food: 0, water: 0, temperature: 0, weight: 0, meleeDamage: 0, movementSpeed: 0, fortitude: 0, craftingSkill: 0 },
    ancestors: [], ancestorsMale: [], apiSlug: 'rex', rawIni: `[Dino Data]\nDinoNameTag=Rex\nTamedName=${tamedName}\n`,
    importFilename: null, manualParentMaleId: null, manualParentFemaleId: null, importedAt: 0, updatedAt: 0,
    ...rest,
  }
}

describe('creature filters', () => {
  const list = [
    tame('a', { tamedName: 'Chomper', name: 'Breeder Queen', isFemale: true, mutationsFemale: 2, level: 150 }),
    tame('b', { tamedName: 'Biter', level: 200 }),
    tame('c', { isFemale: true, level: 120, mutationsMale: 5 }),
  ]

  it('reads the in-game name separately from the local label', () => {
    expect(inGameName(list[0])).toBe('Chomper')
    expect(list[0].name).toBe('Breeder Queen')
    expect(inGameName(list[2])).toBe('')
  })

  it('searches both the label and the in-game name', () => {
    expect(filterAndSortCreatures(list, { ...EMPTY_FILTERS, search: 'chomp' }).map((c) => c.id)).toEqual(['a'])
    expect(filterAndSortCreatures(list, { ...EMPTY_FILTERS, search: 'queen' }).map((c) => c.id)).toEqual(['a'])
  })

  it('filters by gender and mutations, and sorts', () => {
    const females = filterAndSortCreatures(list, { ...EMPTY_FILTERS, gender: 'f', sort: 'mutations' })
    expect(females.map((c) => c.id)).toEqual(['c', 'a'])
    expect(filterAndSortCreatures(list, { ...EMPTY_FILTERS, mutations: '0' }).map((c) => c.id)).toEqual(['b'])
    expect(filterAndSortCreatures(list, { ...EMPTY_FILTERS, sort: 'level' }).map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })

  it('clamps pages', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    expect(paginate(items, 3, 9)).toEqual({ totalPages: 3, page: 3, items: [18, 19] })
    expect(paginate(items, 99, 9).page).toBe(3)
    expect(paginate([], 1, 9)).toEqual({ totalPages: 1, page: 1, items: [] })
  })
})
