import assert from 'node:assert/strict'
import test from 'node:test'

let fetchImageObjectUrl
let fileBinaryPath
try {
  ({ fetchImageObjectUrl, fileBinaryPath } = await import('../src/api/fileBinary.js'))
} catch {
  // RED phase: assertions below expose the missing binary helper.
}

test('thumbnail request uses the frozen path and accepts an image response', async () => {
  assert.equal(typeof fetchImageObjectUrl, 'function')
  const calls = []
  const url = await fetchImageObjectUrl({
    apiBase: 'http://example.test',
    fileId: 42,
    variant: 'thumbnail',
    fetchImpl: async (requestUrl) => {
      calls.push(requestUrl)
      return new Response(new Blob(['image']), {
        status: 200,
        headers: { 'Content-Type': 'image/webp' }
      })
    },
    createObjectUrl: () => 'blob:42'
  })

  assert.equal(url, 'blob:42')
  assert.deepEqual(calls, ['http://example.test/files/42/thumbnail'])
})

test('HTTP 200 JSON is rejected before blob conversion', async () => {
  assert.equal(typeof fetchImageObjectUrl, 'function')
  await assert.rejects(() => fetchImageObjectUrl({
    apiBase: 'http://example.test',
    fileId: 404,
    variant: 'thumbnail',
    fetchImpl: async () => new Response('{"code":40401}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }),
    createObjectUrl: () => { throw new Error('must not create object URL') }
  }), error => error.status === 200 && error.contentType === 'application/json')
})

test('non-2xx image response is rejected with transport metadata', async () => {
  assert.equal(typeof fetchImageObjectUrl, 'function')
  await assert.rejects(() => fetchImageObjectUrl({
    apiBase: 'http://example.test',
    fileId: 7,
    variant: 'medium',
    fetchImpl: async () => new Response(new Blob(['missing']), {
      status: 404,
      headers: { 'Content-Type': 'image/webp' }
    })
  }), error => error.status === 404 && error.contentType === 'image/webp')
})

test('invalid variant is rejected before fetch', async () => {
  assert.equal(typeof fetchImageObjectUrl, 'function')
  let fetched = false
  await assert.rejects(() => fetchImageObjectUrl({
    apiBase: 'http://example.test',
    fileId: 7,
    variant: 'tiny',
    fetchImpl: async () => {
      fetched = true
      throw new Error('must not fetch')
    }
  }), /Invalid image variant: tiny/)
  assert.equal(fetched, false)
})

test('AbortSignal and bearer token are forwarded', async () => {
  assert.equal(typeof fetchImageObjectUrl, 'function')
  const controller = new AbortController()
  let options
  await fetchImageObjectUrl({
    apiBase: 'http://example.test',
    fileId: 9,
    variant: 'original',
    token: 'token-9',
    signal: controller.signal,
    fetchImpl: async (_url, requestOptions) => {
      options = requestOptions
      return new Response(new Blob(['image']), {
        status: 200,
        headers: { 'Content-Type': 'image/png; charset=binary' }
      })
    },
    createObjectUrl: () => 'blob:9'
  })

  assert.equal(options.signal, controller.signal)
  assert.deepEqual(options.headers, { Authorization: 'Bearer token-9' })
})

test('default path preserves legacy download behavior', () => {
  assert.equal(typeof fileBinaryPath, 'function')
  assert.equal(fileBinaryPath(11), '/files/11/download')
  assert.equal(fileBinaryPath('12', 'thumbnail'), '/files/12/thumbnail')
  assert.equal(fileBinaryPath('12', 'medium'), '/files/12/medium')
  assert.equal(fileBinaryPath('12', 'original'), '/files/12/original')
  assert.throws(() => fileBinaryPath(0), /Invalid fileId/)
})
