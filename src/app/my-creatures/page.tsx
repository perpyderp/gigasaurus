'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useQueryState, useQueryStates, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs'
import { IconSearch, IconFilter, IconUpload, IconCloudUpload, IconCloudDown, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { PawPrint, GitFork } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button-variants'
import { computeBests, type CollectionBests } from '@/lib/breeding'
import { speciesGroupKey, useCreatureProfiles } from '@/hooks/use-creature-profiles'
import { getAllCreatures } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { listPaths, importChangedFromPath } from '@/lib/import-paths'
import { CreatureCard } from '@/components/CreatureCard'
import { ImportDropzone } from '@/components/ImportDropzone'
import { SavedPaths } from '@/components/SavedPaths'
import { DriveSync } from '@/components/DriveSync'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ImageMode } from '@/components/CreatureCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

const PAGE_SIZE_OPTIONS = [12, 24, 48]

// value → label maps so Base UI's Select.Value shows clean text (e.g. "Any gender")
// instead of the raw stored value (e.g. "__all"). See @/components/ui/select.
const GENDER_LABELS: Record<string, string> = { __all: 'Any gender', m: '♂ Male', f: '♀ Female' }
const SORT_LABELS: Record<string, string> = {
  updated: 'Recently updated',
  imported: 'Recently imported',
  level: 'Highest level',
  melee: 'Highest melee',
  health: 'Highest health',
  name: 'Name A–Z',
}
const MUTATION_LABELS: Record<string, string> = { __all: 'Any', '1': 'Has mutations' }

function MyCreaturesContent() {
  const [creatures, setCreatures] = useState<StoredCreature[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [speciesNameBySlug, setSpeciesNameBySlug] = useState<Record<string, string>>({})
  const [watchNotice, setWatchNotice] = useState<string | null>(null)

  // nuqs-synced state
  const [imageMode, setImageMode] = useQueryState(
    'view',
    parseAsStringLiteral(['dossier', 'colors'] as const satisfies readonly ImageMode[]).withDefault('dossier'),
  )
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [pageSize, setPageSize] = useQueryState('size', parseAsInteger.withDefault(24))
  const [{ gender, sort, species, mutationsOnly }, setFilters] = useQueryStates({
    gender: parseAsString.withDefault(''),
    sort: parseAsString.withDefault('updated'),
    species: parseAsString.withDefault(''),
    mutationsOnly: parseAsString.withDefault(''),
  })

  const load = useCallback(async () => {
    const all = await getAllCreatures()
    setCreatures(all)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Solved points for every creature (lineage needs the whole collection), and the
  // best points per stat within each species for the cards' record markers.
  const { profiles } = useCreatureProfiles(loading ? null : creatures)
  const bestsByGroup = useMemo(() => {
    const out = new Map<string, CollectionBests>()
    if (!profiles) return out
    const list = [...profiles.values()]
    const groups = new Map<string, typeof list>()
    for (const p of list) {
      const key = speciesGroupKey(p.creature)
      groups.set(key, [...(groups.get(key) ?? []), p])
    }
    for (const [key, group] of groups) out.set(key, computeBests(group, group[0].eligible))
    return out
  }, [profiles])

  // Lazily load slug → wiki-name map only when the user flips to Colorized mode.
  useEffect(() => {
    if (imageMode !== 'colors' || Object.keys(speciesNameBySlug).length > 0) return
    let cancelled = false
    fetch('/api/creatures?limit=500')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.results) return
        const map: Record<string, string> = {}
        for (const r of data.results as Array<{ slug: string; name: string }>) map[r.slug] = r.name
        setSpeciesNameBySlug(map)
      })
      .catch(() => {/* ignore — cards just stay on dossier */})
    return () => { cancelled = true }
  }, [imageMode, speciesNameBySlug])

  // Auto-watch: while this page is open, poll any folders the user marked as
  // "watched" and import exports modified since the last scan. Browsers can't
  // watch the filesystem in the background, so this only runs with the tab open
  // and requires read permission already granted (Chromium / FSA).
  useEffect(() => {
    let running = false
    let stopped = false

    async function poll() {
      if (running || stopped) return
      if (typeof document !== 'undefined' && document.hidden) return
      running = true
      try {
        const watched = (await listPaths()).filter((p) => p.watch)
        let created = 0
        let updated = 0
        for (const p of watched) {
          const { results } = await importChangedFromPath(p.id, p.lastScan ?? 0)
          created += results.filter((r) => r.status === 'new').length
          updated += results.filter((r) => r.status === 'updated').length
        }
        if (created + updated > 0) {
          await load()
          const parts = [created && `${created} new`, updated && `${updated} updated`].filter(Boolean)
          setWatchNotice(`Auto-imported ${parts.join(', ')} from watched folder${watched.length > 1 ? 's' : ''}`)
        }
      } catch {
        // transient scan/permission errors — try again next tick
      } finally {
        running = false
      }
    }

    const kickoff = setTimeout(poll, 1500)
    const interval = setInterval(poll, 8000)
    return () => { stopped = true; clearTimeout(kickoff); clearInterval(interval) }
  }, [load])

  // Auto-dismiss the watch notice.
  useEffect(() => {
    if (!watchNotice) return
    const t = setTimeout(() => setWatchNotice(null), 5000)
    return () => clearTimeout(t)
  }, [watchNotice])

  const handleImported = useCallback(() => { load(); setShowImport(false) }, [load])
  const handleRestored = useCallback(() => { load() }, [load])

  // Distinct species for filter dropdown
  const speciesList = useMemo(() => {
    const tags = [...new Set(creatures.map((c) => c.dinoNameTag.replace(/AA$/, '')))]
    return tags.sort()
  }, [creatures])

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...creatures]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.dinoNameTag.toLowerCase().includes(q) ||
        c.tamer.toLowerCase().includes(q)
      )
    }
    if (species) {
      result = result.filter((c) => c.dinoNameTag.replace(/AA$/, '') === species)
    }
    if (gender === 'm') result = result.filter((c) => !c.isFemale)
    if (gender === 'f') result = result.filter((c) => c.isFemale)
    if (mutationsOnly === '1') result = result.filter((c) => c.mutationsMale + c.mutationsFemale > 0)

    result.sort((a, b) => {
      switch (sort) {
        case 'level': return b.level - a.level
        case 'melee': return b.stats.meleeDamage - a.stats.meleeDamage
        case 'health': return b.stats.health - a.stats.health
        case 'name': return a.name.localeCompare(b.name)
        case 'imported': return b.importedAt - a.importedAt
        default: return b.updatedAt - a.updatedAt
      }
    })

    return result
  }, [creatures, search, species, gender, mutationsOnly, sort])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const activeFilterCount = [
    gender !== '',
    species !== '',
    mutationsOnly === '1',
    sort !== 'updated',
  ].filter(Boolean).length

  const clearFilters = () => {
    setFilters({ gender: '', sort: 'updated', species: '', mutationsOnly: '' })
    setPage(1)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-10">

        {/* Header */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-4xl leading-none sm:text-5xl">My Creatures</h1>
            <p className="text-muted-foreground mt-3 text-[15px]">
              {loading
                ? 'Loading your creatures…'
                : `${creatures.length} creature${creatures.length !== 1 ? 's' : ''}, stored in this browser`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {creatures.length > 0 && (
              <Link href="/my-creatures/breeding" className={buttonVariants({ variant: 'outline', className: 'h-11 gap-2 px-4 text-[15px]' })}>
                <GitFork aria-hidden className="size-4" /> Breeding planner
              </Link>
            )}
            <Button
              onClick={() => setShowImport((v) => !v)}
              aria-expanded={showImport}
              className="h-11 gap-2 px-4 text-[15px]"
            >
              <IconUpload size={16} />
              {showImport ? 'Close import' : 'Import creatures'}
            </Button>
          </div>
        </div>

        {/* Auto-watch notice */}
        {watchNotice && (
          <div role="status" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm">
            <IconCloudDown size={14} /> {watchNotice}
          </div>
        )}

        {/* Import / Resync All panel */}
        {showImport && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Import and resync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                Drop <span className="font-mono">.ini</span> exports to add creatures or update ones you already have. To refresh everything, export again in ARK and drop the whole <span className="font-mono">ShooterGame/Saved/DinoExports</span> folder.
              </p>
              <ImportDropzone onImported={handleImported} />
              <Separator />
              <SavedPaths onImported={handleImported} />
              <Separator />
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <IconCloudUpload size={16} aria-hidden /> Google Drive backup
                </p>
                <DriveSync onRestored={handleRestored} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search + Filter bar */}
        {creatures.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <IconSearch size={14} className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="search"
                aria-label="Search your creatures"
                placeholder="Search by name, species or tribe"
                value={search}
                onChange={(e) => { setSearch(e.target.value || null); setPage(1) }}
                className="bg-card h-11 pl-9 text-[15px]"
              />
            </div>
            <Button
              variant={activeFilterCount > 0 ? 'default' : 'outline'}
              className="h-11 shrink-0 gap-2 px-4"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <IconFilter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{activeFilterCount}</Badge>
              )}
            </Button>
          </div>
        )}

        {/* Filter panel */}
        {showFilters && creatures.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Species */}
                <div className="space-y-1">
                  <label className="text-muted-foreground text-sm font-medium">Species</label>
                  <Select
                    items={{ __all: 'All species', ...Object.fromEntries(speciesList.map((s) => [s, s])) }}
                    value={species || '__all'}
                    onValueChange={(v) => { setFilters({ species: v === '__all' ? '' : v }); setPage(1) }}
                  >
                    <SelectTrigger className="h-10 w-full text-sm">
                      <SelectValue placeholder="All species" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All species</SelectItem>
                      {speciesList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="text-muted-foreground text-sm font-medium">Gender</label>
                  <Select items={GENDER_LABELS} value={gender || '__all'} onValueChange={(v) => { setFilters({ gender: v === '__all' ? '' : v }); setPage(1) }}>
                    <SelectTrigger className="h-10 w-full text-sm">
                      <SelectValue placeholder="Any gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Any gender</SelectItem>
                      <SelectItem value="m">♂ Male</SelectItem>
                      <SelectItem value="f">♀ Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="space-y-1">
                  <label className="text-muted-foreground text-sm font-medium">Sort by</label>
                  <Select items={SORT_LABELS} value={sort} onValueChange={(v) => { setFilters({ sort: v }); setPage(1) }}>
                    <SelectTrigger className="h-10 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">Recently updated</SelectItem>
                      <SelectItem value="imported">Recently imported</SelectItem>
                      <SelectItem value="level">Highest level</SelectItem>
                      <SelectItem value="melee">Highest melee</SelectItem>
                      <SelectItem value="health">Highest health</SelectItem>
                      <SelectItem value="name">Name A–Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mutations filter */}
                <div className="space-y-1">
                  <label className="text-muted-foreground text-sm font-medium">Mutations</label>
                  <Select items={MUTATION_LABELS} value={mutationsOnly === '1' ? '1' : '__all'} onValueChange={(v) => { setFilters({ mutationsOnly: v === '1' ? '1' : '' }); setPage(1) }}>
                    <SelectTrigger className="h-10 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Any</SelectItem>
                      <SelectItem value="1">Has mutations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Grid */}
        {loading ? (
          <div aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="bg-card ring-border h-80 animate-pulse rounded-xl ring-1" />
            ))}
          </div>
        ) : creatures.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
            <PawPrint aria-hidden className="text-muted-foreground/60 size-10" strokeWidth={1.5} />
            <p className="font-display text-2xl">No creatures yet</p>
            <p className="text-muted-foreground max-w-md">
              In ARK, open a creature&apos;s options wheel and choose Export, then drop the .ini file here to see its levels, breeding values and colors.
            </p>
            {!showImport && (
              <Button className="mt-2 h-11 gap-2 px-4 text-[15px]" onClick={() => setShowImport(true)}>
                <IconUpload size={16} /> Import creatures
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <p className="text-muted-foreground">No creatures match your search and filters.</p>
            <Button variant="link" onClick={() => { setSearch(null); clearFilters() }}>
              Clear search and filters
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {filtered.length === creatures.length
                  ? `${filtered.length} creature${filtered.length !== 1 ? 's' : ''}`
                  : `${filtered.length} of ${creatures.length} creatures`}
              </p>
              <Tabs value={imageMode} onValueChange={(v) => setImageMode(v as ImageMode)}>
                <TabsList aria-label="Card image">
                  <TabsTrigger value="dossier">Dossier</TabsTrigger>
                  <TabsTrigger value="colors">In color</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {paginated.map((creature) => (
                <CreatureCard
                  key={creature.id}
                  creature={creature}
                  imageMode={imageMode}
                  speciesName={creature.apiSlug ? speciesNameBySlug[creature.apiSlug] ?? null : null}
                  profile={profiles?.get(creature.id) ?? null}
                  bests={bestsByGroup.get(speciesGroupKey(creature)) ?? null}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
                <div className="text-muted-foreground text-sm">
                  Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                    className="size-9 p-0"
                    aria-label="Previous page"
                  >
                    <IconChevronLeft size={16} />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(totalPages - 4, safePage - 2)) + i
                    return (
                      <Button
                        key={p}
                        variant={p === safePage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPage(p)}
                        aria-current={p === safePage ? 'page' : undefined}
                        className="size-9 p-0 text-sm tabular-nums"
                      >
                        {p}
                      </Button>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                    className="size-9 p-0"
                    aria-label="Next page"
                  >
                    <IconChevronRight size={16} />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                    <SelectTrigger className="h-9 w-18 text-sm" aria-label="Creatures per page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </nav>
            )}
          </>
        )}
    </main>
  )
}

export default function MyCreaturesPage() {
  return (
    <Suspense>
      <MyCreaturesContent />
    </Suspense>
  )
}
