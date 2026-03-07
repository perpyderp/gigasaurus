'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ColorSwatch } from './ColorSwatch'
import type { StoredCreature } from '@/lib/db'

interface CreatureCardProps {
  creature: StoredCreature
}

export function CreatureCard({ creature }: CreatureCardProps) {
  const imageUrl = creature.apiSlug ? `/images/creatures/${creature.apiSlug}.png` : null
  const meleePct = Math.round(creature.stats.meleeDamage * 100)
  const mutations = creature.mutationsMale + creature.mutationsFemale
  const isFullyGrown = creature.babyAge >= 1

  return (
    <Link
      href={`/my-creatures/${creature.id}`}
      className="group block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors overflow-hidden"
    >
      {/* Image */}
      <div className="relative h-32 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={creature.name}
            fill
            className="object-contain p-2"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        ) : (
          <span className="text-4xl opacity-30">🦕</span>
        )}
        {/* Sex badge */}
        <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full bg-black/40 text-white">
          {creature.isFemale ? '♀' : '♂'}
        </span>
        {/* Baby indicator */}
        {!isFullyGrown && (
          <span className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/80 text-white">
            Baby
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">
            {creature.name || creature.dinoNameTag}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {creature.dinoNameTag.replace(/AA$/, '')} · Lv {creature.level}
          </p>
        </div>

        <ColorSwatch colors={creature.colors} />

        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          {mutations > 0 && (
            <span className="text-violet-500 font-medium">{mutations} mut</span>
          )}
          <span>{meleePct}% melee</span>
          {creature.imprintQuality > 0 && (
            <span className="text-sky-500">{Math.round(creature.imprintQuality * 100)}% imp</span>
          )}
        </div>
      </div>
    </Link>
  )
}
