/**
 * Maps ARK creature identifiers to Gigasaurus API slugs.
 *
 * Two lookup strategies, tried in order:
 *   1. DinoNameTag (the short game tag, e.g. "Rex", "Yutyrannus")
 *   2. DinoClass blueprint path (last path segment before the dot)
 *
 * Returns null when the creature has no matching entry in our API.
 */

// ─── DinoNameTag → slug ────────────────────────────────────────────────────────

const NAME_TAG_MAP: Record<string, string> = {
  // Dinosaurs
  Allo: 'allosaurus',
  Allosaurus: 'allosaurus',
  Amarg: 'amargasaurus',
  Amargasaurus: 'amargasaurus',
  Anky: 'ankylosaurus',
  Ankylosaurus: 'ankylosaurus',
  Archa: 'archaeopteryx',
  Archaeopteryx: 'archaeopteryx',
  Barry: 'baryonyx',
  Baryonyx: 'baryonyx',
  Bronto: 'brontosaurus',
  Brontosaurus: 'brontosaurus',
  Carcha: 'carcharodontosaurus',
  Carcharodontosaurus: 'carcharodontosaurus',
  Carno: 'carnotaurus',
  Carnotaurus: 'carnotaurus',
  Compy: 'compy',
  Deinonychus: 'deinonychus',
  Dilo: 'dilophosaur',
  Dilophosaur: 'dilophosaur',
  Diplo: 'diplodocus',
  Diplodocus: 'diplodocus',
  Dreadnoughtus: 'dreadnoughtus',
  Galli: 'gallimimus',
  Gallimimus: 'gallimimus',
  Gigant: 'giganotosaurus',
  Giganotosaurus: 'giganotosaurus',
  Gigantoraptor: 'gigantoraptor',
  Iguanodon: 'iguanodon',
  Kent: 'kentrosaurus',
  Kentrosaurus: 'kentrosaurus',
  Mega: 'megalosaurus',
  Megalosaurus: 'megalosaurus',
  Microraptor: 'microraptor',
  Oviraptor: 'oviraptor',
  Pachy: 'pachy',
  PachyRhino: 'pachyrhinosaurus',
  Pachyrhinosaurus: 'pachyrhinosaurus',
  Para: 'parasaur',
  Parasaur: 'parasaur',
  Pegomastax: 'pegomastax',
  Raptor: 'raptor',
  Rex: 'rex',
  Spino: 'spino',
  Stego: 'stegosaurus',
  Stegosaurus: 'stegosaurus',
  Theri: 'therizinosaur',
  Therizino: 'therizinosaur',
  Therizinosaur: 'therizinosaur',
  Titanosaur: 'titanosaur',
  Trike: 'triceratops',
  Triceratops: 'triceratops',
  Troodon: 'troodon',
  Yutyrannus: 'yutyrannus',
  // Fantasy / aberration / DLC
  Astrocetus: 'astrocetus',
  Astrodelphis: 'astrodelphis',
  Basilisk: 'basilisk',
  Bloodstalker: 'bloodstalker',
  Bulbdog: 'bulbdog',
  CrystalWyvern: 'crystal_wyvern',
  Deathworm: 'deathworm',
  FeatherLight: 'featherlight',
  Featherlight: 'featherlight',
  Fenrir: 'fenrir',
  Ferox: 'ferox',
  Gacha: 'gacha',
  Gasbags: 'gasbags',
  Glowtail: 'glowtail',
  Griffin: 'griffin',
  InsectSwarm: 'insect_swarm',
  CaveCrab: 'karkinos',
  Karkinos: 'karkinos',
  Macrophage: 'macrophage',
  Maewing: 'maewing',
  Magmasaur: 'magmasaur',
  Managarmr: 'managarmr',
  Megachelon: 'megachelon',
  Morellatops: 'morellatops',
  Nameless: 'nameless',
  Noglin: 'noglin',
  ParakeetFishSchool: 'parakeet_fish_school',
  Phoenix: 'phoenix',
  Ravager: 'ravager',
  Reaper: 'reaper',
  RockDrake: 'rock_drake',
  RockGolem: 'rock_elemental',
  RockElemental: 'rock_elemental',
  Seeker: 'seeker',
  Shadowmane: 'shadowmane',
  Shinehorn: 'shinehorn',
  Owl: 'snow_owl',
  SnowOwl: 'snow_owl',
  Summoner: 'summoner',
  Unicorn: 'unicorn',
  Equus: 'unicorn',
  Velonasaur: 'velonasaur',
  Wyvern: 'wyvern',
}

// ─── Blueprint class path → slug ───────────────────────────────────────────────

// Extracted from the last path segment: "Rex_Character_BP_C" → "Rex"
// Maps partial class name substrings to slugs as a fallback.
const CLASS_FRAGMENT_MAP: Array<[RegExp, string]> = [
  [/Allosaurus/i, 'allosaurus'],
  [/Amargasaurus/i, 'amargasaurus'],
  [/Ankylosaurus/i, 'ankylosaurus'],
  [/Archaeopteryx/i, 'archaeopteryx'],
  [/Baryonyx/i, 'baryonyx'],
  [/Brontosaurus/i, 'brontosaurus'],
  [/Carcharodontosaurus/i, 'carcharodontosaurus'],
  [/Carnotaurus/i, 'carnotaurus'],
  [/Compy/i, 'compy'],
  [/Deinonychus/i, 'deinonychus'],
  [/Dilophosaur/i, 'dilophosaur'],
  [/Diplodocus/i, 'diplodocus'],
  [/Dreadnoughtus/i, 'dreadnoughtus'],
  [/Gallimimus/i, 'gallimimus'],
  [/Giganotosaurus/i, 'giganotosaurus'],
  [/Gigantoraptor/i, 'gigantoraptor'],
  [/Iguanodon/i, 'iguanodon'],
  [/Kentrosaurus/i, 'kentrosaurus'],
  [/Megalosaurus/i, 'megalosaurus'],
  [/Microraptor/i, 'microraptor'],
  [/Oviraptor/i, 'oviraptor'],
  [/Pachyrhinosaurus/i, 'pachyrhinosaurus'],
  [/Pachy/i, 'pachy'],
  [/Parasaur/i, 'parasaur'],
  [/Pegomastax/i, 'pegomastax'],
  [/Raptor/i, 'raptor'],
  [/TRex|T_Rex|Rex_Character/i, 'rex'],
  [/Spinosaur|Spino_/i, 'spino'],
  [/Stegosaur/i, 'stegosaurus'],
  [/Therizino/i, 'therizinosaur'],
  [/Titanosaur/i, 'titanosaur'],
  [/Triceratops/i, 'triceratops'],
  [/Troodon/i, 'troodon'],
  [/Yutyrannus/i, 'yutyrannus'],
  [/Astrocetus/i, 'astrocetus'],
  [/Astrodelphis/i, 'astrodelphis'],
  [/Basilisk/i, 'basilisk'],
  [/Bloodstalker/i, 'bloodstalker'],
  [/Bulbdog/i, 'bulbdog'],
  [/CrystalWyvern/i, 'crystal_wyvern'],
  [/Deathworm/i, 'deathworm'],
  [/FeatherLight/i, 'featherlight'],
  [/Fenrir/i, 'fenrir'],
  [/Ferox/i, 'ferox'],
  [/Gacha/i, 'gacha'],
  [/Gasbags/i, 'gasbags'],
  [/Glowtail/i, 'glowtail'],
  [/Griffin/i, 'griffin'],
  [/InsectSwarm/i, 'insect_swarm'],
  [/CaveCrab|Karkinos/i, 'karkinos'],
  [/Macrophage/i, 'macrophage'],
  [/Maewing/i, 'maewing'],
  [/Magmasaur/i, 'magmasaur'],
  [/Managarmr/i, 'managarmr'],
  [/Megachelon/i, 'megachelon'],
  [/Morellatops/i, 'morellatops'],
  [/Nameless/i, 'nameless'],
  [/Noglin/i, 'noglin'],
  [/ParakeetFishSchool|FishSchool/i, 'parakeet_fish_school'],
  [/Phoenix/i, 'phoenix'],
  [/Ravager/i, 'ravager'],
  [/Reaper/i, 'reaper'],
  [/RockDrake/i, 'rock_drake'],
  [/RockGolem|RockElemental/i, 'rock_elemental'],
  [/Seeker/i, 'seeker'],
  [/Shadowmane/i, 'shadowmane'],
  [/Shinehorn/i, 'shinehorn'],
  [/SnowOwl/i, 'snow_owl'],
  [/Spindles/i, 'velonasaur'], // Velonasaur uses "Spindles" in blueprint
  [/Summoner/i, 'summoner'],
  [/Equus|Unicorn/i, 'unicorn'],
  [/Wyvern/i, 'wyvern'],
]

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a Gigasaurus API slug from ARK's DinoNameTag and DinoClass fields.
 * Returns null when the creature isn't in the API.
 */
export function resolveSlug(dinoNameTag: string, dinoClass: string): string | null {
  // 1. Exact match on name tag
  if (NAME_TAG_MAP[dinoNameTag]) return NAME_TAG_MAP[dinoNameTag]

  // 2. Case-insensitive name tag match
  const tagLower = dinoNameTag.toLowerCase()
  for (const [key, slug] of Object.entries(NAME_TAG_MAP)) {
    if (key.toLowerCase() === tagLower) return slug
  }

  // 3. Blueprint class path fragments
  for (const [pattern, slug] of CLASS_FRAGMENT_MAP) {
    if (pattern.test(dinoClass)) return slug
  }

  return null
}

/**
 * Derive a display name for the creature.
 * Uses TamedName if set, otherwise formats the DinoNameTag.
 */
export function deriveDisplayName(tamedName: string, dinoNameTag: string): string {
  if (tamedName.trim()) return tamedName.trim()
  // Convert tag like "CeratosaurusAA" or "DeinosuchusAA" to readable form
  return dinoNameTag.replace(/AA$/, '').replace(/([A-Z])/g, ' $1').trim()
}
