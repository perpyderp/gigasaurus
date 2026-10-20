/**
 * The saddles a creature can wear, with their icons, engram level, armor and
 * crafting cost. Server component; the recipe uses <details> so it opens
 * without client JS.
 */

import Image from 'next/image'
import { ExternalLink, Shield } from 'lucide-react'
import type { SaddleDetail } from '@/schemas/saddle'

function unlock(s: SaddleDetail) {
  if (s.tek) return 'Tekgram'
  if (s.engram_level != null) return `Unlocks at level ${s.engram_level}`
  return 'No engram'
}

export function CreatureSaddles({ saddles }: { saddles: SaddleDetail[] }) {
  return (
    <ul className="divide-border -my-2 divide-y">
      {saddles.map((s) => {
        const kind = [s.platform && 'Platform', s.tek && 'Tek'].filter(Boolean).join(', ')
        return (
          <li key={s.slug} className="py-3">
            <div className="flex items-center gap-3">
              <div className="slot relative size-14 shrink-0 rounded-lg">
                {s.image ? (
                  <Image src={s.image} alt="" fill sizes="56px" className="object-contain p-1.5 drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]" />
                ) : (
                  <Shield aria-hidden className="text-muted-foreground/40 absolute inset-0 m-auto size-6" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="leading-snug font-semibold">
                  {s.name}
                  {kind && <span className="text-muted-foreground ml-2 text-xs font-medium">{kind}</span>}
                </p>
                <p className="text-muted-foreground text-sm">
                  {unlock(s)}
                  {s.armor != null && <>, {s.armor} armor</>}
                </p>
              </div>
            </div>

            {s.ingredients.length > 0 && (
              <details className="group mt-2 ml-[4.25rem] text-sm">
                <summary className="text-primary w-fit cursor-pointer font-medium underline-offset-4 hover:underline">
                  Crafting cost
                </summary>
                <dl className="mt-2 space-y-1">
                  {s.ingredients.map((ing) => (
                    <div key={ing.name} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">{ing.name}</dt>
                      <dd className="font-semibold tabular-nums">{ing.quantity.toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
                {s.crafted_in.length > 0 && (
                  <p className="text-muted-foreground mt-2">Crafted in {s.crafted_in.join(', ')}</p>
                )}
                <a
                  href={s.wiki_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink aria-hidden className="size-3.5" /> On the ARK Wiki
                </a>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
