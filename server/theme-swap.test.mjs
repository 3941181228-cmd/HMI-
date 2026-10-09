import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { listFramesNode } from './figma-list-frames-node.mjs'

const bundle = await build({ entryPoints: ['src/services/themeSwap.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { normalizeThemeMapping, listThemeFrames } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

test('mapping import accepts plugin formats and rejects invalid or oversized rules', () => {
  assert.deepEqual(normalizeThemeMapping({ rules: [{ light: { r: 1, g: 0.5, b: 0, a: 0.5 }, dark: '#123456' }] }), [{ name: '颜色 1', light: '#FF800080', dark: '#123456' }])
  for (const input of [[], [{}], [{ light: '#fff', dark: '#000000' }], Array(501).fill({ light: '#FFFFFF', dark: '#000000' }), [{ light: { r: NaN, g: 0, b: 0 }, dark: '#000000' }]]) assert.throws(() => normalizeThemeMapping(input))
})

test('frame reader uses real route and header; rejects HTML, old bridge shapes and errors', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  const url = 'https://www.figma.com/design/abc/Test'
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/figma/list-frames')
    assert.equal(options.headers['X-Figma-Token'], 'test-token')
    assert.equal(JSON.parse(options.body).figmaToken, undefined)
    return Response.json({ ok: true, frames: [{ id: '1:2', name: 'Actual', width: 1920, height: 1080 }], fileName: 'Actual file' })
  }
  assert.equal((await listThemeFrames(url, 'test-token', 0, 2000)).frames[0].id, '1:2')
  for (const response of [new Response('<html>SPA</html>'), Response.json({ filteredFrames: [] }), Response.json({ ok: false, error: 'Denied' }, { status: 403 })]) {
    globalThis.fetch = async () => response
    await assert.rejects(listThemeFrames(url, '', 0, 2000))
  }
  await assert.rejects(listThemeFrames('https://example.com/design/abc', '', 0, 2000))
})

test('Node route adapter retains actual Figma response and credential failure', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  const server = createServer((req, res) => void listFramesNode(req, res, {}))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const address = `http://127.0.0.1:${server.address().port}/api/figma/list-frames`
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/api\.figma\.com\/v1\/files\/abc/)
    assert.equal(options.headers['X-Figma-Token'], 'test-token')
    return Response.json({ name: 'Real file', document: { type: 'DOCUMENT', children: [{ type: 'CANVAS', children: [{ type: 'FRAME', id: '1:2', name: 'Frame', absoluteBoundingBox: { width: 1920, height: 1080 } }] }] } })
  }
  const response = await original(address, { method: 'POST', headers: { 'X-Figma-Token': 'test-token' }, body: JSON.stringify({ fileUrl: 'https://www.figma.com/design/abc/Test' }) })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).frames[0].id, '1:2')
  const missing = await original(address, { method: 'POST', body: '{}' })
  assert.equal(missing.status, 401)
})
