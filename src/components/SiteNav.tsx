'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'

const LINKS = [
  { href: '/creatures', label: 'Creatures' },
  { href: '/armor', label: 'Armor' },
  { href: '/weapons', label: 'Weapons' },
  { href: '/resources', label: 'Resources' },
  { href: '/my-creatures', label: 'My Creatures' },
]

function NavLinks({ pathname }: { pathname: string }) {
  return LINKS.map(({ href, label }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`)
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`relative flex h-full shrink-0 items-center px-3 text-[15px] font-medium transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full ${
          active
            ? 'text-foreground after:bg-primary'
            : 'text-muted-foreground hover:text-foreground after:bg-transparent'
        }`}
      >
        {label}
      </Link>
    )
  })
}

export function SiteNav() {
  const pathname = usePathname()

  return (
    <header className="bg-background/85 border-border sticky top-0 z-20 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
        <Link href="/" className="mr-3 flex shrink-0 items-center gap-2.5" aria-label="Gigasaurus home">
          <Image src="/giga-glasses.png" alt="" width={30} height={30} className="rounded-sm" />
          <span className="font-display text-foreground text-xl">Gigasaurus</span>
        </Link>
        <nav aria-label="Main" className="hidden h-full items-stretch md:flex">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/api/openapi"
            className="text-muted-foreground hover:text-foreground hidden px-2 text-sm transition-colors sm:block"
          >
            API docs
          </Link>
          <ThemeToggle />
        </div>
      </div>
      {/* Phones: links get their own swipeable row instead of overflowing the header. */}
      <nav
        aria-label="Main"
        className="border-border flex h-11 items-stretch overflow-x-auto border-t px-1 [scrollbar-width:none] md:hidden"
      >
        <NavLinks pathname={pathname} />
      </nav>
    </header>
  )
}
