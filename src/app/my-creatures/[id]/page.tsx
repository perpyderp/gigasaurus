'use client'

import { use, useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  IconArrowLeft,
  IconPencil,
  IconX,
  IconTrash,
  IconMars,
  IconVenus,
  IconDna,
  IconStar,
  IconSeedling,
  IconHeart,
} from '@tabler/icons-react'
import { PawPrint, GitFork } from 'lucide-react'
import { upsertCreature, deleteCreature, getAllCreatures } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { ColorSwatches } from '@/components/ColorSwatch'
import { CreatureColorRender } from '@/components/CreatureColorRender'
import { StatBreakdown } from '@/components/breeding/StatBreakdown'
import { LevelSummary } from '@/components/breeding/LevelSummary'
import { CreatureReimportButton } from '@/components/CreatureReimportButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { combineArkId } from '@/lib/ark-id'
import { computeBests } from '@/lib/breeding'
import { speciesGroupKey, useCreatureProfiles } from '@/hooks/use-creature-profiles'

function AncestorNode({ name, id1, id2, female, prominent = false, imported = false }: {
  name: string
  id1: number
  id2: number
  female: boolean
  prominent?: boolean
  /** The ancestor is in this browser's collection — link to it. */
  imported?: boolean
}) {
  // Exports store ancestor names as "Name - Lvl 210".
  const match = name.match(/^(.*?) - Lvl (\d+)$/)
  const label = (match ? match[1] : name) || `${id1}_${id2}`
  const level = match?.[2]
  const Wrapper = imported ? Link : 'div'
  return (
    <Wrapper
      href={`/my-creatures/${combineArkId(id1, id2)}`}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-md p-1 ${imported ? 'hover:bg-accent/60' : ''} ${prominent ? 'max-w-[160px]' : 'max-w-[120px]'}`}
    >
      <span className={`rounded-full p-1 ${female ? 'bg-pink-500/20 text-pink-500' : 'bg-blue-500/20 text-blue-500'}`}>
        {female ? <IconVenus size={prominent ? 14 : 12} aria-label="Female" /> : <IconMars size={prominent ? 14 : 12} aria-label="Male" />}
      </span>
      <span className={`w-full truncate text-center ${prominent ? 'text-foreground text-sm font-semibold' : 'text-muted-foreground text-xs'}`}>
        {label}
      </span>
      {level && <span className="text-muted-foreground text-xs tabular-nums">Lv {level}</span>}
    </Wrapper>
  )
}

export default function CreatureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [collection, setCollection] = useState<StoredCreature[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isBreedable, setIsBreedable] = useState(false)
  const [editingParents, setEditingParents] = useState(false)
  const [pendingFatherId, setPendingFatherId] = useState('')
  const [pendingMotherId, setPendingMotherId] = useState('')
  const [speciesName, setSpeciesName] = useState<string | null>(null)
  const [imageTab, setImageTab] = useState<'dossier' | 'colors'>('dossier')

  // The whole collection is loaded so parents can be found to split wild from mutated points.
  useEffect(() => {
    getAllCreatures().then(setCollection).catch(() => setCollection([]))
  }, [])

  const loading = collection === null
  const creature = useMemo(() => collection?.find((c) => c.id === id) ?? null, [collection, id])
  const { profiles } = useCreatureProfiles(collection)
  const profile = profiles?.get(id) ?? null
  const sameSpecies = useMemo(
    () => (creature && collection ? collection.filter((c) => c.id !== creature.id && speciesGroupKey(c) === speciesGroupKey(creature)) : []),
    [collection, creature],
  )
  const bests = useMemo(() => {
    if (!profile || !profiles || !creature) return null
    const group = [...profiles.values()].filter((p) => speciesGroupKey(p.creature) === speciesGroupKey(creature))
    return computeBests(group, profile.eligible)
  }, [profile, profiles, creature])

  /** Replace one creature in the loaded collection after saving it. */
  const setCreature = useCallback((updated: StoredCreature) => {
    setCollection((all) => all?.map((c) => (c.id === updated.id ? updated : c)) ?? all)
  }, [])

  // Species name (for the color render) and whether it can breed at all.
  const apiSlug = creature?.apiSlug ?? null
  useEffect(() => {
    if (!apiSlug) return
    let cancelled = false
    fetch(`/api/creatures/${apiSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setIsBreedable(!!data.breedable)
        if (typeof data.name === 'string') setSpeciesName(data.name)
      })
      .catch(() => {/* name and breedability are optional */})
    return () => { cancelled = true }
  }, [apiSlug])

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

  const handleSaveParents = async () => {
    if (!creature) return
    const updated: StoredCreature = {
      ...creature,
      manualParentMaleId: pendingFatherId.trim() || null,
      manualParentFemaleId: pendingMotherId.trim() || null,
      updatedAt: Date.now(),
    }
    await upsertCreature(updated)
    setCreature(updated)
    setEditingParents(false)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10" aria-busy>
        <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="bg-card ring-border aspect-[3/2] animate-pulse rounded-xl ring-1" />
          <div className="space-y-3">
            <div className="bg-card h-12 w-2/3 animate-pulse rounded-lg" />
            <div className="bg-card h-6 w-1/3 animate-pulse rounded-lg" />
          </div>
        </div>
      </main>
    )
  }

  if (!creature) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-24 text-center">
        <p className="font-display text-3xl">Creature not found</p>
        <p className="text-muted-foreground">It may have been deleted, or it was imported in a different browser.</p>
        <Link href="/my-creatures" className="text-primary mt-2 font-medium underline-offset-4 hover:underline">Back to My Creatures</Link>
      </main>
    )
  }

  const imageUrl = creature.apiSlug ? `/images/creatures/${creature.apiSlug}.png` : null
  const mutations = creature.mutationsMale + creature.mutationsFemale
  const isFullyGrown = creature.babyAge >= 1
  const babyPct = Math.round(creature.babyAge * 100)
  const imprintPct = Math.round(creature.imprintQuality * 100)
  const arkId = combineArkId(creature.dinoId1, creature.dinoId2)

  // Parents: manual assignment, else the export's ancestry (see lib/breeding parentIds).
  const fatherId = profile?.fatherId ?? creature.manualParentMaleId
  const motherId = profile?.motherId ?? creature.manualParentFemaleId
  const fatherCreature = collection?.find((c) => c.id === fatherId)
  const motherCreature = collection?.find((c) => c.id === motherId)
  const importedIds = new Set(collection?.map((c) => c.id))

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">

        <Link href="/my-creatures" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors">
          <IconArrowLeft size={16} />
          My Creatures
        </Link>

        {/* Hero */}
        <Card>
          <CardContent className="flex flex-col gap-6 p-5 md:flex-row md:p-6">
            <div className="flex w-full flex-col gap-2 md:max-w-md">
              <div className="bg-plate relative aspect-[3/2] w-full overflow-hidden rounded-lg">
                {imageTab === 'colors' ? (
                  <CreatureColorRender
                    speciesName={speciesName}
                    slug={creature.apiSlug}
                    colors={creature.colors}
                    size={384}
                    className="h-full w-full"
                    fallbackSrc={imageUrl}
                  />
                ) : imageUrl ? (
                  <Image src={imageUrl} alt={`${speciesName ?? creature.dinoNameTag} dossier`} fill className="object-cover" sizes="(max-width: 768px) 90vw, 448px" />
                ) : (
                  <PawPrint aria-hidden className="absolute inset-0 m-auto size-14 text-white/15" strokeWidth={1.5} />
                )}
              </div>
              <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as 'dossier' | 'colors')}>
                <TabsList className="w-full">
                  <TabsTrigger value="dossier" className="flex-1">Dossier</TabsTrigger>
                  <TabsTrigger value="colors" className="flex-1" disabled={!creature.apiSlug && !speciesName}>Colors</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              {editing ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false) }}
                    aria-label="Creature name"
                    className="h-10 text-base"
                  />
                  <Button size="sm" onClick={handleSaveName}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><IconX size={14} /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-display truncate text-4xl leading-tight sm:text-5xl">{creature.name || creature.dinoNameTag}</h1>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Rename"
                    className="text-muted-foreground size-9 shrink-0 p-0"
                    onClick={() => { setNameInput(creature.name); setEditing(true) }}
                  >
                    <IconPencil size={14} />
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{creature.dinoNameTag.replace(/AA$/, '')}</Badge>
                <Badge variant="secondary">Lv {creature.level}</Badge>

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

              {/* Tribe / Owner / Imprinter — always shown */}
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Tribe</dt><dd className="truncate font-medium">{creature.tribe || '—'}</dd></div>
                <div><dt className="text-muted-foreground">Owner</dt><dd className="truncate font-medium">{creature.tamer || '—'}</dd></div>
                <div><dt className="text-muted-foreground">Imprinted by</dt><dd className="truncate font-medium">{creature.imprinter || '—'}</dd></div>
              </dl>

              {creature.apiSlug && (
                <Link
                  href={`/creatures/${creature.apiSlug}`}
                  className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  {speciesName ?? creature.dinoNameTag.replace(/AA$/, '')} species page
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats: points per stat, from the solver and lineage (lib/breeding) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="font-display text-xl">Stats and points</CardTitle>
              {creature.apiSlug && (
                <Link
                  href={`/my-creatures/breeding?species=${encodeURIComponent(speciesGroupKey(creature))}`}
                  className="text-primary inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                >
                  <GitFork aria-hidden className="size-4" /> Plan breeding
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!profiles ? (
              <div aria-busy className="bg-muted h-48 animate-pulse rounded-lg" />
            ) : profile?.species ? (
              <>
                <LevelSummary profile={profile} />
                <StatBreakdown profile={profile} bests={bests} />
                <p className="text-muted-foreground text-xs">
                  Wild and mutated points are inherited; tamed points (from leveling up) are not. Highlighted numbers are the
                  most you own for that stat across your {creature.dinoNameTag.replace(/AA$/, '')}s.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                No stat data for this species, so points can&apos;t be worked out. Modded creatures usually aren&apos;t covered.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Ancestry tree — from INI export */}
        {(creature.ancestors.length > 0 || creature.ancestorsMale.length > 0) && (() => {
          // ARK appends each generation: the last entry is the parents, the one before
          // it that parent's own parents.
          const p = creature.ancestorsMale.at(-1) ?? creature.ancestors.at(-1)!
          const mPat = creature.ancestorsMale.length > 1 ? creature.ancestorsMale.at(-2) : undefined
          const mMat = creature.ancestors.length > 1 ? creature.ancestors.at(-2) : undefined
          const isImported = (id1: number, id2: number) => importedIds.has(combineArkId(id1, id2))

          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-xl">Ancestry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-3">
                  {(mPat || mMat) && (
                    <div className="flex w-full justify-around">
                      <div className="flex gap-2">
                        {mPat && <AncestorNode name={mPat.maleName} id1={mPat.maleDinoId1} id2={mPat.maleDinoId2} female={false} imported={isImported(mPat.maleDinoId1, mPat.maleDinoId2)} />}
                        {mPat && <AncestorNode name={mPat.femaleName} id1={mPat.femaleDinoId1} id2={mPat.femaleDinoId2} female={true} imported={isImported(mPat.femaleDinoId1, mPat.femaleDinoId2)} />}
                      </div>
                      <div className="flex gap-2">
                        {mMat && <AncestorNode name={mMat.maleName} id1={mMat.maleDinoId1} id2={mMat.maleDinoId2} female={false} imported={isImported(mMat.maleDinoId1, mMat.maleDinoId2)} />}
                        {mMat && <AncestorNode name={mMat.femaleName} id1={mMat.femaleDinoId1} id2={mMat.femaleDinoId2} female={true} imported={isImported(mMat.femaleDinoId1, mMat.femaleDinoId2)} />}
                      </div>
                    </div>
                  )}
                  <div className="flex w-full justify-around">
                    <AncestorNode name={p.maleName} id1={p.maleDinoId1} id2={p.maleDinoId2} female={false} prominent imported={isImported(p.maleDinoId1, p.maleDinoId2)} />
                    <AncestorNode name={p.femaleName} id1={p.femaleDinoId1} id2={p.femaleDinoId2} female prominent imported={isImported(p.femaleDinoId1, p.femaleDinoId2)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {/* Parents — bred creatures of breedable species (tames have none) */}
        {isBreedable && (profile?.isBred ?? true) && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-xl">Parents</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7 px-2 text-xs"
                  onClick={() => {
                    setPendingFatherId(creature.manualParentMaleId ?? '')
                    setPendingMotherId(creature.manualParentFemaleId ?? '')
                    setEditingParents((v) => !v)
                  }}
                >
                  {editingParents ? <IconX size={12} /> : <IconPencil size={12} />}
                  {editingParents ? 'Cancel' : 'Edit'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editingParents ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-medium flex items-center gap-1">
                      <IconMars size={11} className="text-blue-500" /> Father ARK ID
                    </label>
                    <select
                      className="border-input bg-background text-foreground h-10 w-full rounded-md border px-3 text-sm"
                      value={pendingFatherId}
                      onChange={(e) => setPendingFatherId(e.target.value)}
                    >
                      <option value="">— none —</option>
                      {sameSpecies.filter((c) => !c.isFemale).map((c) => (
                        <option key={c.id} value={c.id}>{c.name || c.dinoNameTag} Lv {c.level}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Or enter ARK ID manually…"
                      value={pendingFatherId}
                      onChange={(e) => setPendingFatherId(e.target.value)}
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-medium flex items-center gap-1">
                      <IconVenus size={11} className="text-pink-500" /> Mother ARK ID
                    </label>
                    <select
                      className="border-input bg-background text-foreground h-10 w-full rounded-md border px-3 text-sm"
                      value={pendingMotherId}
                      onChange={(e) => setPendingMotherId(e.target.value)}
                    >
                      <option value="">— none —</option>
                      {sameSpecies.filter((c) => c.isFemale).map((c) => (
                        <option key={c.id} value={c.id}>{c.name || c.dinoNameTag} Lv {c.level}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Or enter ARK ID manually…"
                      value={pendingMotherId}
                      onChange={(e) => setPendingMotherId(e.target.value)}
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveParents} className="w-full gap-1">
                    <IconHeart size={13} /> Save Parents
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    {([
                      { label: 'Mother', id: motherId, parent: motherCreature, icon: <IconVenus size={14} className="shrink-0 text-pink-500" /> },
                      { label: 'Father', id: fatherId, parent: fatherCreature, icon: <IconMars size={14} className="shrink-0 text-blue-500" /> },
                    ] as const).map(({ label, id: parentId, parent, icon }) => (
                      <div key={label} className="border-border flex min-w-0 items-center gap-2 rounded-lg border p-3">
                        {icon}
                        <span className="text-muted-foreground shrink-0">{label}</span>
                        {parent ? (
                          <Link href={`/my-creatures/${parent.id}`} className="truncate font-medium underline-offset-4 hover:underline">
                            {parent.name || parent.dinoNameTag} <span className="text-muted-foreground font-normal">Lv {parent.level}</span>
                          </Link>
                        ) : parentId ? (
                          <span className="text-muted-foreground truncate" title={parentId}>Not imported</span>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {(motherId || fatherId) && (!motherCreature || !fatherCreature) && (
                    <p className="text-muted-foreground text-sm">
                      Import both parents to see which stats this creature inherited and where its mutations came from.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CreatureReimportButton creature={creature} onReimported={setCreature} />
          <Button
            variant={confirmDelete ? 'destructive' : 'outline'}
            className={confirmDelete ? 'gap-2' : 'gap-2 text-destructive border-destructive/30 hover:bg-destructive/10'}
            onClick={handleDelete}
          >
            <IconTrash size={14} />
            {confirmDelete ? 'Yes, delete it' : 'Delete creature'}
          </Button>
        </div>

        {/* Debug / metadata footer */}
        <dl className="text-muted-foreground border-border grid gap-x-6 gap-y-1 border-t pt-4 text-xs sm:grid-cols-[auto_1fr]">
          <dt>ARK ID</dt><dd className="text-foreground font-mono">{arkId}</dd>
          <dt>Dino IDs</dt><dd className="font-mono">{creature.dinoId1} / {creature.dinoId2}</dd>
          {creature.importFilename && <><dt>Imported from</dt><dd className="font-mono break-all">{creature.importFilename}</dd></>}
          <dt>Imported</dt><dd>{new Date(creature.importedAt).toLocaleString()}</dd>
          <dt>Updated</dt><dd>{new Date(creature.updatedAt).toLocaleString()}</dd>
        </dl>
    </main>
  )
}
