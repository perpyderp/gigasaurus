'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getCreature, upsertCreature, deleteCreature } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { parseArkExport } from '@/lib/ark-parser'
import { resolveSlug, deriveDisplayName } from '@/lib/dino-map'
import { ColorSwatch } from '@/components/ColorSwatch'
import { StatBar } from '@/components/StatBar'
import { ImportDropzone } from '@/components/ImportDropzone'

const STAT_CONFIG = [
  { key: 'health', label: 'Health', max: 20000, color: 'bg-red-500' },
  { key: 'stamina', label: 'Stamina', max: 5000, color: 'bg-yellow-500' },
  { key: 'oxygen', label: 'Oxygen', max: 3000, color: 'bg-sky-400' },
  { key: 'food', label: 'Food', max: 25000, color: 'bg-orange-400' },
  { key: 'weight', label: 'Weight', max: 5000, color: 'bg-amber-600' },
  { key: 'meleeDamage', label: 'Melee', max: 8, color: 'bg-rose-600' },
  { key: 'movementSpeed', label: 'Move Speed', max: 2, color: 'bg-teal-500' },
  { key: 'torpidity', label: 'Torpidity', max: 50000, color: 'bg-purple-500' },
] as const

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
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Loading…</p>
      </main>
    )
  }

  if (!creature) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <p className="text-zinc-500">Creature not found.</p>
        <Link href="/my-creatures" className="text-emerald-600 text-sm hover:underline">← Back</Link>
      </main>
    )
  }

  const imageUrl = creature.apiSlug ? `/images/creatures/${creature.apiSlug}.png` : null
  const meleePct = Math.round(creature.stats.meleeDamage * 100)
  const movePct = Math.round(creature.stats.movementSpeed * 100)
  const mutations = creature.mutationsMale + creature.mutationsFemale
  const isFullyGrown = creature.babyAge >= 1
  const babyPct = Math.round(creature.babyAge * 100)

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <Link href="/my-creatures" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← My Creatures
        </Link>

        {/* Hero */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="flex gap-4 p-5">
            {/* Image */}
            <div className="relative w-32 h-32 shrink-0 rounded-lg bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={creature.name}
                  fill
                  className="object-contain p-2"
                  sizes="128px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">🦕</div>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0 space-y-2">
              {editing ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false) }}
                    className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button onClick={handleSaveName} className="text-sm text-emerald-600 font-medium">Save</button>
                  <button onClick={() => setEditing(false)} className="text-sm text-zinc-400">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {creature.name || creature.dinoNameTag}
                  </h1>
                  <button
                    onClick={() => { setNameInput(creature.name); setEditing(true) }}
                    className="text-xs text-zinc-400 hover:text-zinc-600 shrink-0"
                    title="Edit name"
                  >
                    ✏️
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {creature.dinoNameTag.replace(/AA$/, '')}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  Lv {creature.level}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {creature.isFemale ? '♀ Female' : '♂ Male'}
                </span>
                {creature.isNeutered && (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">Neutered</span>
                )}
              </div>

              <ColorSwatch colors={creature.colors} />

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                {creature.tamer && <span>Tamed by {creature.tamer}</span>}
                {creature.imprinter && <span>Imprinted by {creature.imprinter}</span>}
                {creature.imprintQuality > 0 && (
                  <span className="text-sky-500">{Math.round(creature.imprintQuality * 100)}% imprint</span>
                )}
                {mutations > 0 && (
                  <span className="text-violet-500">{mutations} mutation{mutations !== 1 ? 's' : ''}</span>
                )}
                {!isFullyGrown && (
                  <span className="text-amber-500">Baby {babyPct}%</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Max Stats</h2>
          <div className="space-y-2">
            {STAT_CONFIG.map(({ key, label, max, color }) => {
              const raw = creature.stats[key]
              const display =
                key === 'meleeDamage' ? `${meleePct}%`
                : key === 'movementSpeed' ? `${movePct}%`
                : Math.round(raw).toLocaleString()
              return (
                <StatBar
                  key={key}
                  label={label}
                  value={raw}
                  display={display}
                  max={max}
                  color={color}
                />
              )
            })}
          </div>
        </section>

        {/* Ancestry */}
        {creature.ancestors.length > 0 && (
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ancestry</h2>
            <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              {creature.ancestors.map((a, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-zinc-400 w-4">{i + 1}</span>
                  <span>♂ {a.maleName || `${a.maleDinoId1}_${a.maleDinoId2}`}</span>
                  <span>×</span>
                  <span>♀ {a.femaleName || `${a.femaleDinoId1}_${a.femaleDinoId2}`}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* API cross-link */}
        {creature.apiSlug && (
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Species data:{' '}
              <Link
                href={`/api/creatures/${creature.apiSlug}`}
                className="text-emerald-600 hover:underline font-medium"
                target="_blank"
              >
                /api/creatures/{creature.apiSlug} →
              </Link>
            </p>
          </section>
        )}

        {/* Re-import panel */}
        {showReimport && (
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Re-import</h2>
            <p className="text-xs text-zinc-500">Drop an updated export for this creature to refresh its stats.</p>
            <ImportDropzone onImported={handleReimported} />
          </section>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setShowReimport((v) => !v)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              🔄 Re-import
            </button>
          </div>
          <button
            onClick={handleDelete}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              confirmDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950'
            }`}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </button>
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          ID: {creature.dinoId1}_{creature.dinoId2} ·{' '}
          Imported {new Date(creature.importedAt).toLocaleDateString()} ·{' '}
          Updated {new Date(creature.updatedAt).toLocaleDateString()}
        </p>
      </div>
    </main>
  )
}
