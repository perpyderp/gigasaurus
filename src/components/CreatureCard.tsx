'use client'

import Link from 'next/link'
import Image from 'next/image'
import { IconMars, IconVenus, IconDna, IconStar, IconSeedling } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ColorSwatches } from './ColorSwatch'
import type { StoredCreature } from '@/lib/db'
import {
  STAT_CONFIG,
  RELEVANT_STATS,
  STAT_MAXES,
  estimateStatPoints,
  getStatTopPercent,
} from '@/lib/stat-calc'

interface CreatureCardProps {
  creature: StoredCreature
}

const TOP_STATS: Array<typeof RELEVANT_STATS[number]> = ['health', 'stamina', 'meleeDamage', 'weight']

export function CreatureCard({ creature }: CreatureCardProps) {
  const imageUrl = creature.apiSlug ? `/images/creatures/${creature.apiSlug}.png` : null
  const mutations = creature.mutationsMale + creature.mutationsFemale
  const isFullyGrown = creature.babyAge >= 1
  const meleePct = Math.round(creature.stats.meleeDamage * 100)
  const imprintPct = Math.round(creature.imprintQuality * 100)
  const points = estimateStatPoints(creature.stats, creature.level)

  let bestStat: typeof RELEVANT_STATS[number] = RELEVANT_STATS[0]
  let bestRatio = 0
  for (const s of RELEVANT_STATS) {
    const r = creature.stats[s] / STAT_MAXES[s]
    if (r > bestRatio) { bestRatio = r; bestStat = s }
  }

  return (
    <Link href={`/my-creatures/${creature.id}`} className="block">
      <Card className="hover:border-primary/50 overflow-hidden gap-0 py-0 transition-colors h-full">
        <div className="bg-muted relative flex h-28 items-center justify-center">
          {imageUrl ? (
            <Image src={imageUrl} alt={creature.name} fill className="object-contain p-2" sizes="(max-width: 640px) 50vw, 200px" />
          ) : (
            <span className="text-4xl opacity-30">🦕</span>
          )}
          <div className={`absolute top-2 right-2 rounded-full p-1 ${creature.isFemale ? 'bg-pink-500/80' : 'bg-blue-500/80'}`}>
            {creature.isFemale ? <IconVenus size={12} className="text-white" /> : <IconMars size={12} className="text-white" />}
          </div>
          {!isFullyGrown && (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-500/80 px-1.5 py-0.5">
              <IconSeedling size={10} className="text-white" />
              <span className="text-white text-xs">Baby</span>
            </div>
          )}
        </div>

        <CardContent className="p-3 space-y-2">
          <div>
            <p className="text-foreground truncate text-sm font-semibold">{creature.name || creature.dinoNameTag}</p>
            <p className="text-muted-foreground truncate text-xs">{creature.dinoNameTag.replace(/AA$/, '')} · Lv {creature.level}</p>
          </div>

          <ColorSwatches colors={creature.colors} />

          <div className="flex flex-wrap gap-1">
            {mutations > 0 && (
              <Badge variant="outline" className="gap-1 px-1.5 py-0 text-xs text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-950/30">
                <IconDna size={10} />{mutations}
              </Badge>
            )}
            {imprintPct > 0 && (
              <Badge variant="outline" className="gap-1 px-1.5 py-0 text-xs text-sky-600 border-sky-300 bg-sky-50 dark:bg-sky-950/30">
                <IconStar size={10} />{imprintPct}%
              </Badge>
            )}
            {creature.isNeutered && (
              <Badge variant="outline" className="px-1.5 py-0 text-xs text-muted-foreground">Neutered</Badge>
            )}
          </div>

          <div className="space-y-1">
            {TOP_STATS.map((stat) => {
              const value = creature.stats[stat]
              const max = STAT_MAXES[stat]
              const pct = Math.min(100, Math.round((value / max) * 100))
              const statPts = points[stat]
              const cfg = STAT_CONFIG[stat]
              const isBest = stat === bestStat
              const topPct = isBest ? getStatTopPercent(stat, value) : null
              return (
                <div key={stat} className="flex items-center gap-1.5">
                  <span className={`w-12 shrink-0 text-xs ${isBest ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {cfg.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.ringColor.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-7 shrink-0 text-right font-mono text-xs text-muted-foreground">{statPts}pt</span>
                  {topPct && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0 w-14 text-right">{topPct}</span>}
                </div>
              )
            })}
          </div>

          <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
            <span>{meleePct}% melee</span>
            <span>{new Date(creature.importedAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
