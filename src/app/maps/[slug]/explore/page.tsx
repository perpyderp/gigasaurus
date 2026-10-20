import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MapService } from '@/services/map'
import { MapView, type MapQuery } from '../map-view'

/**
 * The map with something picked, for any /maps/<slug>?… URL (rewritten here by
 * next.config.ts, so the browser keeps the query-string URL). Canonical points
 * at the static page that shows the same thing.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<MapQuery>
}): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const map = MapService.getBySlug(slug)
  if (!map) return { title: 'Map Not Found' }
  const onlyCreature = query.creature && !query.resource && !query.place && !query.q
  const spawnPage = onlyCreature && map.creatures.some((c) => c.creature === query.creature)
  return {
    title: `${map.name} Map`,
    alternates: { canonical: spawnPage ? `/maps/${map.slug}/${query.creature}` : `/maps/${map.slug}` },
  }
}

export default async function MapExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<MapQuery>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const map = MapService.getBySlug(slug)
  if (!map) notFound()
  return <MapView map={map} query={query} />
}
