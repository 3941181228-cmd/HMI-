import test from 'node:test'
import assert from 'node:assert/strict'
import { handleApi } from './sites-api.mjs'

const env = { JIMENG_API_KEY: 'test-server-secret' }
const request = (path, data, headers = {}) => new Request(`https://example.test/api/jimeng/${path}`, data === undefined ? { headers } : {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
})

test('default key stays server-side and status reflects upstream authentication', async () => {
  for (const [status, expected] of [[200, true], [401, false], [503, false]]) {
    const result = await handleApi(request('status'), env, async (_, options) => {
      assert.equal(options.headers.Authorization, `Bearer ${env.JIMENG_API_KEY}`)
      return new Response('{}', { status })
    })
    const body = await result.json()
    assert.equal(body.ok, expected)
    assert.equal(body.configured, true)
    assert.ok(!JSON.stringify(body).includes(env.JIMENG_API_KEY))
  }
})

test('text and reference-image requests use the default key and preserve selected size', async () => {
  for (const mode of ['text2image', 'image2image']) {
    const result = await handleApi(request(mode, { prompt: 'A cabin', size: '2560x1440', image_base64: 'YWJj' }), env,
      async (url, options) => {
        assert.equal(url, 'https://ark.cn-beijing.volces.com/api/v3/images/generations')
        assert.equal(options.headers.Authorization, `Bearer ${env.JIMENG_API_KEY}`)
        const body = JSON.parse(options.body)
        assert.equal(body.size, '2560x1440')
        assert.equal(body.model, 'doubao-seedream-5-0-260128')
        if (mode === 'image2image') assert.deepEqual(body.image, ['data:image/png;base64,YWJj'])
        else assert.equal(body.image, undefined)
        return Response.json({ data: [{ url: 'https://image.volces.com/result.png' }] })
      })
    assert.deepEqual(await result.json(), { ok: true, images: ['https://image.volces.com/result.png'] })
  }
})

test('invalid, cross-origin and unconfigured requests make no upstream calls', async () => {
  const noCall = () => { throw new Error('unexpected upstream call') }
  assert.equal((await handleApi(request('text2image', { prompt: 'x' }), {}, noCall)).status, 503)
  assert.equal((await handleApi(request('text2image', {}), env, noCall)).status, 400)
  assert.equal((await handleApi(request('text2image', { prompt: 'x' }, { Origin: 'https://other.test' }), env, noCall)).status, 403)
  assert.equal((await handleApi(request('image2image', { prompt: 'x' }), env, noCall)).status, 400)
  assert.equal((await handleApi(request('text2image'), env, noCall)).status, 405)
  const badDownload = new Request('https://example.test/api/jimeng/download?url=http://localhost/private')
  assert.equal((await handleApi(badDownload, env, noCall)).status, 400)
})

test('empty save validates the configured default and errors never echo the key', async () => {
  const saved = await handleApi(request('save_key', {}), env, async () => Response.json({}))
  assert.equal((await saved.json()).ok, true)
  const failed = await handleApi(request('text2image', { prompt: 'x' }), env,
    async () => Response.json({ error: { message: `Rejected ${env.JIMENG_API_KEY}` } }, { status: 401 }))
  assert.equal(failed.status, 401)
  assert.ok(!(await failed.text()).includes(env.JIMENG_API_KEY))
})

test('a manually entered key supports status, save and generation when no default is deployed', async () => {
  const manualKey = 'manual-browser-key'
  const withKey = (path, data) => request(path, data, { 'X-Jimeng-Api-Key': manualKey })
  const upstream = async (_, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${manualKey}`)
    return options.method === 'POST' ? Response.json({ data: [{ url: 'https://image.volces.com/manual.png' }] }) : Response.json({})
  }
  assert.equal((await (await handleApi(withKey('status'), {}, upstream)).json()).ok, true)
  assert.equal((await (await handleApi(withKey('save_key', { api_key: manualKey }), {}, upstream)).json()).ok, true)
  assert.equal((await (await handleApi(withKey('text2image', { prompt: 'test' }), {}, upstream)).json()).ok, true)
})

test('a configured server default is not replaced by a stale browser key', async () => {
  const response = await handleApi(request('status', undefined, { 'X-Jimeng-Api-Key': 'stale-browser-key' }), env,
    async (_, options) => {
      assert.equal(options.headers.Authorization, `Bearer ${env.JIMENG_API_KEY}`)
      return Response.json({})
    })
  assert.equal((await response.json()).ok, true)
})

test('saving a manual key validates that candidate even when a default is deployed', async () => {
  const manualKey = 'manual-browser-key'
  const response = await handleApi(request('save_key', { api_key: manualKey }, { 'X-Jimeng-Api-Key': manualKey }), env,
    async (_, options) => {
      assert.equal(options.headers.Authorization, `Bearer ${manualKey}`)
      return Response.json({}, { status: 401 })
    })
  assert.deepEqual(await response.json(), {
    ok: false,
    configured: true,
    credit: 'API Key 无效或已过期',
    message: 'API Key 无效或已过期',
  })
})

test('the save endpoint accepts a body-only manual key without a deployed default', async () => {
  const manualKey = 'body-only-key'
  const response = await handleApi(request('save_key', { api_key: manualKey }), {}, async (_, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${manualKey}`)
    return Response.json({})
  })
  assert.equal((await response.json()).ok, true)
})
