/**
 * scripts/map-details.ts — the descriptive half of a map's data, used by
 * scripts/scrape-maps.ts:
 *   - from the map's wiki article: unique features, changes in Ascended, the
 *     creature roster and map-specific items (each grouped as the wiki groups them);
 *   - from Data:Regions/<Map>: named regions as lat/lon boxes;
 *   - from the DataMaps fragments (caves, obelisks, exploration): caves,
 *     terminals, artifacts, player spawn zones and note counts.
 */

import { rawJson, stripMarkup } from './wiki-api'

type Box = [number, number, number, number]
type Pt = [number, number]

// ─── Wikitext structure ────────────────────────────────────────────────────────

interface Section { level: number; title: string; body: string }

/** Every heading with the text up to the next heading of the same or higher level. */
function sections(wikitext: string): Section[] {
  const heads = [...wikitext.matchAll(/^(={2,5})\s*(.+?)\s*\1\s*$/gm)].map((m) => ({
    level: m[1].length,
    title: stripMarkup(m[2]).replace(/\.$/, ''),
    start: m.index!,
    bodyStart: m.index! + m[0].length,
  }))
  return heads.map((h, i) => {
    const next = heads.slice(i + 1).find((n) => n.level <= h.level)
    return { level: h.level, title: h.title, body: wikitext.slice(h.bodyStart, next?.start ?? wikitext.length) }
  })
}

const findSection = (all: Section[], pattern: RegExp) => all.find((s) => pattern.test(s.title))

/** Top-level `* bullet` lines as plain text. */
function bullets(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => /^\*(?!\*)/.test(l))
    .map((l) => stripMarkup(l.replace(/^\*+\s*/, '').replace(/\[\[File:[^\]]*\]\]/g, '')))
    .filter((l) => l.length > 2)
}

/** `{{ItemList|a|b|key=v}}` blocks → their positional names, with the 200 chars before each (for labels). */
function itemLists(text: string): { names: string[]; before: string }[] {
  const out: { names: string[]; before: string }[] = []
  let i = 0
  while ((i = text.indexOf('{{ItemList', i)) >= 0) {
    let depth = 0
    let end = i
    for (let j = i; j < text.length - 1; j++) {
      if (text[j] === '{' && text[j + 1] === '{') { depth++; j++ }
      else if (text[j] === '}' && text[j + 1] === '}') { depth--; j++; if (depth === 0) { end = j + 1; break } }
    }
    const names = text
      .slice(i + 2, end - 2)
      .split('|')
      .slice(1)
      .filter((p) => !p.includes('='))
      .map((p) => stripMarkup(p))
      .filter((p) => p && !p.startsWith('Mod:'))
    out.push({ names, before: text.slice(Math.max(0, i - 200), i) })
    i = end
  }
  return out
}

/** Item lists under a top-level section, grouped by the subsection they're in. */
function groupedLists(all: Section[], top: RegExp): { group: string; names: string[] }[] {
  const root = all.find((s) => s.level === 2 && top.test(s.title))
  if (!root) return []
  // Only the text directly under each heading, so nested lists aren't counted twice.
  const parts: { title: string; text: string }[] = []
  const heads = [...root.body.matchAll(/^(={3,5})\s*(.+?)\s*\1\s*$/gm)]
  parts.push({ title: root.title, text: root.body.slice(0, heads[0]?.index ?? root.body.length) })
  heads.forEach((h, i) => parts.push({ title: stripMarkup(h[2]), text: root.body.slice(h.index! + h[0].length, heads[i + 1]?.index ?? root.body.length) }))

  const groups = new Map<string, string[]>()
  for (const p of parts) {
    for (const list of itemLists(p.text)) {
      const tail = list.before.split('}}').at(-1) ?? ''
      const only = /gamelink\|se\}\}[^\n]*exclusive/i.test(list.before.slice(-60)) || /Evolved[^\n]*exclusive/i.test(tail)
        ? ' (Evolved only)'
        : /gamelink\|sa\}\}[^\n]*exclusive/i.test(list.before.slice(-60)) || /Ascended[^\n]*exclusive/i.test(tail)
          ? ' (Ascended only)'
          : ''
      const key = p.title + only
      groups.set(key, [...new Set([...(groups.get(key) ?? []), ...list.names])])
    }
  }
  return [...groups].filter(([, names]) => names.length).map(([group, names]) => ({ group, names }))
}

export function articleDetails(wikitext: string) {
  const all = sections(wikitext)
  const features = findSection(all, /unique environmental features/i)
  const asa = findSection(all, /^(ASA Differences|Changes in ASA)$/i)
  return {
    features: features ? bullets(features.body) : [],
    asa_changes: asa ? bullets(asa.body) : [],
    roster: groupedLists(all, /^Creatures$/i),
    items: groupedLists(all, /^Items$/i),
  }
}

// ─── Regions ───────────────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100

/** Data:Regions/<Map>: name → [lon, lat, width, height] boxes in game coordinates. */
export async function regions(mapName: string): Promise<{ name: string; areas: Box[] }[]> {
  const data = await rawJson<{ regions: Record<string, number[][]> }>(`Data:Regions/${mapName}`)
  if (!data?.regions) return []
  return Object.entries(data.regions)
    .map(([name, rects]) => ({
      name,
      areas: rects.map(([x, y, w, h]) => [r2(x), r2(y), r2(x + w), r2(y + h)] as Box),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Places from DataMaps ──────────────────────────────────────────────────────

type Marker = { x?: number; y?: number; lat?: number; lon?: number; name?: string; description?: string }
interface DataMapPage {
  include?: string[]
  groups?: Record<string, { name?: string }>
  markers?: Record<string, Marker[]>
}

const xy = (m: Marker): Pt => [r2(m.lon ?? m.x ?? 0), r2(m.lat ?? m.y ?? 0)]

let standardGroups: Record<string, { name?: string }> | null = null

/**
 * Gathers markers from the given DataMaps pages and every fragment they
 * include. Terminal and obelisk names come from the shared group definitions.
 */
export async function places(pages: (DataMapPage | null)[]) {
  standardGroups ??= (await rawJson<DataMapPage>('Data:Maps/Standard group definitions'))?.groups ?? {}

  const seen = new Set<string>()
  const queue = pages.filter(Boolean) as DataMapPage[]
  const groupNames: Record<string, string> = Object.fromEntries(
    Object.entries(standardGroups).map(([k, v]) => [k, v.name?.trim() ?? k]),
  )
  const markers: [string, Marker][] = []
  while (queue.length) {
    const page = queue.shift()!
    for (const [k, v] of Object.entries(page.groups ?? {})) if (v.name) groupNames[k] = v.name.trim()
    for (const [key, list] of Object.entries(page.markers ?? {})) for (const m of list) markers.push([key, m])
    for (const inc of page.include ?? []) {
      if (seen.has(inc) || /Standard group definitions|Loot crate icons/.test(inc)) continue
      seen.add(inc)
      const frag = await rawJson<DataMapPage>(inc)
      if (frag) queue.push(frag)
    }
  }

  const caves: { name: string; x: number; y: number; holds: string[] }[] = []
  const landmarks: { name: string; x: number; y: number }[] = []
  const artifacts: { name: string; x: number; y: number }[] = []
  const spawnZones = new Map<string, Pt[]>()
  let explorerNotes = 0
  let dossiers = 0
  const dedupe = new Set<string>()

  for (const [key, m] of markers) {
    const base = key.split(' ')[0]
    const [x, y] = xy(m)
    const id = `${base}:${x},${y}`
    if (dedupe.has(id)) continue
    dedupe.add(id)

    if (base === 'cave-entrance') {
      const holds = [...(m.description ?? '').matchAll(/\{\{ItemLink\|([^|}]+)/g)].map((h) => h[1].trim())
      caves.push({ name: stripMarkup(m.name ?? 'Cave'), x, y, holds })
    } else if (/^obelisk-|-terminal$/.test(base)) {
      // Fragments for the same map can mark one obelisk a few units apart.
      const name = groupNames[base] ?? base
      if (!landmarks.some((l) => l.name === name && Math.hypot(l.x - x, l.y - y) < 5)) landmarks.push({ name, x, y })
    } else if (base === 'artifact') {
      artifacts.push({ name: stripMarkup(m.name ?? 'Artifact'), x, y })
    } else if (base.startsWith('playerSpawns-')) {
      const name = (groupNames[base] ?? base.replace('playerSpawns-', '')).replace(/^Spawn:\s*/, '')
      spawnZones.set(name, [...(spawnZones.get(name) ?? []), [x, y]])
    } else if (base === 'explorer-note') explorerNotes++
    else if (base === 'dossier') dossiers++
  }

  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { numeric: true })
  return {
    caves: caves.sort(byName),
    landmarks: landmarks.sort(byName),
    artifacts: artifacts.sort(byName),
    player_spawns: [...spawnZones].map(([name, points]) => ({ name, points })).sort(byName),
    explorer_notes: explorerNotes,
    dossiers,
  }
}
