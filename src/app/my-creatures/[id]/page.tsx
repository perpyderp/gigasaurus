'use client'

import { use, useEffect, useState, useCallback } from 'react'
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
import { getCreature, upsertCreature, deleteCreature, getAllCreatures } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { ColorSwatches } from '@/components/ColorSwatch'
import { CreatureColorRender } from '@/components/CreatureColorRender'
import { StatBar, StatTableHeader, type StatDisplayStyle } from '@/components/StatBar'
import { CreatureReimportButton } from '@/components/CreatureReimportButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  STAT_CONFIG,
  RELEVANT_STATS,
  STAT_MAXES,
  formatStatValue,
  estimateStatPoints,
  getStatTopPercent,
} from '@/lib/stat-calc'
import {
  buildSpeciesParams,
  solveAllStats,
  summarizeLevels,
  type StatSolutionMap,
} from '@/lib/ark-stat-solver'
import { combineArkId } from '@/lib/ark-id'

export default function CreatureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [creature, setCreature] = useState<StoredCreature | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [statSolutions, setStatSolutions] = useState<StatSolutionMap | null>(null)
  const [isBreedable, setIsBreedable] = useState(false)
  const [sameSpecies, setSameSpecies] = useState<StoredCreature[]>([])
  const [editingParents, setEditingParents] = useState(false)
  const [pendingFatherId, setPendingFatherId] = useState('')
  const [pendingMotherId, setPendingMotherId] = useState('')
  const [speciesName, setSpeciesName] = useState<string | null>(null)
  const [imageTab, setImageTab] = useState<'dossier' | 'colors'>('dossier')
  const [statStyle, setStatStyle] = useState<StatDisplayStyle>('circle')

  const load = useCallback(async () => {
    const c = await getCreature(id)
    setCreature(c ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Fetch species data: solve stats and check breedability
  useEffect(() => {
    if (!creature?.apiSlug) return
    const isBred = creature.ancestors.length > 0 || creature.imprintQuality > 0
    fetch(`/api/creatures/${creature.apiSlug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        if (data.base_stats_growth) {
          const speciesParams = buildSpeciesParams(data.base_stats_growth)
          setStatSolutions(solveAllStats(creature.stats as unknown as Record<string, number>, speciesParams, creature.imprintQuality, isBred))
        }
        setIsBreedable(!!data.breedable)
        if (typeof data.name === 'string') setSpeciesName(data.name)
      })
      .catch(() => {/* silently ignore */})
  }, [creature])

  // Load same-species creatures when breedable and editing parents
  useEffect(() => {
    if (!isBreedable || !creature?.apiSlug || !editingParents) return
    getAllCreatures()
      .then((all) => setSameSpecies(all.filter((c) => c.apiSlug === creature.apiSlug && c.id !== creature.id)))
      .catch(() => {})
  }, [isBreedable, creature, editingParents])

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
  const arkId = combineArkId(creature.dinoId1, creature.dinoId2)
  const levelSummary = statSolutions ? summarizeLevels(statSolutions, creature.level) : null

  // Look up parent display names from same-species list
  const fatherCreature = sameSpecies.find((c) => c.id === creature.manualParentMaleId)
  const motherCreature = sameSpecies.find((c) => c.id === creature.manualParentFemaleId)

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">

        <Link href="/my-creatures" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors">
          <IconArrowLeft size={14} />
          My Creatures
        </Link>

        {/* Hero */}
        <Card>
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
            <div className="flex w-full max-w-sm flex-col gap-2 sm:max-w-xs md:max-w-sm">
              <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-lg">
                {imageTab === 'colors' && speciesName ? (
                  <CreatureColorRender
                    speciesName={speciesName}
                    slug={creature.apiSlug}
                    colors={creature.colors}
                    size={384}
                    className="h-full w-full"
                  />
                ) : imageUrl ? (
                  <Image src={imageUrl} alt={creature.name} fill className="object-contain p-3" sizes="(max-width: 640px) 90vw, 384px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-6xl opacity-30">🦕</div>
                )}
              </div>
              <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as 'dossier' | 'colors')}>
                <TabsList className="w-full">
                  <TabsTrigger value="dossier" className="flex-1">Dossier</TabsTrigger>
                  <TabsTrigger value="colors" className="flex-1" disabled={!speciesName}>Colors</TabsTrigger>
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
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>Tribe: <span className="text-foreground">{creature.tribe || '—'}</span></span>
                <span>Owner: <span className="text-foreground">{creature.tamer || '—'}</span></span>
                <span>Imprinted by: <span className="text-foreground">{creature.imprinter || '—'}</span></span>
              </div>

              {creature.apiSlug && (
                <Link
                  href={`/creatures/${creature.apiSlug}`}
                  className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                >
                  View species page →
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold">Stats</CardTitle>
              <div className="bg-muted/40 flex rounded-md p-0.5 text-xs">
                {(['circle', 'bar', 'value'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatStyle(s)}
                    className={`px-2.5 py-1 rounded-sm capitalize transition-colors ${statStyle === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {levelSummary && (
              <div className="text-muted-foreground border-border mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="block uppercase tracking-wide text-[10px]">Wild Levels</span>
                  <span className="text-blue-500 dark:text-blue-400 font-semibold tabular-nums">{levelSummary.totalWild}</span>
                </div>
                <div>
                  <span className="block uppercase tracking-wide text-[10px]">Tamed Levels</span>
                  <span className="text-violet-500 dark:text-violet-400 font-semibold tabular-nums">{levelSummary.totalDom}</span>
                </div>
                <div>
                  <span className="block uppercase tracking-wide text-[10px]">Computed Level</span>
                  <span className="text-foreground font-semibold tabular-nums">{levelSummary.computedLevel}</span>
                </div>
                <div>
                  <span className="block uppercase tracking-wide text-[10px]">Export Level</span>
                  <span className="text-foreground font-semibold tabular-nums">{creature.level}</span>
                  {levelSummary.levelDelta !== 0 && (
                    <span
                      className="ml-1 text-amber-600 dark:text-amber-500 font-medium"
                      title="Solver mismatch — usually means non-vanilla server multipliers or scraped wiki data is off"
                    >
                      ⚠ {levelSummary.levelDelta > 0 ? '+' : ''}{levelSummary.levelDelta}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className={
            statStyle === 'value'
              ? 'space-y-0'
              : statStyle === 'bar'
                ? 'grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2'
                : 'grid grid-cols-1 gap-4 sm:grid-cols-2'
          }>
            {statStyle === 'value' && <StatTableHeader />}
            {RELEVANT_STATS.map((stat) => {
              const cfg = STAT_CONFIG[stat]
              const value = creature.stats[stat]
              const display = formatStatValue(stat, value)
              const topPct = getStatTopPercent(stat, value)
              const solution = statSolutions?.[stat]
              const breedingDisplay = solution?.solved
                ? formatStatValue(stat, solution.breedingValue)
                : undefined
              const maxPotentialDisplay = solution?.solved
                ? formatStatValue(stat, solution.maxPotential)
                : undefined
              return (
                <StatBar
                  key={stat}
                  label={cfg.label}
                  value={value}
                  display={display}
                  breedingDisplay={breedingDisplay}
                  maxPotentialDisplay={maxPotentialDisplay}
                  max={STAT_MAXES[stat]}
                  color={cfg.ringColor}
                  style={statStyle}
                  points={solution ? undefined : points[stat]}
                  wildLevels={solution?.wild}
                  domLevels={solution?.dom}
                  solved={solution?.solved}
                  topPercent={topPct !== 'common' ? topPct : undefined}
                />
              )
            })}
          </CardContent>
        </Card>

        {/* Ancestry tree — from INI export */}
        {creature.ancestors.length > 0 && (() => {
          const p = creature.ancestors[0]
          const mPat = creature.ancestorsMale[0]
          const mMat = creature.ancestors[1]

          type NodeProps = { name: string; id1: number; id2: number; female: boolean }
          function AncestorNode({ name, id1, id2, female }: NodeProps) {
            const label = name || `${id1}_${id2}`
            return (
              <div className="flex flex-col items-center gap-0.5 min-w-0 max-w-[120px]">
                <div className={`rounded-full p-0.5 ${female ? 'bg-pink-500/20' : 'bg-blue-500/20'}`}>
                  {female
                    ? <IconVenus size={10} className="text-pink-500" />
                    : <IconMars size={10} className="text-blue-500" />}
                </div>
                <span className="text-muted-foreground truncate text-center text-[10px] w-full">{label}</span>
              </div>
            )
          }

          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Ancestry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-3">
                  {(mPat || mMat) && (
                    <div className="flex w-full justify-around">
                      <div className="flex gap-2">
                        {mPat && <AncestorNode name={mPat.maleName} id1={mPat.maleDinoId1} id2={mPat.maleDinoId2} female={false} />}
                        {mPat && <AncestorNode name={mPat.femaleName} id1={mPat.femaleDinoId1} id2={mPat.femaleDinoId2} female={true} />}
                      </div>
                      <div className="flex gap-2">
                        {mMat && <AncestorNode name={mMat.maleName} id1={mMat.maleDinoId1} id2={mMat.maleDinoId2} female={false} />}
                        {mMat && <AncestorNode name={mMat.femaleName} id1={mMat.femaleDinoId1} id2={mMat.femaleDinoId2} female={true} />}
                      </div>
                    </div>
                  )}
                  <div className="flex w-full justify-around">
                    <div className="flex flex-col items-center gap-0.5 min-w-0 max-w-[140px]">
                      <div className="rounded-full p-0.5 bg-blue-500/20"><IconMars size={12} className="text-blue-500" /></div>
                      <span className="text-foreground truncate text-center text-xs font-medium w-full">
                        {p.maleName || `${p.maleDinoId1}_${p.maleDinoId2}`}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 min-w-0 max-w-[140px]">
                      <div className="rounded-full p-0.5 bg-pink-500/20"><IconVenus size={12} className="text-pink-500" /></div>
                      <span className="text-foreground truncate text-center text-xs font-medium w-full">
                        {p.femaleName || `${p.femaleDinoId1}_${p.femaleDinoId2}`}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {/* Manual Parents — shown for breedable species */}
        {isBreedable && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Parents</CardTitle>
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
                      className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
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
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-medium flex items-center gap-1">
                      <IconVenus size={11} className="text-pink-500" /> Mother ARK ID
                    </label>
                    <select
                      className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
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
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveParents} className="w-full gap-1">
                    <IconHeart size={13} /> Save Parents
                  </Button>
                </div>
              ) : (
                <div className="flex gap-6 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <IconMars size={14} className="text-blue-500 shrink-0" />
                    <span className="text-foreground truncate">
                      {fatherCreature
                        ? `${fatherCreature.name || fatherCreature.dinoNameTag} Lv ${fatherCreature.level}`
                        : creature.manualParentMaleId
                          ? <span className="font-mono text-xs text-muted-foreground">{creature.manualParentMaleId}</span>
                          : <span className="text-muted-foreground">—</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <IconVenus size={14} className="text-pink-500 shrink-0" />
                    <span className="text-foreground truncate">
                      {motherCreature
                        ? `${motherCreature.name || motherCreature.dinoNameTag} Lv ${motherCreature.level}`
                        : creature.manualParentFemaleId
                          ? <span className="font-mono text-xs text-muted-foreground">{creature.manualParentFemaleId}</span>
                          : <span className="text-muted-foreground">—</span>}
                    </span>
                  </div>
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
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </Button>
        </div>

        {/* Debug / metadata footer */}
        <div className="text-muted-foreground/60 space-y-0.5 font-mono text-xs">
          <p>DinoID1: {creature.dinoId1}  ·  DinoID2: {creature.dinoId2}  ·  ARK ID: {arkId}</p>
          {creature.importFilename && <p>Imported from: {creature.importFilename}</p>}
          <p>
            Imported {new Date(creature.importedAt).toLocaleString()} ·{' '}
            Updated {new Date(creature.updatedAt).toLocaleString()}
          </p>
        </div>
      </div>
    </main>
  )
}
