/**
 * Shrink oversized PNG/JPEG images in public/ to WebP, replacing the originals.
 *
 *   bun scripts/optimize-images.ts                 # creature dossiers + home hero
 *   bun scripts/optimize-images.ts --dry-run       # report savings only
 *
 * GIFs are left alone (some are animated). Files already WebP are skipped.
 */

import { existsSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { toWebp } from './lib/optimize-image'

const ROOT = join(import.meta.dir, '..')
const dryRun = process.argv.includes('--dry-run')

// [file or directory, max width]
const TARGETS: [string, number][] = [
  [join(ROOT, 'public', 'images', 'creatures'), 1600],
  // Full-bleed home hero: 2560 covers 1280-wide screens at 2×.
  [join(ROOT, 'public', 'images', 'ARKniversary.png'), 2560],
]

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`
let before = 0
let after = 0

for (const [target, maxWidth] of TARGETS) {
  if (!existsSync(target)) continue // already converted
  const files = statSync(target).isDirectory()
    ? readdirSync(target).filter((f) => /\.(png|jpe?g)$/i.test(f)).map((f) => join(target, f))
    : [target]
  for (const file of files) {
    const out = await toWebp(file, maxWidth)
    const size = statSync(file).size
    before += size
    after += out.length
    if (!dryRun) {
      writeFileSync(file.replace(/\.(png|jpe?g)$/i, '.webp'), out)
      unlinkSync(file)
    }
  }
  console.log(`${target.replace(ROOT, '.')}: ${files.length} file(s)`)
}

console.log(`${dryRun ? 'Would shrink' : 'Shrank'} ${mb(before)} → ${mb(after)}`)
