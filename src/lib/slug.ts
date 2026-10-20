/**
 * Turns a user-typed name into the slug used for data files, so lookups accept
 * `Rex`, `dire bear`, `Dire-Bear` and `dire_bear` alike.
 */
export function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, '_')
}
