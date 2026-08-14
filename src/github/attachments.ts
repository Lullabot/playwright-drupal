import * as fs from 'fs'
import * as path from 'path'

/**
 * Uploads files to GitHub's user-attachments endpoint — the programmatic
 * equivalent of dragging an image into a comment box, which is the only way to
 * get an image into a job summary or a PR comment.
 *
 * The endpoint is undocumented, and two things about it drive this design:
 *
 * 1. It only accepts *user* tokens. The Actions `GITHUB_TOKEN` and GitHub App
 *    installation tokens are both refused with a 404, so the feature is opt-in
 *    behind a PAT and every caller must cope with it being switched off.
 * 2. The URL it returns is a renderer-only handle. Fetching it directly is a
 *    404 with or without credentials; GitHub rewrites it to a signed, short
 *    lived URL when it renders the surrounding Markdown. Never try to verify
 *    an upload by reading it back — a 201 with a URL in the body is the only
 *    success signal there is.
 *
 * Because it is undocumented it may also change or vanish without notice, so a
 * single failure disables the uploader for the rest of the run rather than
 * retrying against an endpoint that has gone away.
 */

const UPLOAD_ORIGIN = 'https://uploads.github.com'
const DEFAULT_MAX_UPLOADS = 20
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 15_000

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
}

/** The subset of `fetch` this module uses, so tests can substitute their own. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: Buffer; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export interface AttachmentUploaderOptions {
  /**
   * A user PAT. Installation tokens (including the Actions GITHUB_TOKEN) are
   * rejected by the endpoint, so leaving this unset is the normal case.
   */
  token?: string
  /** Numeric repository ID — `GITHUB_REPOSITORY_ID` in Actions, not `owner/repo`. */
  repositoryId?: string | number
  /** Stop after this many uploads in one run. Defaults to 20. */
  maxUploads?: number
  /** Stop once this many bytes have been uploaded. Defaults to 20 MiB. */
  maxTotalBytes?: number
  /** Per-request timeout. Defaults to 15 seconds. */
  timeoutMs?: number
  fetchImpl?: FetchLike
  log?: (message: string) => void
}

export interface UploadStats {
  uploaded: number
  skipped: number
  bytes: number
}

/**
 * Guess a MIME type from a file extension. The endpoint requires one, and it
 * is what decides whether GitHub renders the attachment inline.
 */
export function mimeTypeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export class AttachmentUploader {
  private readonly token: string
  private readonly repositoryId: string
  private readonly maxUploads: number
  private readonly maxTotalBytes: number
  private readonly timeoutMs: number
  private readonly fetchImpl: FetchLike
  private readonly log: (message: string) => void

  private disabled: boolean
  private reason: string | null = null
  private stats: UploadStats = { uploaded: 0, skipped: 0, bytes: 0 }

  constructor(options: AttachmentUploaderOptions = {}) {
    this.token = String(options.token ?? '')
    this.repositoryId = String(options.repositoryId ?? '')
    this.maxUploads = options.maxUploads ?? DEFAULT_MAX_UPLOADS
    this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
    this.log = options.log ?? (() => {})

    if (!this.token) {
      this.disabled = true
      this.reason = 'no upload token configured'
    } else if (!this.repositoryId) {
      this.disabled = true
      this.reason = 'no repository ID available'
    } else {
      this.disabled = false
    }
  }

  get enabled(): boolean {
    return !this.disabled
  }

  /** Why uploads stopped, or null while they are still running. */
  get disabledReason(): string | null {
    return this.reason
  }

  getStats(): UploadStats {
    return { ...this.stats }
  }

  /**
   * Upload one file and return the URL to embed, or null if the upload did not
   * happen. Never throws and never rejects: a broken undocumented endpoint
   * must not fail anyone's build.
   */
  async upload(filePath: string, displayName?: string): Promise<string | null> {
    if (this.disabled) {
      this.stats.skipped++
      return null
    }

    let body: Buffer
    try {
      body = fs.readFileSync(filePath)
    } catch {
      // A missing file is this file's problem, not a reason to stop the run.
      this.stats.skipped++
      this.log(`Attachment upload skipped, unreadable file: ${filePath}`)
      return null
    }

    return this.uploadBuffer(body, displayName ?? path.basename(filePath), mimeTypeFor(filePath))
  }

  /**
   * Upload bytes that never touched the disk. Playwright's JSON reporter
   * inlines attachments added with `testInfo.attach({ body })` as base64, which
   * is how the accessibility screenshots arrive.
   */
  async uploadBuffer(body: Buffer, displayName: string, contentType: string): Promise<string | null> {
    if (this.disabled) {
      this.stats.skipped++
      return null
    }

    const size = body.length

    // Budgets are a deliberate stop, so say so rather than going quiet.
    if (this.stats.uploaded >= this.maxUploads) {
      return this.disable(`upload limit of ${this.maxUploads} reached`)
    }
    if (this.stats.bytes + size > this.maxTotalBytes) {
      return this.disable(`byte budget of ${this.maxTotalBytes} bytes reached`)
    }

    const name = sanitizeName(displayName)
    const query = new URLSearchParams({
      name,
      content_type: contentType,
      repository_id: this.repositoryId,
    })

    try {
      const response = await this.fetchImpl(`${UPLOAD_ORIGIN}/user-attachments/assets?${query}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          // Required. Without it the endpoint answers 400 "Invalid
          // Content-Type", and fetch sends no default for a Buffer body.
          'Content-Type': contentType,
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      })

      const text = await response.text()
      if (!response.ok) {
        return this.disable(
          `HTTP ${response.status} from the attachments endpoint: ${summarize(text)}`,
        )
      }

      const url = parseUploadUrl(text)
      if (!url) {
        return this.disable('the attachments endpoint returned no URL')
      }

      this.stats.uploaded++
      this.stats.bytes += size
      return url
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return this.disable(`upload failed: ${message}`)
    }
  }

  /** Switch the uploader off for the rest of the run and say why. */
  private disable(reason: string): null {
    this.disabled = true
    this.reason = reason
    this.stats.skipped++
    this.log(`Attachment uploads disabled — ${reason}.`)
    return null
  }
}

/**
 * Pull the asset URL out of a response body. The endpoint has been seen to
 * answer with `url`; `href` appears in third-party write-ups, so accept both.
 */
function parseUploadUrl(text: string): string | null {
  try {
    const parsed = JSON.parse(text)
    const url = parsed?.url ?? parsed?.href ?? parsed?.asset?.href
    return typeof url === 'string' && url ? url : null
  } catch {
    return null
  }
}

/** Condense a response body into one line worth putting in a CI log. */
function summarize(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (!collapsed) return 'no response body'
  return collapsed.length > 200 ? `${collapsed.slice(0, 200)}…` : collapsed
}

/**
 * Trim leading and trailing dashes.
 *
 * An index scan rather than `/^-+|-+$/`, because that pattern backtracks
 * quadratically over a long run of dashes and this input is derived from test
 * titles — which nobody controls.
 */
function trimDashes(value: string): string {
  let start = 0
  let end = value.length
  while (start < end && value[start] === '-') start++
  while (end > start && value[end - 1] === '-') end--
  return value.slice(start, end)
}

/**
 * Reduce a file name to something safe to put in a query string. Test titles
 * reach this by way of snapshot file names and can contain anything.
 */
function sanitizeName(name: string): string {
  // Truncate before trimming, so a trailing dash left by the cut goes too.
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120)
  return trimDashes(cleaned) || 'attachment'
}
