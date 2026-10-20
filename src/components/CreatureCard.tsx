'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { IconMars, IconVenus, IconDna, IconStar, IconSeedling } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { PawPrint, Crown, Check } from 'lucide-react'
import { ColorSwatches } from './ColorSwatch'
import { CreatureColorRender } from './CreatureColorRender'
import { LevelCell } from './breeding/LevelCell'
import type { StoredCreature } from '@/lib/db'
import type { AseStatKey } from '@/lib/ark-stat-solver/ase-data'
import { topFlags, type CollectionBests, type CreatureProfile } from '@/lib/breeding'
import { STAT_META } from '@/lib/stat-meta'
import { creatureImageUrl, speciesDisplayName } from '@/lib/dino-map'

export type ImageMode = 'dossier' | 'colors'

interface CreatureCardProps {
  creature: StoredCreature
  imageMode?: ImageMode
  /**
   * Wiki species name (e.g. "Achatina"). Required when `imageMode='colors'` —
   * passed to CreatureColorRender for the upstream-name fallback.
   * Caller resolves this from the creatures API.
   */
  speciesName?: string | null
  /** Solved points; while loading the card shows no stat rows. */
  profile?: CreatureProfile | null
  /** Best points per stat across this species in the collection. */
  bests?: CollectionBests | null
  /**
   * Select mode: when present the card toggles selection instead of opening the
   * creature page.
   */
  selection?: { selected: boolean; onToggle: () => void }
}

/** Stats players usually compare first; others the species can inherit follow. */
const PREFERRED_STATS: AseStatKey[] = ['health', 'stamina', 'weight', 'meleeDamage', 'food', 'oxygen', 'craftingSkill']

export function CreatureCard({ creature, imageMode = 'dossier', speciesName = null, profile = null, bests = null, selection }: CreatureCardProps) {
  // Some species map to a slug without dossier art; show the placeholder instead of a broken image.
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = creatureImageUrl(creature.apiSlug)
  const mutations = creature.mutationsMale + creature.mutationsFemale
  const isFullyGrown = creature.babyAge >= 1
  const imprintPct = Math.round(creature.imprintQuality * 100)
  // Proper species name ("Pyromane"), falling back to the export tag for unknown species.
  const speciesTag = speciesDisplayName(creature.apiSlug) ?? creature.dinoNameTag.replace(/AA$/, '')

  const shownStats = profile ? PREFERRED_STATS.filter((s) => profile.eligible.includes(s)).slice(0, 4) : []
  const records = profile ? profile.eligible.filter((s) => topFlags(profile.levels[s], bests?.[s]).total).length : 0

  const cardClass = `group bg-card relative flex h-full flex-col overflow-hidden rounded-xl text-left transition-shadow ${
    selection?.selected ? 'ring-primary ring-2' : 'ring-border hover:ring-primary/70 ring-1'
  }`
  const body = (
    <>
      <div className="bg-plate relative aspect-[3/2] overflow-hidden">
        {imageMode === 'colors' ? (
          // Fitted and centered in the plate; falls back to the dossier when no render exists.
          <CreatureColorRender
            speciesName={speciesName}
            slug={creature.apiSlug}
            colors={creature.colors}
            className="absolute inset-0"
            fallbackSrc={imageUrl}
          />
        ) : imageUrl && !imageFailed ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            onError={() => setImageFailed(true)}
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, 240px"
          />
        ) : (
          <PawPrint aria-hidden className="absolute inset-0 m-auto size-10 text-white/15" strokeWidth={1.5} />
        )}
        <span
          className={`absolute top-2 right-2 rounded-full p-1 ${creature.isFemale ? 'bg-pink-500' : 'bg-blue-500'}`}
          title={creature.isFemale ? 'Female' : 'Male'}
        >
          {creature.isFemale ? <IconVenus size={13} className="text-white" aria-label="Female" /> : <IconMars size={13} className="text-white" aria-label="Male" />}
        </span>
        {selection && (
          <span
            aria-hidden
            className={`absolute top-2 left-2 flex size-6 items-center justify-center rounded-md border-2 ${
              selection.selected ? 'border-primary bg-primary text-primary-foreground' : 'border-white/80 bg-black/40'
            }`}
          >
            {selection.selected && <Check className="size-4" strokeWidth={3} />}
          </span>
        )}
        {!isFullyGrown && (
          <span className={`absolute top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-black ${selection ? 'left-10' : 'left-2'}`}>
            <IconSeedling size={12} aria-hidden /> Baby
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display group-hover:text-primary truncate text-lg leading-tight transition-colors">
              {creature.name || creature.dinoNameTag}
            </p>
            <p className="text-muted-foreground truncate text-sm">
              {creature.apiSlug && !selection ? (
                <Link
                  href={`/creatures/${creature.apiSlug}`}
                  className="hover:text-foreground relative z-20 underline-offset-2 hover:underline"
                  title={`View ${speciesTag} species page`}
                >
                  {speciesTag}
                </Link>
              ) : speciesTag}
            </p>
          </div>
          <span className="bg-secondary shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums" title="Level">
            Lv {creature.level}
          </span>
        </div>

        {/* Above the card link (z-20) so tooltips work; under the select overlay in select mode. */}
        <div className={selection ? 'w-fit' : 'relative z-20 w-fit'}>
          <ColorSwatches colors={creature.colors} />
        </div>

        {(mutations > 0 || imprintPct > 0 || creature.isNeutered) && (
          <div className="flex flex-wrap gap-1.5">
            {mutations > 0 && (
              <Badge variant="outline" className="gap-1 border-violet-400/50 text-violet-700 dark:text-violet-300">
                <IconDna size={11} aria-hidden />{mutations} {mutations === 1 ? 'mutation' : 'mutations'}
              </Badge>
            )}
            {imprintPct > 0 && (
              <Badge variant="outline" className="gap-1 border-sky-400/50 text-sky-700 dark:text-sky-300">
                <IconStar size={11} aria-hidden />{imprintPct}% imprint
              </Badge>
            )}
            {creature.isNeutered && (
              <Badge variant="outline" className="text-muted-foreground">Neutered</Badge>
            )}
          </div>
        )}

        {profile && shownStats.length > 0 && (
          <div className="space-y-1.5">
            {shownStats.map((stat) => {
              const lv = profile.levels[stat]
              const best = bests?.[stat]
              const top = topFlags(lv, best)
              const pct = lv && best?.total ? Math.min(100, (lv.total / best.total) * 100) : 0
              return (
                <div key={stat} className="flex items-center gap-2 text-[13px]">
                  <span className={`w-14 shrink-0 ${top.total ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                    {STAT_META[stat].label}
                  </span>
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full" aria-hidden>
                    <div className={`h-full rounded-full ${STAT_META[stat].dot}`} style={{ width: `${pct}%` }} />
                  </div>
                  <LevelCell levels={lv} top={top} className="w-14 shrink-0 text-right" />
                </div>
              )
            })}
          </div>
        )}
        {records > 0 && (
          <p className="text-primary inline-flex items-center gap-1 text-xs font-semibold">
            <Crown aria-hidden className="size-3.5" /> Best in {records} {records === 1 ? 'stat' : 'stats'} you own
          </p>
        )}

        <p className="text-muted-foreground border-border mt-auto border-t pt-2.5 text-xs" title={new Date(creature.importedAt).toLocaleString()}>
          Imported {new Date(creature.importedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </>
  )

  if (selection) {
    // A full-card toggle laid over the content: the swatches' tooltip triggers are
    // buttons, so the card itself can't be one.
    return (
      <div className={cardClass}>
        {body}
        <button
          type="button"
          aria-pressed={selection.selected}
          aria-label={`Select ${creature.name || creature.dinoNameTag}`}
          onClick={selection.onToggle}
          className="focus-visible:ring-ring absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
    )
  }
  // Stretched link: one overlay link opens the creature, while the species link and
  // swatch tooltips sit above it (z-20), so nothing interactive is nested in an <a>.
  return (
    <div className={cardClass}>
      {body}
      <Link
        href={`/my-creatures/${creature.id}`}
        aria-label={`${creature.name || creature.dinoNameTag}, level ${creature.level}`}
        className="focus-visible:ring-ring absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      />
    </div>
  )
}
