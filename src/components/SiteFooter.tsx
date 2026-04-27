import Link from 'next/link'
import { IconBrandGithub, IconBook, IconApi } from '@tabler/icons-react'
import { Separator } from '@/components/ui/separator'

const REPO_URL = 'https://github.com/perpyderp/gigasaurus'

export function SiteFooter() {
  return (
    <footer className="border-border bg-background/60 mt-12 border-t">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold tracking-wide">Gigasaurus</h3>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              An open-source ARK: Survival Ascended companion — REST API, creature browser,
              and a local-first creature manager.
            </p>
          </div>

          <div>
            <h3 className="text-foreground text-sm font-semibold tracking-wide">Browse</h3>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li><Link href="/creatures" className="text-muted-foreground hover:text-foreground">Creatures</Link></li>
              <li><Link href="/armor" className="text-muted-foreground hover:text-foreground">Armor</Link></li>
              <li><Link href="/weapons" className="text-muted-foreground hover:text-foreground">Weapons</Link></li>
              <li><Link href="/resources" className="text-muted-foreground hover:text-foreground">Resources</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-foreground text-sm font-semibold tracking-wide">Developers</h3>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li>
                <Link href="/api/openapi" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                  <IconApi size={12} /> API Docs
                </Link>
              </li>
              <li>
                <a
                  href={`${REPO_URL}/tree/main/docs`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <IconBook size={12} /> Project Docs
                </a>
              </li>
              <li>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <IconBrandGithub size={12} /> Source Code
                </a>
              </li>
              <li>
                <a
                  href={`${REPO_URL}/issues`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Report an Issue
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-foreground text-sm font-semibold tracking-wide">Resources</h3>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li>
                <a
                  href="https://ark.wiki.gg/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  ARK Wiki
                </a>
              </li>
              <li>
                <a
                  href="https://www.dododex.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Dododex
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/cadon/ARKStatsExtractor"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  ARK Smart Breeding
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col items-center justify-between gap-2 text-[11px] sm:flex-row">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} Gigasaurus. Not affiliated with Studio Wildcard.
          </p>
          <p className="text-muted-foreground">
            ARK: Survival Ascended is a trademark of Studio Wildcard.
          </p>
        </div>
      </div>
    </footer>
  )
}
