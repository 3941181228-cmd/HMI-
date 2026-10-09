import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { streamImageGeneration } from './image-stream.mjs'
import { handleApi } from './sites-api.mjs'

const bundle = await build({ entryPoints: ['src/services/imageResponse.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { readImageResponse } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

test('image connection responds before model completion and sends waiting heartbeats', async () => {
  let resolve
  const pending = new Promise(r => { resolve = r })
  const response = streamImageGeneration(() => pending, 5)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  assert.match(decoder.decode((await reader.read()).value), /connected/)
  assert.match(decoder.decode((await reader.read()).value), /generating/)
  resolve(Response.json({ ok: true, images: ['fixture'] }))
  assert.match(decoder.decode((await reader.read()).value), /"images":\["fixture"\]/)
  assert.equal((await reader.read()).done, true)
})

test('streamed provider errors preserve status and do not become successful images', async () => {
  const response = streamImageGeneration(() => Response.json({ ok: false, error: 'No model access' }, { status: 403 }))
  assert.deepEqual(await readImageResponse(response), { status: 403, payload: { ok: false, error: 'No model access' } })
})

test('image route supports streaming without changing the provider request or credentials', async () => {
  let calls = 0
  const response = await handleApi(new Request('https://example.test/api/jimeng/text2image', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HMI-Keep-Alive': '1', 'X-Jimeng-Api-Key': 'fixture-key' },
    body: JSON.stringify({ prompt: 'HMI', size: '2K' }),
  }), {}, async (url, options) => {
    calls++
    assert.match(url, /images\/generations$/)
    assert.equal(options.headers.Authorization, 'Bearer fixture-key')
    assert.equal(JSON.parse(options.body).prompt, 'HMI')
    return Response.json({ data: [{ url: 'https://fixture.volces.com/image.png' }] })
  })
  assert.match(response.headers.get('Content-Type'), /event-stream/)
  assert.equal((await readImageResponse(response)).payload.ok, true)
  assert.equal(calls, 1)
})

test('fragmented result frames decode, but premature EOF fails instead of claiming success', async () => {
  const encoder = new TextEncoder()
  const response = new Response(new ReadableStream({ start(c) {
    for (const part of [': heartbeat\n\n', 'event: res', 'ult\ndata: {"status":200,"payload":{"ok":true}}\n', '\n']) c.enqueue(encoder.encode(part))
    c.close()
  } }), { headers: { 'Content-Type': 'text/event-stream' } })
  assert.equal((await readImageResponse(response)).payload.ok, true)
  await assert.rejects(readImageResponse(new Response(': waiting\n\n', { headers: { 'Content-Type': 'text/event-stream' } })), /提前结束/)
})
