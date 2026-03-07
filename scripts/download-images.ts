/**
 * Downloads ARK wiki images for all API resources.
 * Run with: bun run scripts/download-images.ts
 *
 * Image URL patterns:
 *   Creatures:  https://ark.wiki.gg/images/Dossier_<WikiName>.png
 *   Resources:  https://ark.wiki.gg/images/<WikiName>.png
 *   Armor:      https://ark.wiki.gg/images/<WikiName>_Armor_Skin.png  (set icon)
 *   Weapons:    https://ark.wiki.gg/images/<WikiName>.png
 */
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const PUBLIC = join(import.meta.dir, '..', 'public', 'images')
const WIKI = 'https://ark.wiki.gg/images'
const DELAY_MS = 300

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function download(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) {
    console.log(`  ↩ skip  ${dest.split('/public/')[1]} (exists)`)
    return true
  }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Gigasaurus-Bot/1.0 (https://github.com/perpyderp/gigasaurus)' },
    })
    if (!res.ok) {
      console.warn(`  ✗ ${res.status} ${url}`)
      return false
    }
    const buf = await res.arrayBuffer()
    writeFileSync(dest, Buffer.from(buf))
    console.log(`  ✓ ${dest.split('/public/')[1]}`)
    return true
  } catch (e) {
    console.warn(`  ✗ fetch error: ${url}`, e)
    return false
  }
}

// ─── Creatures ────────────────────────────────────────────────────────────────
const CREATURE_MAP: Record<string, string> = {
  allosaurus:           'Allosaurus',
  amargasaurus:         'Amargasaurus',
  ankylosaurus:         'Ankylosaurus',
  archaeopteryx:        'Archaeopteryx',
  astrocetus:           'Astrocetus',
  astrodelphis:         'Astrodelphis',
  baryonyx:             'Baryonyx',
  basilisk:             'Basilisk',
  bloodstalker:         'Bloodstalker',
  brontosaurus:         'Brontosaurus',
  bulbdog:              'Bulbdog',
  carcharodontosaurus:  'Carcharodontosaurus',
  carnotaurus:          'Carnotaurus',
  compy:                'Compy',
  crystal_wyvern:       'Crystal_Wyvern',
  deathworm:            'Deathworm',
  deinonychus:          'Deinonychus',
  dilophosaur:          'Dilophosaur',
  diplodocus:           'Diplodocus',
  dreadnoughtus:        'Dreadnoughtus',
  featherlight:         'Featherlight',
  fenrir:               'Fenrir',
  ferox:                'Ferox',
  gacha:                'Gacha',
  gallimimus:           'Gallimimus',
  gasbags:              'Gasbags',
  giganotosaurus:       'Giganotosaurus',
  gigantoraptor:        'Gigantoraptor',
  griffin:              'Griffin',
  glowtail:             'Glowtail',
  iguanodon:            'Iguanodon',
  insect_swarm:         'Insect_Swarm',
  karkinos:             'Karkinos',
  kentrosaurus:         'Kentrosaurus',
  macrophage:           'Macrophage',
  maewing:              'Maewing',
  magmasaur:            'Magmasaur',
  managarmr:            'Managarmr',
  megachelon:           'Megachelon',
  megalosaurus:         'Megalosaurus',
  microraptor:          'Microraptor',
  morellatops:          'Morellatops',
  nameless:             'Nameless',
  noglin:               'Noglin',
  oviraptor:            'Oviraptor',
  pachy:                'Pachy',
  pachyrhinosaurus:     'Pachyrhinosaurus',
  parasaur:             'Parasaur',
  parakeet_fish_school: 'Parakeet_Fish_School',
  pegomastax:           'Pegomastax',
  phoenix:              'Phoenix',
  raptor:               'Raptor',
  ravager:              'Ravager',
  reaper:               'Reaper',
  rex:                  'Rex',
  rock_drake:           'Rock_Drake',
  rock_elemental:       'Rock_Elemental',
  seeker:               'Seeker',
  shadowmane:           'Shadowmane',
  shinehorn:            'Shinehorn',
  snow_owl:             'Snow_Owl',
  spino:                'Spinosaurus',
  stegosaurus:          'Stegosaurus',
  summoner:             'Summoner',
  therizinosaur:        'Therizinosaur',
  titanosaur:           'Titanosaur',
  triceratops:          'Triceratops',
  troodon:              'Troodon',
  unicorn:              'Unicorn',
  velonasaur:           'Velonasaur',
  wyvern:               'Wyvern',
  yutyrannus:           'Yutyrannus',
}

// ─── Resources ────────────────────────────────────────────────────────────────
const RESOURCE_MAP: Record<string, string> = {
  cementing_paste: 'Cementing_Paste',
  chitin:          'Chitin',
  crystal:         'Crystal',
  fiber:           'Fiber',
  flint:           'Flint',
  hide:            'Hide',
  keratin:         'Keratin',
  metal:           'Metal',
  metal_ingot:     'Metal_Ingot',
  obsidian:        'Obsidian',
  oil:             'Oil',
  pelt:            'Pelt',
  polymer:         'Polymer',
  stone:           'Stone',
  thatch:          'Thatch',
  wood:            'Wood',
}

// ─── Armor ────────────────────────────────────────────────────────────────────
// Use the chestpiece as the set representative image
const ARMOR_MAP: Record<string, string> = {
  cloth:        'Cloth_Shirt',
  desert_cloth: 'Desert_Cloth_Shirt',
  fur:          'Fur_Chestpiece',
  ghillie:      'Ghillie_Suit',
  chitin:       'Chitin_Chestpiece',
  flak:         'Flak_Chestpiece',
  riot:         'Riot_Chestpiece',
  tek:          'Tek_Chestpiece',
}

// ─── Weapons ─────────────────────────────────────────────────────────────────
const WEAPON_MAP: Record<string, string> = {
  assault_rifle:  'Assault_Rifle',
  bow:            'Bow',
  crossbow:       'Crossbow',
  longneck_rifle: 'Longneck_Rifle',
  metal_hatchet:  'Metal_Hatchet',
  metal_pick:     'Metal_Pick',
  pike:           'Pike',
  shotgun:        'Shotgun',
  simple_pistol:  'Simple_Pistol',
  spear:          'Spear',
  stone_hatchet:  'Stone_Hatchet',
  stone_pick:     'Stone_Pick',
  sword:          'Sword',
}

async function downloadGroup(
  label: string,
  map: Record<string, string>,
  destDir: string,
  urlBuilder: (wikiName: string) => string
) {
  mkdirSync(destDir, { recursive: true })
  console.log(`\n── ${label} ──`)
  let ok = 0
  let fail = 0
  for (const [slug, wikiName] of Object.entries(map)) {
    const url = urlBuilder(wikiName)
    const dest = join(destDir, `${slug}.png`)
    const success = await download(url, dest)
    success ? ok++ : fail++
    await sleep(DELAY_MS)
  }
  console.log(`   ${ok} downloaded, ${fail} failed`)
}

await downloadGroup(
  'Creatures (dossiers)',
  CREATURE_MAP,
  join(PUBLIC, 'creatures'),
  (n) => `${WIKI}/Dossier_${n}.png`
)

await downloadGroup(
  'Resources',
  RESOURCE_MAP,
  join(PUBLIC, 'resources'),
  (n) => `${WIKI}/${n}.png`
)

await downloadGroup(
  'Armor',
  ARMOR_MAP,
  join(PUBLIC, 'armor'),
  (n) => `${WIKI}/${n}.png`
)

await downloadGroup(
  'Weapons',
  WEAPON_MAP,
  join(PUBLIC, 'weapons'),
  (n) => `${WIKI}/${n}.png`
)

console.log('\nImage download complete.')
