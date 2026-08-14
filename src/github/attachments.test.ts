import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { AttachmentUploader, mimeTypeFor, FetchLike } from './attachments'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'attachments-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

/** Write a file of a given size and return its path. */
function writeFile(name: string, bytes = 16): string {
  const filePath = path.join(tmpDir, name)
  fs.writeFileSync(filePath, Buffer.alloc(bytes, 1))
  return filePath
}

/** A fetch stub that records calls and replays canned responses. */
function stubFetch(responses: Array<{ ok: boolean; status: number; body: string }>) {
  const calls: string[] = []
  const headers: Array<Record<string, string>> = []
  const impl: FetchLike = async (url, init) => {
    calls.push(url)
    headers.push(init.headers)
    const next = responses.shift() ?? { ok: true, status: 201, body: '{"url":"https://example.test/a"}' }
    return {
      ok: next.ok,
      status: next.status,
      text: async () => next.body,
    }
  }
  return { impl, calls, headers }
}

describe('mimeTypeFor', () => {
  it('maps the image types GitHub renders inline', () => {
    expect(mimeTypeFor('a/b/diff.png')).toBe('image/png')
    expect(mimeTypeFor('shot.JPEG')).toBe('image/jpeg')
    expect(mimeTypeFor('clip.webm')).toBe('video/webm')
  })

  it('falls back to a generic type for anything else', () => {
    expect(mimeTypeFor('report.txt')).toBe('application/octet-stream')
  })
})

describe('AttachmentUploader', () => {
  it('is off without a token, which is the normal case', async () => {
    const uploader = new AttachmentUploader({ repositoryId: '1' })
    expect(uploader.enabled).toBe(false)
    expect(uploader.disabledReason).toMatch(/no upload token/)
    expect(await uploader.upload(writeFile('a.png'))).toBeNull()
  })

  it('is off without a repository ID', () => {
    const uploader = new AttachmentUploader({ token: 't' })
    expect(uploader.enabled).toBe(false)
    expect(uploader.disabledReason).toMatch(/repository ID/)
  })

  it('returns the asset URL and passes the endpoint what it needs', async () => {
    const { impl, calls } = stubFetch([
      { ok: true, status: 201, body: '{"url":"https://github.com/user-attachments/assets/abc"}' },
    ])
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '42', fetchImpl: impl })

    const url = await uploader.upload(writeFile('diff.png'))

    expect(url).toBe('https://github.com/user-attachments/assets/abc')
    expect(calls[0]).toContain('repository_id=42')
    expect(calls[0]).toContain('content_type=image%2Fpng')
    expect(calls[0]).toContain('name=diff.png')
    expect(uploader.getStats().uploaded).toBe(1)
  })

  it('sends a Content-Type, which the endpoint rejects the request without', async () => {
    // Node's fetch sends no Content-Type for a Buffer body, and the endpoint
    // answers 400 "Invalid Content-Type" when it is missing.
    const { impl, headers } = stubFetch([])
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl })

    await uploader.upload(writeFile('diff.png'))

    expect(headers[0]['Content-Type']).toBe('image/png')
  })

  it('reports the response body when the endpoint refuses', async () => {
    const { impl } = stubFetch([
      { ok: false, status: 400, body: '{"message":"Invalid Content-Type"}' },
    ])
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl })

    await uploader.upload(writeFile('a.png'))

    expect(uploader.disabledReason).toContain('Invalid Content-Type')
  })

  it('accepts href as well as url, since write-ups disagree', async () => {
    const { impl } = stubFetch([{ ok: true, status: 201, body: '{"href":"https://example.test/h"}' }])
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl })

    expect(await uploader.upload(writeFile('a.png'))).toBe('https://example.test/h')
  })

  it('stops for the rest of the run after one failure', async () => {
    const { impl, calls } = stubFetch([{ ok: false, status: 404, body: '{"message":"Not Found"}' }])
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl })

    expect(await uploader.upload(writeFile('one.png'))).toBeNull()
    expect(uploader.enabled).toBe(false)
    expect(uploader.disabledReason).toMatch(/HTTP 404/)

    // The second attempt must not reach the endpoint at all.
    expect(await uploader.upload(writeFile('two.png'))).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it('stops when the endpoint answers without a URL', async () => {
    const { impl } = stubFetch([{ ok: true, status: 200, body: 'not json' }])
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl })

    expect(await uploader.upload(writeFile('a.png'))).toBeNull()
    expect(uploader.disabledReason).toMatch(/no URL/)
  })

  it('stops rather than throwing when fetch rejects', async () => {
    const impl: FetchLike = async () => {
      throw new Error('socket hang up')
    }
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl })

    expect(await uploader.upload(writeFile('a.png'))).toBeNull()
    expect(uploader.disabledReason).toMatch(/socket hang up/)
  })

  it('enforces the upload count budget and says so', async () => {
    const { impl } = stubFetch([])
    const uploader = new AttachmentUploader({
      token: 't',
      repositoryId: '1',
      maxUploads: 1,
      fetchImpl: impl,
    })

    expect(await uploader.upload(writeFile('one.png'))).not.toBeNull()
    expect(await uploader.upload(writeFile('two.png'))).toBeNull()
    expect(uploader.disabledReason).toMatch(/upload limit of 1/)
  })

  it('enforces the byte budget', async () => {
    const { impl } = stubFetch([])
    const uploader = new AttachmentUploader({
      token: 't',
      repositoryId: '1',
      maxTotalBytes: 100,
      fetchImpl: impl,
    })

    expect(await uploader.upload(writeFile('small.png', 60))).not.toBeNull()
    expect(await uploader.upload(writeFile('big.png', 60))).toBeNull()
    expect(uploader.disabledReason).toMatch(/byte budget/)
  })

  it('skips an unreadable file without giving up on the rest', async () => {
    const { impl } = stubFetch([])
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl })

    expect(await uploader.upload(path.join(tmpDir, 'missing.png'))).toBeNull()
    expect(uploader.enabled).toBe(true)
    expect(await uploader.upload(writeFile('present.png'))).not.toBeNull()
  })

  it('reduces awkward file names to something a query string can carry', async () => {
    const { impl, calls } = stubFetch([])
    const uploader = new AttachmentUploader({ token: 't', repositoryId: '1', fetchImpl: impl })

    await uploader.upload(writeFile('weird.png'), 'homepage renders "correctly" & fast.png')

    expect(calls[0]).toContain('name=homepage-renders-correctly-fast.png')
  })
})
