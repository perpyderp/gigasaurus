import type { TourStep } from '@/components/tour/Tour'

const path = (p: string) => <code className="text-foreground font-mono text-[13px]">{p}</code>

/**
 * The My Creatures tour. Targets are `data-tour` attributes on the page; steps
 * whose element isn't shown (an empty collection has no filters or cards yet)
 * appear centered, so the copy reads on its own either way.
 */
export function myCreaturesTourSteps({ openImport, openFilters }: { openImport: () => void; openFilters: () => void }): TourStep[] {
  return [
    {
      title: 'Your tames, read from ARK',
      body: (
        <>
          <p>My Creatures reads the export files ARK saves for your tames and works out their wild, tamed and mutated levels.</p>
          <p>This tour covers importing, finding creatures, breeding plans and a few extras. Everything stays in this browser.</p>
        </>
      ),
    },
    {
      target: 'import-button',
      title: 'Export in ARK first',
      body: (
        <p>
          In game, open a creature&apos;s options wheel and choose Export. ARK writes a .ini file to {path('ShooterGame/Saved/DinoExports')}. Then
          bring it in here with Import creatures.
        </p>
      ),
    },
    {
      target: 'import-dropzone',
      onEnter: openImport,
      title: 'Drop files or a whole folder',
      body: (
        <p>
          Drop one .ini or many, or the whole DinoExports folder. An export you&apos;ve imported before updates that creature instead of adding a
          copy, so re-exporting after a level-up keeps everything current.
        </p>
      ),
    },
    {
      target: 'saved-folders',
      onEnter: openImport,
      side: 'top',
      title: 'Save the folder, then watch it',
      body: (
        <>
          <p>Add your DinoExports folder once to re-import everything in it with one click.</p>
          <p>Turn on Watch and new exports import by themselves while this page is open, even with ARK in front. Works in Chrome, Edge and Brave.</p>
        </>
      ),
    },
    {
      target: 'drive-sync',
      onEnter: openImport,
      side: 'top',
      title: 'Back up to Google Drive',
      body: (
        <p>
          Your creatures live only in this browser. Back them up to Drive to keep them safe, or restore them on another computer. The backup sits in a
          private app folder, separate from your Drive files.
        </p>
      ),
    },
    {
      target: 'search',
      title: 'Search your tames',
      body: <p>Find creatures by name, species or tribe. Species search knows alternate names too, so Bog Spider finds your Bloodstalkers.</p>,
    },
    {
      target: 'filter-panel',
      onEnter: openFilters,
      title: 'Filter and sort',
      body: (
        <p>
          Narrow by species, gender or mutations, and sort by level, health, melee or mutation count. Filters live in the page address, so a bookmark
          brings the same view back.
        </p>
      ),
    },
    {
      target: 'card-view',
      side: 'left',
      title: 'Dossier or in color',
      body: <p>Switch the cards between each species&apos; dossier art and a render of the creature in its own colors.</p>,
    },
    {
      target: 'creature-grid',
      side: 'top',
      title: 'Read a card',
      body: (
        <>
          <p>Each bar compares a stat with the best you own of that species. A crown means the creature holds one of those bests.</p>
          <p>Open a card for the full breakdown: wild, tamed and mutated points per stat, parents, ancestry and past names.</p>
        </>
      ),
    },
    {
      target: 'select',
      title: 'Work on many at once',
      body: <p>Select creatures to refresh them from their export files or delete them together.</p>,
    },
    {
      target: 'breeding-link',
      title: 'Plan your breeding',
      body: (
        <p>
          The breeding planner shows the best stats you own for each species, ranks the pairs to breed next, and gives the odds of a baby inheriting
          what you want. It appears here once you&apos;ve imported creatures.
        </p>
      ),
    },
    {
      title: 'Your tames on species pages',
      body: <p>Each creature&apos;s page in the Creatures guide lists the ones you own, with their levels, mutations and imprinting.</p>,
    },
    {
      target: 'tour-button',
      title: 'Come back any time',
      body: <p>Take this tour again from here whenever you need a refresher.</p>,
    },
  ]
}
