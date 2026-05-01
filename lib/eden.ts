/**
 * Elysia Eden treaty client — provides end-to-end type safety for all API calls.
 *
 * Usage (client components):
 *   import { api } from '@/lib/eden'
 *   const { data, error } = await api.creatures.get()
 *   const { data } = await api.creatures({ slug: 'rex' }).get()
 *
 * The `App` type is exported for use with `edenFetch` or custom wrappers.
 */
import { treaty } from '@elysiajs/eden'
import type { app } from '@/app/api/[[...slugs]]/route'

export type App = typeof app

function getBaseUrl(): string {
  // Browser: same origin
  if (typeof window !== 'undefined') return window.location.origin
  // SSR / scripts: from env, fallback to localhost
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export const api = treaty<App>(getBaseUrl())
