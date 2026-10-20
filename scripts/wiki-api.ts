/**
 * scripts/wiki-api.ts — shared helpers for the ark.wiki.gg scrapers.
 *
 * Everything goes through the MediaWiki API (or `action=raw`) to avoid
 * Cloudflare blocks, with one global rate limit across all requests.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'

export const WIKI = 'https://ark.wiki.gg'
export const WIKI_API = `${WIKI}/api.php`
const UA = 'Gigasaurus/1.0 (ARK wiki research; contact via GitHub)'
const DELAY_MS = 500

let lastFetch = 0

async function throttledFetch(url: string): Promise<Response> {
  const wait = Math.max(0, DELAY_MS - (Date.now() - lastFetch))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastFetch = Date.now()
  return fetch(url, { headers: { 'User-Agent': UA } })
}

export async function apiGet<T>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  const res = await throttledFetch(`${WIKI_API}?${qs}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${qs}`)
  return (await res.json()) as T
}

/** Raw page content, e.g. a `Data:` namespace JSON page. Null when the page doesn't exist. */
export async function rawPage(title: string): Promise<string | null> {
  const res = await throttledFetch(`${WIKI}/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&action=raw`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status} for raw "${title}"`)
  const text = await res.text()
  return text.length ? text : null
}

export async function rawJson<T>(title: string): Promise<T | null> {
  const text = await rawPage(title)
  return text ? (JSON.parse(text) as T) : null
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Wikitext for many pages, 50 per request, following redirects.
 * Keyed by the title as requested (not the redirect target).
 */
export async function wikitextFor(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const batch of chunk([...new Set(titles)], 50)) {
    const json = await apiGet<{
      query?: {
        normalized?: { from: string; to: string }[]
        redirects?: { from: string; to: string }[]
        pages?: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[]
      }
    }>({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      titles: batch.join('|'),
    })
    const q = json.query ?? {}
    const byTitle = new Map<string, string>()
    for (const p of q.pages ?? []) {
      const content = p.revisions?.[0]?.slots.main.content
      if (!p.missing && content) byTitle.set(p.title, content)
    }
    const norm = new Map((q.normalized ?? []).map((n) => [n.from, n.to]))
    const redir = new Map((q.redirects ?? []).map((r) => [r.from, r.to]))
    for (const requested of batch) {
      let t = norm.get(requested) ?? requested
      t = redir.get(t) ?? t
      const content = byTitle.get(t)
      if (content) out.set(requested, content)
    }
  }
  return out
}

/** Direct URLs for `File:` pages, optionally scaled to `width`. Keyed by file name without the prefix. */
export async function fileUrls(files: string[], width?: number): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const batch of chunk([...new Set(files)], 50)) {
    const json = await apiGet<{
      query?: {
        normalized?: { from: string; to: string }[]
        pages?: { title: string; imageinfo?: { url: string; thumburl?: string }[] }[]
      }
    }>({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url',
      ...(width ? { iiurlwidth: String(width) } : {}),
      titles: batch.map((f) => `File:${f}`).join('|'),
    })
    const norm = new Map((json.query?.normalized ?? []).map((n) => [n.from, n.to]))
    const byTitle = new Map(
      (json.query?.pages ?? []).map((p) => [p.title, p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url]),
    )
    for (const f of batch) {
      const url = byTitle.get(norm.get(`File:${f}`) ?? `File:${f}`)
      if (url) out.set(f, url)
    }
  }
  return out
}

export async function download(url: string, dest: string): Promise<boolean> {
  const res = await throttledFetch(url)
  if (!res.ok) return false
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  return true
}

/** The `{{infobox …}}` block's `| key = value` fields, with wiki markup stripped. */
export function infoboxFields(wikitext: string, kind: string): Record<string, string> | null {
  const start = wikitext.search(new RegExp(`\\{\\{\\s*infobox ${kind}\\b`, 'i'))
  if (start < 0) return null
  // Walk braces to find the matching close; infobox values can contain templates.
  let depth = 0
  let end = start
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i++ }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') { depth--; i++; if (depth === 0) { end = i + 1; break } }
  }
  const fields: Record<string, string> = {}
  for (const part of topLevelParams(wikitext.slice(start + 2, end - 2))) {
    const m = part.match(/^\s*([\w-]+)\s*=([\s\S]*)$/)
    if (m) fields[m[1].toLowerCase()] = stripMarkup(m[2])
  }
  return fields
}

/** A template body split on the `|` that separate its parameters, not ones inside links or nested templates. */
function topLevelParams(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2)
    if (two === '{{' || two === '[[') { depth++; current += two; i++; continue }
    if (two === '}}' || two === ']]') { depth--; current += two; i++; continue }
    if (body[i] === '|' && depth === 0) { parts.push(current); current = ''; continue }
    current += body[i]
  }
  parts.push(current)
  return parts.slice(1)
}

/** The raw (markup intact) value of one infobox field. */
export function rawField(wikitext: string, key: string): string | null {
  const start = wikitext.search(/\{\{\s*infobox/i)
  if (start < 0) return null
  for (const part of topLevelParams(wikitext.slice(start + 2))) {
    const m = part.match(/^\s*([\w-]+)\s*=([\s\S]*)$/)
    if (m && m[1].toLowerCase() === key) return m[2].split(/\n\}\}/)[0].trim()
  }
  return null
}

export function stripMarkup(s: string): string {
  return s
    .replace(/<ref[^>]*\/>|<ref[^>]*>.*?<\/ref>/g, '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{ItemLink\|([^|}]*)(?:\|[^}]*)?\}\}/gi, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/'''?/g, '')
    .replace(/&shy;|&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const num = (s: string | undefined): number | null => {
  if (!s) return null
  const n = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}
