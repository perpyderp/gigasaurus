import Link from 'next/link'
import type { ReactNode } from 'react'

const REPO_URL = 'https://github.com/perpyderp/gigasaurus'

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: 'Browse',
    links: [
      { label: 'Creatures', href: '/creatures' },
      { label: 'Armor', href: '/armor' },
      { label: 'Weapons', href: '/weapons' },
      { label: 'Resources', href: '/resources' },
      { label: 'My Creatures', href: '/my-creatures' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'API reference', href: '/api/openapi' },
      { label: 'Project docs', href: `${REPO_URL}/tree/main/docs`, external: true },
      { label: 'Source code', href: REPO_URL, external: true },
      { label: 'Report an issue', href: `${REPO_URL}/issues`, external: true },
      { label: 'Privacy policy', href: '/privacy' },
    ],
  },
  {
    title: 'Other ARK tools',
    links: [
      { label: 'ARK Wiki', href: 'https://ark.wiki.gg/', external: true },
      { label: 'Dododex', href: 'https://www.dododex.com/', external: true },
      { label: 'ARK Smart Breeding', href: 'https://github.com/cadon/ARKStatsExtractor', external: true },
    ],
  },
]

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: ReactNode }) {
  const className = 'text-muted-foreground hover:text-foreground transition-colors'
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>
  ) : (
    <Link href={href} className={className}>{children}</Link>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-border mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="max-w-sm">
            <p className="font-display text-2xl">Gigasaurus</p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              A free, open-source companion for ARK: Survival Ascended. Your imported creatures stay in your browser unless you back them up to your own Google Drive.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold">{col.title}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink href={l.href} external={l.external}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border text-muted-foreground mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Gigasaurus. Not affiliated with Studio Wildcard.</p>
          <p>ARK: Survival Ascended is a trademark of Studio Wildcard.</p>
        </div>
      </div>
    </footer>
  )
}
