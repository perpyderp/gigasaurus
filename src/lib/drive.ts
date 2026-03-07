/**
 * Google Drive AppData sync for Gigasaurus creature exports.
 *
 * Uses the Google Identity Services (GSI) token client entirely in the browser —
 * no server required. The backup file is stored in the hidden AppData space
 * so it never appears in the user's Drive root.
 *
 * File: appDataFolder/gigasaurus-creatures.json
 *
 * Setup:
 *   1. Create a Google Cloud project and enable the Drive API.
 *   2. Create an OAuth 2.0 Client ID (Web application type).
 *   3. Add your domain to Authorised JavaScript origins.
 *   4. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local.
 */

import type { StoredCreature } from './db'

const BACKUP_FILENAME = 'gigasaurus-creatures.json'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

// ─── Token management ──────────────────────────────────────────────────────────

let _accessToken: string | null = null
let _tokenClient: google.accounts.oauth2.TokenClient | null = null

declare global {
  interface Window {
    google: typeof google
    onGoogleLibraryLoad?: () => void
  }
}

/** Load the GSI script dynamically. Resolves when `window.google` is ready. */
export function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Not in browser'))
    if (window.google?.accounts) return resolve()

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

/**
 * Request an OAuth access token with Drive AppData scope.
 * Opens a Google consent popup the first time; subsequent calls are silent.
 */
export function requestToken(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      reject(new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set'))
      return
    }

    await loadGoogleScript()

    if (!_tokenClient) {
      _tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error))
          } else {
            _accessToken = response.access_token
            resolve(response.access_token)
          }
        },
      })
    }

    if (_accessToken) {
      resolve(_accessToken)
    } else {
      _tokenClient.requestAccessToken({ prompt: 'none' })
    }
  })
}

/** Force a fresh token (e.g. after a 401). */
export function revokeToken() {
  _accessToken = null
}

// ─── Drive API helpers ─────────────────────────────────────────────────────────

async function driveRequest(
  url: string,
  options: RequestInit,
  token: string
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    revokeToken()
    throw new Error('Google Drive token expired. Please sign in again.')
  }
  return res
}

async function findBackupFileId(token: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${BACKUP_FILENAME}'`,
    fields: 'files(id)',
  })
  const res = await driveRequest(`${DRIVE_API}/files?${params}`, {}, token)
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`)
  const { files } = await res.json()
  return files?.[0]?.id ?? null
}

// ─── Public sync API ───────────────────────────────────────────────────────────

export interface SyncResult {
  uploaded: number
  downloaded: number
  merged: number
}

/**
 * Upload creatures to Drive AppData, creating or updating the backup file.
 * Returns the number of creatures uploaded.
 */
export async function uploadToDrive(creatures: StoredCreature[]): Promise<number> {
  const token = await requestToken()
  const body = JSON.stringify(creatures)
  const existing = await findBackupFileId(token)

  if (existing) {
    // PATCH to update existing file
    const res = await driveRequest(
      `${DRIVE_UPLOAD_API}/files/${existing}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
      token
    )
    if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`)
  } else {
    // POST multipart to create with metadata
    const metadata = JSON.stringify({ name: BACKUP_FILENAME, parents: ['appDataFolder'] })
    const boundary = 'gigasaurus_boundary'
    const multipart =
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
      `--${boundary}--`

    const res = await driveRequest(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      },
      token
    )
    if (!res.ok) throw new Error(`Drive create failed: ${res.status}`)
  }

  return creatures.length
}

/**
 * Download creatures from Drive AppData backup.
 * Returns null if no backup exists yet.
 */
export async function downloadFromDrive(): Promise<StoredCreature[] | null> {
  const token = await requestToken()
  const fileId = await findBackupFileId(token)
  if (!fileId) return null

  const res = await driveRequest(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    {},
    token
  )
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`)

  const data = await res.json()
  if (!Array.isArray(data)) return null
  return data as StoredCreature[]
}
