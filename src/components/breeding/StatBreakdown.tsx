'use client'

import { ArrowDown, ArrowUp, Crown, Dna } from 'lucide-react'
import { useMemo } from 'react'
import { ASE_STAT_KEYS, type AseStatKey } from '@/lib/ark-stat-solver/ase-data'
import { buildStatParamsFromAse, forwardTamedValue } from '@/lib/ark-stat-solver/extractor'
import { topFlags, type CollectionBests, type CreatureProfile } from '@/lib/breeding'
import { STAT_META, formatInGame } from '@/lib/stat-meta'

function Inheritance({ profile, stat }: { profile: CreatureProfile; stat: AseStatKey }) {
  const inh = profile.inheritance?.[stat]
  if (!inh) return null
  return (
    <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs font-normal">
      {inh.roll === 'high' && (
        <span className="inline-flex items-center gap-0.5"><ArrowUp aria-hidden className="size-3" /> Got the higher roll</span>
      )}
      {inh.roll === 'low' && (
        <span className="inline-flex items-center gap-0.5"><ArrowDown aria-hidden className="size-3" /> Got the lower roll</span>
      )}
      {inh.newMutations > 0 && (
        <span className="inline-flex items-center gap-0.5 font-medium text-violet-700 dark:text-violet-300">
          <Dna aria-hidden className="size-3" /> {inh.newMutations} new {inh.newMutations === 1 ? 'mutation' : 'mutations'}
        </span>
      )}
    </span>
  )
}

/**
 * Per-stat points table: in-game value, wild / mutated / tamed points, the value
 * a baby with these points would have, and the gap to the best you own.
 */
export function StatBreakdown({ profile, bests }: { profile: CreatureProfile; bests: CollectionBests | null }) {
  const species = profile.species
  // Bred, 100% TE, no imprint, no player levels: what these inheritable points are worth on a baby.
  const babyParams = useMemo(() => (species ? buildStatParamsFromAse(species, 0) : null), [species])
  if (!species || !babyParams) return null

  const rows = ASE_STAT_KEYS.filter((k) => k !== 'torpidity' && profile.levels[k])
  const maxTotal = Math.max(1, ...rows.map((k) => bests?.[k]?.total ?? profile.levels[k]!.total))

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[680px] text-[15px]">
        <caption className="sr-only">Stat points</caption>
        <thead>
          <tr className="text-muted-foreground border-border border-b text-left text-sm">
            <th scope="col" className="px-1 pb-2 font-medium">Stat</th>
            <th scope="col" className="px-1 pb-2 text-right font-medium">In game</th>
            <th scope="col" className="px-1 pb-2 text-right font-medium" title="Points from the wild and from taming effectiveness — inherited">Wild</th>
            <th scope="col" className="px-1 pb-2 text-right font-medium text-violet-700 dark:text-violet-300" title="Points from mutations, 2 per mutation — inherited">Mutated</th>
            <th scope="col" className="px-1 pb-2 text-right font-medium" title="Points you assigned when leveling up — not inherited">Tamed</th>
            <th scope="col" className="px-1 pb-2 text-right font-medium" title="Value a baby with these wild and mutated points has, before imprinting and player levels">As a baby</th>
            <th scope="col" className="w-40 px-1 pb-2 pl-4 font-medium">Vs. your best</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((key) => {
            const lv = profile.levels[key]!
            const p = babyParams[ASE_STAT_KEYS.indexOf(key)]
            const eligible = profile.eligible.includes(key)
            const best = bests?.[key]
            const top = topFlags(lv, best)
            const meta = STAT_META[key]
            const value = profile.creature.stats[key]
            const gap = best?.total != null ? best.total - lv.total : null
            return (
              <tr key={key} className="align-top">
                <th scope="row" className="px-1 py-2.5 text-left font-medium">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${meta.dot}`} />
                    <span className="flex flex-col gap-0.5">
                      {meta.label}
                      <Inheritance profile={profile} stat={key} />
                    </span>
                  </span>
                </th>
                <td className="px-1 py-2.5 text-right font-semibold tabular-nums">{formatInGame(key, value)}</td>
                <td className="px-1 py-2.5 text-right tabular-nums">
                  {eligible ? (
                    <span className={top.wild ? 'text-primary font-semibold' : ''}>
                      {lv.wild}
                      {lv.mutated === null && <span className="text-muted-foreground" title="Includes mutated points — import the parents to split them">*</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground" title="This stat can't get wild points in ASA">—</span>
                  )}
                </td>
                <td className="px-1 py-2.5 text-right tabular-nums text-violet-700 dark:text-violet-300">
                  {!eligible ? (
                    <span className="text-muted-foreground">—</span>
                  ) : lv.mutated === null ? (
                    <span className="text-muted-foreground" title="Unknown — import this creature's parents">?</span>
                  ) : lv.mutated > 0 ? (
                    <span className={top.mutated ? 'rounded bg-violet-500/15 px-1 font-semibold' : ''}>
                      {lv.mutated}
                      <span className="text-muted-foreground ml-1 text-xs">({lv.mutated / 2}×)</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="text-muted-foreground px-1 py-2.5 text-right tabular-nums">{lv.dom > 0 ? lv.dom : '0'}</td>
                <td className="text-muted-foreground px-1 py-2.5 text-right tabular-nums">
                  {p ? formatInGame(key, forwardTamedValue(p, lv.total, 0, 1)) : '—'}
                </td>
                <td className="px-1 py-2.5 pl-4">
                  {eligible && best?.total != null ? (
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full" aria-hidden>
                        <div className={`h-full rounded-full ${meta.dot}`} style={{ width: `${Math.min(100, (lv.total / maxTotal) * 100)}%` }} />
                      </div>
                      {top.total ? (
                        <span className="text-primary inline-flex w-14 items-center justify-end gap-1 text-xs font-semibold">
                          <Crown aria-hidden className="size-3.5" /> Best
                        </span>
                      ) : (
                        <span className="text-muted-foreground w-14 text-right text-xs tabular-nums" title={`Your best has ${best.total} points`}>
                          {gap != null && gap > 0 ? `−${gap}` : '—'}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not inherited</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
