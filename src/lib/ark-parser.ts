/**
 * Parser for ARK: Survival Ascended/Evolved creature export .ini files.
 *
 * Format is a Windows .ini with custom sections:
 *   [Dino Data], [Colorization], [Max Character Status Values],
 *   [Dino Ancestry], [DinoAncestors], [DinoAncestorsMale]
 *
 * Color values are stored in linear float space.
 * A=1.000000 on a color slot means the slot is empty/unused.
 */

export interface ArkColor {
  r: number
  g: number
  b: number
  /** true when ARK marks the slot as empty (alpha = 1.0) */
  empty: boolean
}

export interface AncestorEntry {
  maleName: string
  maleDinoId1: number
  maleDinoId2: number
  femaleName: string
  femaleDinoId1: number
  femaleDinoId2: number
}

export interface ArkCreatureStats {
  health: number
  stamina: number
  torpidity: number
  oxygen: number
  food: number
  water: number
  temperature: number
  weight: number
  meleeDamage: number
  movementSpeed: number
  fortitude: number
  craftingSkill: number
}

export interface ParsedExport {
  /** Unique creature ID composed of DinoID1 and DinoID2 */
  id: string
  dinoId1: number
  dinoId2: number
  /** Full blueprint class path */
  dinoClass: string
  /** Short game name tag (e.g. "Rex", "Yutyrannus", "CeratosaurusAA") */
  dinoNameTag: string
  isFemale: boolean
  isNeutered: boolean
  /** Player-given nickname, may be empty */
  tamedName: string
  tribe: string
  tamer: string
  imprinter: string
  /** 0–1 where 1 = fully grown */
  babyAge: number
  level: number
  /** 0–1 where 1 = 100% imprint */
  imprintQuality: number
  mutationsMale: number
  mutationsFemale: number
  /** 6 color slots in linear float space */
  colors: ArkColor[]
  stats: ArkCreatureStats
  ancestors: AncestorEntry[]
  ancestorsMale: AncestorEntry[]
}

// ─── Section parser ────────────────────────────────────────────────────────────

type Section = Record<string, string>

function parseSections(text: string): Record<string, Section> {
  const sections: Record<string, Section> = {}
  let current = ''

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      current = sectionMatch[1]
      sections[current] = {}
      continue
    }

    if (current && line.includes('=')) {
      const eq = line.indexOf('=')
      const key = line.slice(0, eq).trim()
      const val = line.slice(eq + 1).trim()
      sections[current][key] = val
    }
  }

  return sections
}

// ─── Color parser ──────────────────────────────────────────────────────────────

/**
 * Parse a color value like "(R=0.479320,G=0.000000,B=0.051269,A=0.000000)"
 * A=1.0 means the slot is empty in ARK's encoding.
 */
function parseColor(value: string): ArkColor {
  const r = parseFloat(value.match(/R=([\d.]+)/)?.[1] ?? '0')
  const g = parseFloat(value.match(/G=([\d.]+)/)?.[1] ?? '0')
  const b = parseFloat(value.match(/B=([\d.]+)/)?.[1] ?? '0')
  const a = parseFloat(value.match(/A=([\d.]+)/)?.[1] ?? '0')
  return { r, g, b, empty: a >= 1.0 }
}

// ─── Ancestor parser ───────────────────────────────────────────────────────────

/**
 * Parse a single ancestor row like:
 * "MaleName=Rex - Lvl 202;MaleDinoID1=371375654;MaleDinoID2=158510339;FemaleName=Rex - Lvl 209;..."
 */
function parseAncestorRow(value: string): AncestorEntry {
  const get = (key: string) => {
    const m = value.match(new RegExp(`${key}=([^;]+)`))
    return m ? m[1].trim() : ''
  }
  return {
    maleName: get('MaleName'),
    maleDinoId1: parseInt(get('MaleDinoID1') || '0', 10),
    maleDinoId2: parseInt(get('MaleDinoID2') || '0', 10),
    femaleName: get('FemaleName'),
    femaleDinoId1: parseInt(get('FemaleDinoID1') || '0', 10),
    femaleDinoId2: parseInt(get('FemaleDinoID2') || '0', 10),
  }
}

function parseAncestorSection(section: Section, prefix: string): AncestorEntry[] {
  const entries: AncestorEntry[] = []
  let i = 0
  while (`${prefix}${i}` in section) {
    entries.push(parseAncestorRow(section[`${prefix}${i}`]))
    i++
  }
  return entries
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function parseArkExport(iniText: string): ParsedExport {
  const sections = parseSections(iniText)

  const data = sections['Dino Data'] ?? {}
  const colorSection = sections['Colorization'] ?? {}
  const statsSection = sections['Max Character Status Values'] ?? {}
  const ancestorsSection = sections['DinoAncestors'] ?? {}
  const ancestorsMaleSection = sections['DinoAncestorsMale'] ?? {}

  const dinoId1 = parseInt(data['DinoID1'] ?? '0', 10)
  const dinoId2 = parseInt(data['DinoID2'] ?? '0', 10)

  const colors: ArkColor[] = []
  for (let i = 0; i < 6; i++) {
    const raw = colorSection[`ColorSet[${i}]`]
    colors.push(raw ? parseColor(raw) : { r: 0, g: 0, b: 0, empty: true })
  }

  const stat = (key: string) => parseFloat(statsSection[key] ?? '0')

  return {
    id: `${dinoId1}_${dinoId2}`,
    dinoId1,
    dinoId2,
    dinoClass: data['DinoClass'] ?? '',
    dinoNameTag: data['DinoNameTag'] ?? '',
    isFemale: data['bIsFemale'] === 'True',
    isNeutered: data['bNeutered'] === 'True',
    tamedName: data['TamedName'] ?? '',
    tribe: data['TribeName'] ?? '',
    tamer: data['TamerString'] ?? '',
    imprinter: data['ImprinterName'] ?? '',
    babyAge: parseFloat(data['BabyAge'] ?? '0'),
    level: parseInt(data['CharacterLevel'] ?? '0', 10),
    imprintQuality: parseFloat(data['DinoImprintingQuality'] ?? '0'),
    mutationsMale: parseInt(data['RandomMutationsMale'] ?? '0', 10),
    mutationsFemale: parseInt(data['RandomMutationsFemale'] ?? '0', 10),
    colors,
    stats: {
      health: stat('Health'),
      stamina: stat('Stamina'),
      torpidity: stat('Torpidity'),
      oxygen: stat('Oxygen'),
      food: stat('food'),
      water: stat('Water'),
      temperature: stat('Temperature'),
      weight: stat('Weight'),
      meleeDamage: stat('Melee Damage'),
      movementSpeed: stat('Movement Speed'),
      fortitude: stat('Fortitude'),
      craftingSkill: stat('Crafting Skill'),
    },
    ancestors: parseAncestorSection(ancestorsSection, 'DinoAncestors'),
    ancestorsMale: parseAncestorSection(ancestorsMaleSection, 'DinoAncestorsMale'),
  }
}

// ─── Color conversion ──────────────────────────────────────────────────────────

/** Convert a linear float [0,1] to sRGB [0,1] */
function linearToSRGB(c: number): number {
  if (c <= 0) return 0
  if (c >= 1) return 1
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** Convert a linear-space ArkColor to a CSS hex string like "#ff8800" */
export function colorToHex(color: ArkColor): string {
  if (color.empty) return '#888888'
  const r = Math.round(linearToSRGB(color.r) * 255)
  const g = Math.round(linearToSRGB(color.g) * 255)
  const b = Math.round(linearToSRGB(color.b) * 255)
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}
