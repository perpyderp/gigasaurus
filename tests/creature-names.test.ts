import { describe, it, expect } from 'bun:test'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { deriveDisplayName, resolveSlug, speciesDisplayName } from '@/lib/dino-map'
import { withName } from '@/lib/creature-names'
import { CreatureService } from '@/services/creature'
import type { StoredCreature } from '@/lib/db'

const DATA_DIR = join(process.cwd(), 'data', 'creatures')
const creatures = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ slug: f.slice(0, -5), ...(JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8')) as { name: string; entity_id?: string; alternate_names?: string[] }) }))

describe('export → creature matching', () => {
  // Tag and blueprint pairs taken from real ASA exports.
  const cases: Array<[tag: string, dinoClass: string, slug: string]> = [
    ['Ptera', '/Game/PrimalEarth/Dinos/Ptero/Ptero_Character_BP.Ptero_Character_BP_C', 'pteranodon'],
    ['FireLion', '/Game/ASA/Dinos/FireLion/FireLion_Character_BP.FireLion_Character_BP_C', 'pyromane'],
    ['Mega', '/Game/PrimalEarth/Dinos/Megalodon/Megalodon_Character_BP.Megalodon_Character_BP_C', 'megalodon'],
    ['AcroAA', '/Game/ASA/Dinos/Acrocanthosaurus/Acrocanthosaurus_Character_BP.Acrocanthosaurus_Character_BP_C', 'acrocanthosaurus'],
    ['Turtle', '/Game/PrimalEarth/Dinos/Turtle/Turtle_Character_BP.Turtle_Character_BP_C', 'carbonemys'],
    ['spineyLizard', '/Game/ScorchedEarth/Dinos/SpineyLizard/SpineyLizard_Character_BP.SpineyLizard_Character_BP_C', 'thorny_dragon'],
    ['Beaver', '/Game/PrimalEarth/Dinos/Beaver/Beaver_Character_BP.Beaver_Character_BP_C', 'castoroides'],
    ['Wyvern', '/Game/ScorchedEarth/Dinos/Wyvern/Wyvern_Character_BP_Ice.Wyvern_Character_BP_Ice_C', 'wyvern'],
    ['YiLing', '/Game/ASA/Dinos/YiLing/YiLing_Character_BP.YiLing_Character_BP_C', 'yi_ling'],
  ]
  for (const [tag, cls, slug] of cases) {
    it(`${tag} → ${slug}`, () => expect(resolveSlug(tag, cls)).toBe(slug))
  }
})

describe('default names', () => {
  it('names unnamed tames after their species, not the export tag', () => {
    expect(speciesDisplayName('pyromane')).toBe('Pyromane')
    expect(deriveDisplayName('', 'FireLion', 'pyromane')).toBe('Pyromane')
    expect(deriveDisplayName('Blaze', 'FireLion', 'pyromane')).toBe('Blaze')
    expect(deriveDisplayName('', 'SomeModDino', null)).toBe('Some Mod Dino')
  })
})

describe('alternate names', () => {
  it('stores the in-game and blueprint names (Pyromane is "Fire Lion" in its blueprint)', () => {
    expect(creatures.find((c) => c.slug === 'pyromane')?.alternate_names).toContain('Fire Lion')
    expect(creatures.find((c) => c.slug === 'wyvern')?.alternate_names).toEqual(expect.arrayContaining(['Fire Wyvern', 'Ice Wyvern', 'Lightning Wyvern', 'Poison Wyvern']))
  })

  it('finds a creature by any of its names', () => {
    expect(CreatureService.getBySlug('Fire Lion')?.slug).toBe('pyromane')
    expect(CreatureService.getBySlug('ice jumper')?.slug).toBe('managarmr')
    expect(CreatureService.getBySlug('Sarcosuchus')?.slug).toBe('sarco')
    expect(CreatureService.getBySlug('Pyromane')?.slug).toBe('pyromane')
  })

  it('never repeats the main name or claims another creature\'s name', () => {
    const mains = new Set(creatures.map((c) => c.name.toLowerCase()))
    for (const c of creatures) {
      for (const alt of c.alternate_names ?? []) {
        expect(alt.toLowerCase()).not.toBe(c.name.toLowerCase())
        if (alt !== 'Sarcosuchus') expect(mains.has(alt.toLowerCase())).toBe(false)
      }
    }
  })
})

describe('creature data integrity', () => {
  it('has no two creatures with the same blueprint', () => {
    const seen = new Map<string, string>()
    for (const c of creatures) {
      if (!c.entity_id) continue
      expect(seen.get(c.entity_id) ?? c.slug).toBe(c.slug)
      seen.set(c.entity_id, c.slug)
    }
  })

  it('has no two creatures with the same name', () => {
    const names = creatures.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('past names', () => {
  const base = { id: '1', name: 'Rex', pastNames: undefined } as unknown as StoredCreature

  it('keeps the replaced name with the time of the change', () => {
    const renamed = withName(base, 'Brutus', 1000)
    expect(renamed.name).toBe('Brutus')
    expect(renamed.pastNames).toEqual([{ name: 'Rex', changedAt: 1000 }])
    const again = withName(renamed, 'Brutus II', 2000)
    expect(again.pastNames).toEqual([{ name: 'Rex', changedAt: 1000 }, { name: 'Brutus', changedAt: 2000 }])
  })

  it('ignores unchanged or blank names', () => {
    expect(withName(base, 'Rex')).toBe(base)
    expect(withName(base, '   ')).toBe(base)
  })
})
