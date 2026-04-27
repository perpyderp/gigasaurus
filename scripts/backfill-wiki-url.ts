#!/usr/bin/env bun
/**
 * One-shot backfill: add `wiki_url` to every creature JSON whose schema
 * was extended with that field. Derives the URL from the creature's `name`
 * using ARK wiki's standard "spaces → underscores, percent-encode" scheme.
 *
 * Usage:  bun scripts/backfill-wiki-url.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const WIKI = 'https://ark.wiki.gg'
const DIR = join(import.meta.dir, '..', 'data', 'creatures')

function wikiUrlFromName(name: string): string {
  return `${WIKI}/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`
}

let updated = 0
let skipped = 0
let errors = 0

for (const file of readdirSync(DIR)) {
  if (!file.endsWith('.json')) continue
  const path = join(DIR, file)
  let json: Record<string, unknown>
  try {
    json = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON (${e})`)
    errors++
    continue
  }

  if (typeof json.name !== 'string' || !json.name) {
    console.error(`✗ ${file}: missing name`)
    errors++
    continue
  }

  const url = wikiUrlFromName(json.name)
  if (json.wiki_url === url) {
    skipped++
    continue
  }
  json.wiki_url = url
  writeFileSync(path, JSON.stringify(json, null, 4) + '\n')
  updated++
}

console.log(`\nDone — updated: ${updated}, already-correct: ${skipped}, errors: ${errors}`)
