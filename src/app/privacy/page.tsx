import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const REPO_URL = 'https://github.com/perpyderp/gigasaurus'
const EFFECTIVE = 'October 21, 2026'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Gigasaurus stores, where it stays, and what is shared with Vercel, Google and GitHub.',
  alternates: { canonical: '/privacy' },
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="marker:text-muted-foreground list-disc space-y-2 pl-5">{children}</ul>
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary font-medium underline-offset-4 hover:underline">
      {children}
    </a>
  )
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl leading-none sm:text-5xl">Privacy policy</h1>
      <p className="text-muted-foreground mt-3 text-[15px]">Effective {EFFECTIVE}</p>

      <div className="mt-10 space-y-10 text-[15px] leading-relaxed">
        <section className="bg-card ring-border rounded-xl p-5 ring-1">
          <h2 className="font-display mb-3 text-xl">The short version</h2>
          <List>
            <li>There are no accounts. Gigasaurus doesn&apos;t ask who you are.</li>
            <li>Creatures you import are stored in your browser, not on our servers.</li>
            <li>They only leave your browser if you choose to back them up to your own Google Drive.</li>
            <li>We count page visits with cookie-free analytics. No advertising, no tracking cookies, and we don&apos;t sell data.</li>
          </List>
        </section>

        <Section title="Who we are">
          <p>
            Gigasaurus is a free, open-source companion site for ARK: Survival Ascended. &ldquo;We&rdquo; means the people who maintain it. The code
            is public on <Ext href={REPO_URL}>GitHub</Ext>, so anything this policy says can be checked against what the site actually does.
          </p>
        </Section>

        <Section title="What stays in your browser">
          <p>The site saves the following on your device, using your browser&apos;s own storage. None of it is sent to us.</p>
          <List>
            <li>
              <strong className="font-semibold">Imported creatures.</strong> Everything read from the export files you import: names and past
              names, species, level, stats, colors, mutations, imprinting, ancestry, and the tribe, owner and imprinter names ARK writes into the
              file.
            </li>
            <li>
              <strong className="font-semibold">Saved folders.</strong> If you save your DinoExports folder, the browser keeps permission to read
              it, along with the folder&apos;s name, whether you&apos;re watching it, and when it was last checked. The site only reads{' '}
              <code className="font-mono text-[13px]">.ini</code> export files from it, and only while My Creatures is open.
            </li>
            <li>
              <strong className="font-semibold">Preferences.</strong> Your light or dark theme, and whether you&apos;ve finished each guided tour.
            </li>
          </List>
          <p>
            To remove it, delete creatures from My Creatures (Select, then Delete), remove saved folders under Import creatures, or clear this
            site&apos;s data in your browser settings, which removes everything at once. Clearing it can&apos;t be undone unless you have a Drive
            backup.
          </p>
          <p>
            Filters and searches are kept in the page address, so they&apos;re in your browser history like any other page you visit.
          </p>
        </Section>

        <Section title="Google Drive backup (optional)">
          <p>
            Backup to Drive and Restore from Drive are off until you click them. When you do, the site loads Google&apos;s sign-in from Google and
            asks for one permission: access to a hidden app folder in your Drive that only Gigasaurus can see. It can&apos;t read or change any of
            your other Drive files.
          </p>
          <List>
            <li>
              A backup is a single file containing your imported creatures, saved to that hidden folder in <em>your</em> Drive. It goes straight
              from your browser to Google; it never passes through our servers.
            </li>
            <li>The sign-in token is kept in memory for that visit only and is never stored or sent to us.</li>
            <li>
              To delete the backup, open Google Drive, go to Settings, then Manage apps, find Gigasaurus and choose Delete hidden app data. You
              can remove the site&apos;s access at <Ext href="https://myaccount.google.com/connections">your Google Account</Ext>.
            </li>
          </List>
          <p>
            Google handles the sign-in and stores the file under <Ext href="https://policies.google.com/privacy">Google&apos;s privacy policy</Ext>.
          </p>
        </Section>

        <Section title="Analytics and hosting">
          <p>
            The site is hosted by <Ext href="https://vercel.com/legal/privacy-policy">Vercel</Ext>. Like any web host, Vercel receives the standard
            details of each request, such as your IP address, browser and the page asked for, to deliver the site and protect it from abuse.
          </p>
          <p>We use two Vercel tools to see how the site is used and how fast it loads:</p>
          <List>
            <li>
              <strong className="font-semibold">Web Analytics</strong> counts page views, with the referring site, country, browser, operating
              system and device type. It doesn&apos;t use cookies or identify you across sites or days.
            </li>
            <li>
              <strong className="font-semibold">Speed Insights</strong> measures load times and responsiveness on the pages you visit.
            </li>
          </List>
          <p>We only see totals, like how many people opened the Ragnarok map this week. We never see your imported creatures.</p>
        </Section>

        <Section title="Content from other sites">
          <p>
            Some in-color creature renders are loaded straight from GitHub (the open{' '}
            <Ext href="https://github.com/arkutils/species-images">arkutils species images</Ext>), so GitHub receives those image requests from
            your browser. Links to the ARK Wiki, Dododex, GitHub and other sites take you to services with their own privacy policies.
          </p>
        </Section>

        <Section title="What we don't do">
          <List>
            <li>We don&apos;t run ads or use advertising or tracking cookies.</li>
            <li>We don&apos;t sell, rent or share personal information.</li>
            <li>We don&apos;t keep your imported creatures, or any copy of them, on our servers.</li>
          </List>
        </Section>

        <Section title="Children">
          <p>
            Gigasaurus isn&apos;t aimed at children under 13 and doesn&apos;t knowingly collect personal information from them. Because there are no
            accounts and imported data stays on the device, there&apos;s nothing for us to collect.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If what the site collects changes, this page will be updated and the effective date above will change with it. Past versions are in
            the project&apos;s history on GitHub.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Ask anything about privacy by <Ext href={`${REPO_URL}/issues`}>opening an issue on GitHub</Ext>. Issues are public, so leave out
            anything you&apos;d rather keep private.
          </p>
        </Section>
      </div>
    </main>
  )
}
