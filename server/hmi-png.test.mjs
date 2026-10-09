import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: ['src/services/hmiPng.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { generateHmiPng, defaultPngProvider } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

test('embedded images convert without another network or data URL fetch', async t => {
  const originals = Object.fromEntries(['fetch', 'localStorage', 'document', 'createImageBitmap'].map(k => [k, globalThis[k]]))
  t.after(() => { for (const [k, v] of Object.entries(originals)) globalThis[k] = v })
  let calls = 0
  let closed = false
  globalThis.localStorage = { getItem: () => null }
  globalThis.fetch = async (url, options) => {
    calls++
    assert.equal(url, '/api/jimeng/text2image')
    assert.equal(JSON.parse(options.body).hmi_preview, true)
    return Response.json({ ok: true, images: ['data:image/jpeg;base64,/9j/'] })
  }
  globalThis.createImageBitmap = async blob => {
    assert.equal(blob.type, 'image/jpeg')
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [255, 216, 255])
    return { width: 2, height: 2, close: () => { closed = true } }
  }
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: mime => {
    assert.equal(mime, 'image/png'); return 'data:image/png;base64,fixture'
  } }) }
  assert.deepEqual(await generateHmiPng('HMI', null, 'jimeng'), ['data:image/png;base64,fixture'])
  assert.equal(calls, 1)
  assert.equal(closed, true)
})

test('PNG selection routes text and reference requests to the selected provider without fallback', async t => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  t.after(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage })
  globalThis.localStorage = { getItem: key => key === 'hmi_api_keys'
    ? JSON.stringify({ openaiKey: 'openai-test', arkKey: 'ark-test' })
    : JSON.stringify({ provider: 'openai' }) }
  assert.equal(defaultPngProvider(), 'openai')
  for (const provider of ['jimeng', 'openai', 'ark']) {
    for (const reference of [null, 'data:image/png;base64,dGVzdA==']) {
      const calls = []
      globalThis.fetch = async (url, options) => {
        calls.push(url)
        assert.equal(url, `/api/${provider === 'openai' ? 'openai' : 'jimeng'}/${reference ? 'image2image' : 'text2image'}`)
        assert.equal(options.headers[provider === 'openai' ? 'X-OpenAI-Api-Key' : 'X-Jimeng-Api-Key'], provider === 'openai' ? 'openai-test' : 'ark-test')
        const body = JSON.parse(options.body)
        assert.equal(body.prompt, 'HMI navigation')
        assert.equal(body.image_base64, reference || undefined)
        return Response.json({ ok: false, error: 'Selected provider unavailable' }, { status: 503 })
      }
      await assert.rejects(generateHmiPng('HMI navigation', reference, provider), /Selected provider unavailable/)
      assert.equal(calls.length, 1, 'must not silently retry another provider')
    }
  }
})
