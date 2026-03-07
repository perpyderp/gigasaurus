'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  IconArrowLeft,
  IconPencil,
  IconX,
  IconRefresh,
  IconTrash,
  IconMars,
  IconVenus,
  IconDna,
  IconStar,
  IconSeedling,
} from '@tabler/icons-react'
import { getCreature, upsertCreature, deleteCreature } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { ColorSwatches } from '@/components/ColorSwatch'
import { StatBar } from '@/components/StatBar'
import { ImportDropzone } from '@/components/ImportDropzone'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  STAT_CONFIG,
  RELEVANT_STATS,
  STAT_MAXES,
  formatStatValue,
  estimateStatPoints,
  getStatTopPercent,
} from '@/lib/stat-calc'

export default function CreatureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [creature, setCreature] = useState<StoredCreature | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showReimport, setShowReimport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    const c = await getCreature(id)
    setCreature(c ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const handleSaveName = async () => {
    if (!creature) return
    const updated: StoredCreature = { ...creature, name: nameInput.trim() || creature.name, updatedAt: Date.now() }
    await upsertCreature(updated)
    setCreature(updated)
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteCreature(id)
    router.push('/my-creatures')
  }

  const handleReimported = useCallback(async () => {
    await load()
    setShowReimport(false)
  }, [load])

  if (loading) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    )
  }

  if (!creature) {
    return (
      <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Creature not found.</p>
        <Link href="/my-creatures" className="text-primary text-sm hover:underline">← Back</Link>
      </main>
    )
  }

  const imageUrl = creature.apiSlug ? `/images/creatures/${creature.apiSlug}.png` : null
  const mutations = creature.mutationsMale + creature.mutationsFemale
  const isFullyGrown = creature.babyAge >= 1
  const babyPct = Math.round(creature.babyAge * 100)
  const imprintPct = Math.round(creature.imprintQuality * 100)
  const points = estimateStatPoints(creature.stats, creature.level)

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">

        <Link href="/my-creatures" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors">
          <IconArrowLeft size={14} />
          My Creatures
        </Link>

        {/* Hero */}
        <Card>
          <CardContent className="flex gap-4 p-5">
            <div className="bg-muted relative h-32 w-32 shrink-0 overflow-hidden rounded-lg">
              {imageUrl ? (
                <Image src={imageUrl} alt={creature.name} fill className="object-contain p-2" sizes="128px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl opacity-30">🦕</div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              {editing ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false) }}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={handleSaveName}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><IconX size={14} /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-2xl font-bold">{creature.name || creature.dinoNameTag}</h1>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 w-7 shrink-0 p-0"
                    onClick={() => { setNameInput(creature.name); setEditing(true) }}
                  >
                    <IconPencil size={14} />
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{creature.dinoNameTag.replace(/AA$/, '')}</Badge>
                <Badge variant="secondary">Lv {creature.level}</Badge>

                {/* Gender with color */}
                <Badge className={`gap-1 ${creature.isFemale ? 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950/40 dark:text-pink-300' : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300'}`} variant="outline">
                  {creature.isFemale ? <IconVenus size={11} /> : <IconMars size={11} />}
                  {creature.isFemale ? 'Female' : 'Male'}
                </Badge>

                {creature.isNeutered && <Badge variant="outline">Neutered</Badge>}
                {mutations > 0 && (
                  <Badge variant="outline" className="gap-1 text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-950/30">
                    <IconDna size={11} />{mutations} mut
                  </Badge>
                )}
                {!isFullyGrown && (
                  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                    <IconSeedling size={11} />Baby {babyPct}%
                  </Badge>
                )}
                {imprintPct > 0 && (
                  <Badge variant="outline" className="gap-1 text-sky-600 border-sky-300 bg-sky-50 dark:bg-sky-950/30">
                    <IconStar size={11} />{imprintPct}% imprint
                  </Badge>
                )}
              </div>

              <ColorSwatches colors={creature.colors} />

              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {creature.tamer && <span>Tamed by {creature.tamer}</span>}
                {creature.imprinter && <span>Imprinted by {creature.imprinter}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Max Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {RELEVANT_STATS.map((stat) => {
              const cfg = STAT_CONFIG[stat]
              const value = creature.stats[stat]
              const display = formatStatValue(stat, value)
              const statPts = points[stat]
              const topPct = getStatTopPercent(stat, value)
              return (
                <StatBar
                  key={stat}
                  label={cfg.label}
                  value={value}
                  display={display}
                  max={STAT_MAXES[stat]}
                  color={cfg.ringColor}
                  points={statPts}
                  topPercent={topPct !== 'common' ? topPct : undefined}
                />
              )
            })}
          </CardContent>
        </Card>

        {/* Ancestry */}
        {creature.ancestors.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Ancestry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {creature.ancestors.map((a, i) => (
                <div key={i} className="text-muted-foreground flex gap-4 text-xs">
                  <span className="w-4">{i + 1}</span>
                  <span className="flex items-center gap-1"><IconMars size={10} className="text-blue-500" /> {a.maleName || `${a.maleDinoId1}_${a.maleDinoId2}`}</span>
                  <span>×</span>
                  <span className="flex items-center gap-1"><IconVenus size={10} className="text-pink-500" /> {a.femaleName || `${a.femaleDinoId1}_${a.femaleDinoId2}`}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* API cross-link */}
        {creature.apiSlug && (
          <Card>
            <CardContent className="p-5">
              <p className="text-muted-foreground text-sm">
                Species data:{' '}
                <Link href={`/api/creatures/${creature.apiSlug}`} className="text-primary font-medium hover:underline" target="_blank">
                  /api/creatures/{creature.apiSlug} →
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Re-import panel */}
        {showReimport && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Re-import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-xs">Drop an updated export for this creature to refresh its stats.</p>
              <ImportDropzone onImported={handleReimported} />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => setShowReimport((v) => !v)} className="gap-2">
            <IconRefresh size={14} />
            Re-import
          </Button>
          <Button
            variant={confirmDelete ? 'destructive' : 'outline'}
            className={confirmDelete ? 'gap-2' : 'gap-2 text-destructive border-destructive/30 hover:bg-destructive/10'}
            onClick={handleDelete}
          >
            <IconTrash size={14} />
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </Button>
        </div>

        <p className="text-muted-foreground/60 text-xs">
          ID: {creature.dinoId1}_{creature.dinoId2} ·{' '}
          Imported {new Date(creature.importedAt).toLocaleString()} ·{' '}
          Updated {new Date(creature.updatedAt).toLocaleString()}
        </p>
      </div>
    </main>
  )
}
