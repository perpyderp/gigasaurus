/** External links shared across the site. */

export const REPO_URL = 'https://github.com/perpyderp/gigasaurus'
export const KOFI_URL = 'https://ko-fi.com/Q0K62ADQWW'

/** GitHub's picker for the issue forms in .github/ISSUE_TEMPLATE. */
export const FEEDBACK_URL = `${REPO_URL}/issues/new/choose`

/**
 * A data-correction issue prefilled for one glossary entry. Field ids match
 * .github/ISSUE_TEMPLATE/data_correction.yml.
 */
export function dataCorrectionUrl(entry: { name: string; page: string }): string {
  const params = new URLSearchParams({
    template: 'data_correction.yml',
    title: `[Data] ${entry.name}: `,
    entry: entry.name,
    page: entry.page,
  })
  return `${REPO_URL}/issues/new?${params}`
}
