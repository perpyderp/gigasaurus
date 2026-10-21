'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useQueryState, useQueryStates, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs'
import { IconSearch, IconFilter, IconUpload, IconCloudUpload, IconCloudDown } from '@tabler/icons-react'
import { PawPrint, GitFork, CheckSquare, RefreshCw, Trash2, X, Compass } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button-variants'
import { computeBests, type CollectionBests } from '@/lib/breeding'
import { speciesGroupKey, useCreatureProfiles } from '@/hooks/use-creature-profiles'
import { getAllCreatures, deleteCreatures } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { listPaths, importChangedFromPath, refreshCreaturesFromFiles, regrantWatchedFolders } from '@/lib/import-paths'
import { CreatureCard } from '@/components/CreatureCard'
import { CreatureFilterFields } from '@/components/CreatureFilterFields'
import { CreaturePagination } from '@/components/CreaturePagination'
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  activeFilterCount as countActiveFilters,
  filterAndSortCreatures,
  paginate,
  speciesTag,
} from '@/lib/creature-filters'
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
import { Tour } from '@/components/tour/Tour'
import { useTour } from '@/components/tour/use-tour'
import { myCreaturesTourSteps } from './my-creatures-tour'

const PAGE_SIZE_OPTIONS = [12, 24, 48]

/** Sticky bar for acting on selected creatures. */
function SelectionBar({
  count,
  shownCount,
  busy,
  onSelectAll,
  onClear,
  onRefresh,
  onDelete,
  onDone,
}: {
  count: number
  shownCount: number
  busy: boolean
  onSelectAll: () => void
  onClear: () => void
  onRefresh: () => void
  onDelete: () => void
  onDone: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const noun = `creature${count === 1 ? '' : 's'}`
  return (
    <div role="toolbar" aria-label="Selected creatures" className="bg-background/95 border-border sticky bottom-0 z-10 -mx-4 border-t px-4 py-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm font-semibold tabular-nums" aria-live="polite">{count} selected</p>
        <Button variant="ghost" size="sm" onClick={onSelectAll} disabled={busy}>Select all {shownCount} shown</Button>
        {count > 0 && <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>Clear</Button>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm">Delete {count} {noun} from this browser?</span>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => { setConfirming(false); onDelete() }}>
                <Trash2 aria-hidden /> Delete {count}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" disabled={busy || count === 0} onClick={onRefresh}>
                <RefreshCw aria-hidden className={busy ? 'animate-spin' : ''} /> Refresh from files
              </Button>
              <Button variant="outline" size="sm" disabled={busy || count === 0} onClick={() => setConfirming(true)} className="text-destructive">
                <Trash2 aria-hidden /> Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={onDone} aria-label="Leave select mode">
                <X aria-hidden /> Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MyCreaturesContent() {
  const [creatures, setCreatures] = useState<StoredCreature[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  // Species names by API slug: [name, ...alternate names]. Used by search and the color view.
  const [speciesNamesBySlug, setSpeciesNamesBySlug] = useState<Record<string, string[]>>({})
  const [watchNotice, setWatchNotice] = useState<string | null>(null)
  // Watched folders the browser stopped letting us read (e.g. after a restart).
  const [blockedFolders, setBlockedFolders] = useState<{ id: string; label: string }[]>([])
  const [watchKick, setWatchKick] = useState(0)
  // Select mode: null = off, otherwise the selected creature IDs.
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [selectionBusy, setSelectionBusy] = useState(false)
  const [actionNotice, setActionNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  // nuqs-synced state
  const [imageMode, setImageMode] = useQueryState(
    'view',
    parseAsStringLiteral(['dossier', 'colors'] as const satisfies readonly ImageMode[]).withDefault('dossier'),
  )
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [pageSize, setPageSize] = useQueryState('size', parseAsInteger.withDefault(24))
  const [filters, setFilters] = useQueryStates({
    gender: parseAsString.withDefault(''),
    sort: parseAsString.withDefault(DEFAULT_SORT),
    species: parseAsString.withDefault(''),
    mutations: parseAsString.withDefault(''),
  })
  const filterState = useMemo(() => ({ ...filters, search }), [filters, search])

  // First visit: walk through importing, filtering and the planner.
  const tour = useTour('my-creatures', { autoStart: true })
  const tourSteps = myCreaturesTourSteps({ openImport: () => setShowImport(true), openFilters: () => setShowFilters(true) })

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

  // Load each species' names once (the API serves at most 100 per page).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const map: Record<string, string[]> = {}
      for (let offset = 0; ; offset += 100) {
        const r = await fetch(`/api/creatures?limit=100&offset=${offset}`)
        if (!r.ok) break
        const data = (await r.json()) as { count: number; results: Array<{ slug: string; name: string; alternate_names?: string[] }> }
        for (const c of data.results) map[c.slug] = [c.name, ...(c.alternate_names ?? [])]
        if (offset + 100 >= data.count || data.results.length === 0) break
      }
      if (!cancelled) setSpeciesNamesBySlug(map)
    })().catch(() => {/* search and color view fall back to the creature's own names */})
    return () => { cancelled = true }
  }, [])

  // Auto-watch: while this page is open, poll any folders the user marked as
  // "watched" and import exports modified since the last scan. Browsers can't
  // watch the filesystem in the background, so this only runs with the tab open
  // and requires read permission already granted (Chromium / FSA).
  // It keeps running while the tab is hidden (you're in ARK, exporting); Chrome
  // throttles hidden timers to about once a minute, and returning to the tab scans at once.
  useEffect(() => {
    let running = false
    let stopped = false

    async function poll() {
      if (running || stopped) return
      running = true
      try {
        const watched = (await listPaths()).filter((p) => p.watch)
        let created = 0
        let updated = 0
        const blocked: { id: string; label: string }[] = []
        for (const p of watched) {
          try {
            const { results, needsPermission } = await importChangedFromPath(p.id, p.lastScan ?? 0)
            if (needsPermission) blocked.push({ id: p.id, label: p.label })
            created += results.filter((r) => r.status === 'new').length
            updated += results.filter((r) => r.status === 'updated').length
          } catch {
            // this folder failed (moved, removed) — keep scanning the others
          }
        }
        if (!stopped) {
          setBlockedFolders((prev) =>
            prev.length === blocked.length && prev.every((b, i) => b.id === blocked[i].id) ? prev : blocked,
          )
        }
        if (created + updated > 0) {
          await load()
          const parts = [created && `${created} new`, updated && `${updated} updated`].filter(Boolean)
          setWatchNotice(`Auto-imported ${parts.join(', ')} from watched folder${watched.length > 1 ? 's' : ''}`)
        }
      } finally {
        running = false
      }
    }

    const onVisible = () => { if (!document.hidden) poll() }
    const kickoff = setTimeout(poll, 1500)
    const interval = setInterval(poll, 8000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(kickoff)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, watchKick])

  /** Click handler: the browser shows its folder-access prompt, then watching resumes. */
  const allowWatchedFolders = async () => {
    await regrantWatchedFolders(blockedFolders.map((f) => f.id))
    setWatchKick((k) => k + 1)
  }

  // Auto-dismiss the watch notice.
  useEffect(() => {
    if (!watchNotice) return
    const t = setTimeout(() => setWatchNotice(null), 5000)
    return () => clearTimeout(t)
  }, [watchNotice])

  const handleImported = useCallback(() => { load(); setShowImport(false) }, [load])
  const handleRestored = useCallback(() => { load() }, [load])

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const deleteSelected = async () => {
    if (!selected?.size) return
    setSelectionBusy(true)
    const count = selected.size
    await deleteCreatures([...selected])
    await load()
    setSelectionBusy(false)
    setSelected(new Set())
    setActionNotice({ tone: 'ok', text: `Deleted ${count} creature${count === 1 ? '' : 's'}.` })
  }

  /** Re-read each selected creature's export from the folder it was imported from. */
  const refreshSelected = async () => {
    if (!selected?.size) return
    setSelectionBusy(true)
    const { updated, failed, unlinked } = await refreshCreaturesFromFiles(creatures.filter((c) => selected.has(c.id)))
    await load()
    setSelectionBusy(false)
    const parts = [`Refreshed ${updated.length} from their export files.`]
    if (failed.length) {
      const reasons = [...new Set(failed.map((f) => f.reason))]
      parts.push(`${failed.length} couldn't be read: ${reasons.slice(0, 2).join('; ')}${reasons.length > 2 ? '; …' : ''}.`)
    }
    if (unlinked.length) {
      parts.push(`${unlinked.length} ${unlinked.length === 1 ? 'was' : 'were'} dropped in by hand, so there's no folder to refresh from — add the DinoExports folder under Import creatures, then import once from it.`)
    }
    setActionNotice({ tone: failed.length || unlinked.length ? 'warn' : 'ok', text: parts.join(' ') })
  }

  // Distinct species for filter dropdown
  const speciesList = useMemo(() => [...new Set(creatures.map(speciesTag))].sort(), [creatures])

  const filtered = useMemo(
    () => filterAndSortCreatures(creatures, filterState, speciesNamesBySlug),
    [creatures, filterState, speciesNamesBySlug],
  )
  const { totalPages, page: safePage, items: paginated } = paginate(filtered, page, pageSize)
  const activeFilterCount = countActiveFilters(filterState)

  const clearFilters = () => {
    setFilters({ gender: EMPTY_FILTERS.gender, sort: EMPTY_FILTERS.sort, species: EMPTY_FILTERS.species, mutations: EMPTY_FILTERS.mutations })
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
            <Button variant="ghost" onClick={tour.actions.start} data-tour="tour-button" className="h-11 gap-2 px-4 text-[15px]">
              <Compass aria-hidden className="size-4" /> Take the tour
            </Button>
            {creatures.length > 0 && (
              <Link href="/my-creatures/breeding" data-tour="breeding-link" className={buttonVariants({ variant: 'outline', className: 'h-11 gap-2 px-4 text-[15px]' })}>
                <GitFork aria-hidden className="size-4" /> Breeding planner
              </Link>
            )}
            <Button
              onClick={() => setShowImport((v) => !v)}
              aria-expanded={showImport}
              data-tour="import-button"
              className="h-11 gap-2 px-4 text-[15px]"
            >
              <IconUpload size={16} />
              {showImport ? 'Close import' : 'Import creatures'}
            </Button>
          </div>
        </div>

        {actionNotice && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              actionNotice.tone === 'ok'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
            }`}
          >
            <span className="flex-1">{actionNotice.text}</span>
            <button type="button" onClick={() => setActionNotice(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        )}

        {blockedFolders.length > 0 && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-200">
            <span className="flex-1">
              Watching is paused for {blockedFolders.map((f) => `“${f.label}”`).join(', ')}: the browser needs permission to read
              {blockedFolders.length === 1 ? ' it' : ' them'} again. New exports won&apos;t import until you allow access.
            </span>
            <Button size="sm" onClick={allowWatchedFolders}>Allow access</Button>
          </div>
        )}

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
              <div data-tour="import-dropzone">
                <ImportDropzone onImported={handleImported} />
              </div>
              <Separator />
              <div data-tour="saved-folders">
                <SavedPaths onImported={handleImported} />
              </div>
              <Separator />
              <div data-tour="drive-sync">
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
            <div data-tour="search" className="relative flex-1">
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
          <Card data-tour="filter-panel">
            <CardContent className="p-4">
              <CreatureFilterFields
                state={filterState}
                speciesList={speciesList}
                onChange={(patch) => { setFilters(patch); setPage(1) }}
                onClear={clearFilters}
              />
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
              <div className="flex items-center gap-2">
                {!selected && (
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} data-tour="select">
                    <CheckSquare aria-hidden /> Select
                  </Button>
                )}
                <Tabs value={imageMode} onValueChange={(v) => setImageMode(v as ImageMode)} data-tour="card-view">
                  <TabsList aria-label="Card image">
                    <TabsTrigger value="dossier">Dossier</TabsTrigger>
                    <TabsTrigger value="colors">In color</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div data-tour="creature-grid" className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {paginated.map((creature) => (
                <CreatureCard
                  key={creature.id}
                  creature={creature}
                  imageMode={imageMode}
                  speciesName={creature.apiSlug ? speciesNamesBySlug[creature.apiSlug]?.[0] ?? null : null}
                  profile={profiles?.get(creature.id) ?? null}
                  bests={bestsByGroup.get(speciesGroupKey(creature)) ?? null}
                  selection={selected ? { selected: selected.has(creature.id), onToggle: () => toggleSelected(creature.id) } : undefined}
                />
              ))}
            </div>
            {selected && (
              <SelectionBar
                count={selected.size}
                shownCount={filtered.length}
                busy={selectionBusy}
                onSelectAll={() => setSelected(new Set(filtered.map((c) => c.id)))}
                onClear={() => setSelected(new Set())}
                onRefresh={refreshSelected}
                onDelete={deleteSelected}
                onDone={() => setSelected(null)}
              />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <CreaturePagination
                page={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                total={filtered.length}
                onPageChange={setPage}
                onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
              />
            )}
          </>
        )}
        <Tour tour={tour} steps={tourSteps} label="My Creatures tour" />
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
