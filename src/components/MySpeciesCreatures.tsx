'use client'

/**
 * On a species page (/creatures/[slug]), lists the user's own imported creatures
 * of that species (read from IndexedDB) with links to each creature's page.
 * Renders nothing until loaded, and a subtle empty hint if the user owns none.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IconMars, IconVenus, IconDna, IconStar } from '@tabler/icons-react'
import { getCreaturesBySlug } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function MySpeciesCreatures({ slug }: { slug: string }) {
  const [creatures, setCreatures] = useState<StoredCreature[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getCreaturesBySlug(slug)
      .then((list) => {
        if (cancelled) return
        setCreatures(list.sort((a, b) => b.level - a.level))
      })
      .catch(() => { if (!cancelled) setCreatures([]) })
    return () => { cancelled = true }
  }, [slug])

  // Still loading, or the user has no creatures of this species — render nothing.
  if (!creatures || creatures.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-xl">
          Your {creatures.length === 1 ? 'tame' : `${creatures.length} tames`}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {creatures.map((c) => {
          const mutations = c.mutationsMale + c.mutationsFemale
          const imprintPct = Math.round(c.imprintQuality * 100)
          return (
            <Link
              key={c.id}
              href={`/my-creatures/${c.id}`}
              className="hover:border-primary/60 hover:bg-accent/40 flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <div className={`rounded-full p-1 ${c.isFemale ? 'bg-pink-500/15 text-pink-500' : 'bg-blue-500/15 text-blue-500'}`}>
                {c.isFemale ? <IconVenus size={13} /> : <IconMars size={13} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{c.name || c.dinoNameTag}</p>
                <p className="text-muted-foreground flex gap-3 text-sm">
                  <span className="text-foreground font-semibold tabular-nums">Lv {c.level}</span>
                  {c.tribe && <span className="truncate">{c.tribe}</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {mutations > 0 && (
                  <Badge variant="outline" className="gap-1 border-violet-400/50 text-violet-700 dark:text-violet-300">
                    <IconDna size={9} />{mutations}
                  </Badge>
                )}
                {imprintPct > 0 && (
                  <Badge variant="outline" className="gap-1 border-sky-400/50 text-sky-700 dark:text-sky-300">
                    <IconStar size={9} />{imprintPct}%
                  </Badge>
                )}
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
