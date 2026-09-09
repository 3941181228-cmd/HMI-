import test from 'node:test'
import assert from 'node:assert/strict'
import { handleApi } from './sites-api.mjs'

const env = { JIMENG_API_KEY: 'test-server-secret' }
const figmaEnv = { FIGMA_API_TOKEN: 'test-figma-secret' }
const openAIEnv = { OPENAI_API_KEY: 'test-openai-secret' }
const request = (path, data, headers = {}) => new Request(`https://example.test/api/jimeng/${path}`, data === undefined ? { headers } : {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
})
const figmaRequest = (path, headers = {}) => new Request(`https://example.test/api/figma/${path}`, { headers })
const openAIRequest = (path, data, headers = {}) => new Request(`https://example.test/api/openai/${path}`, data === undefined ? { headers } : {
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

test('Figma routes use the server default and preserve safe file queries', async () => {
  const calls = []
  const upstream = async (url, options) => {
    calls.push({ url, token: options.headers['X-Figma-Token'] })
    return Response.json(url.endsWith('/me') ? { id: 'user-1', handle: 'Designer' } : { name: 'Dashboard' })
  }
  const me = await handleApi(figmaRequest('me', { 'X-Figma-Token': 'stale-browser-token' }), figmaEnv, upstream)
  assert.equal((await me.json()).handle, 'Designer')
  const file = await handleApi(figmaRequest('files/abc_123?depth=2'), figmaEnv, upstream)
  assert.equal((await file.json()).name, 'Dashboard')
  assert.deepEqual(calls, [
    { url: 'https://api.figma.com/v1/me', token: figmaEnv.FIGMA_API_TOKEN },
    { url: 'https://api.figma.com/v1/files/abc_123?depth=2', token: figmaEnv.FIGMA_API_TOKEN },
  ])
})

test('manual Figma validation checks the candidate without replacing the default', async () => {
  const response = await handleApi(figmaRequest('validate', { 'X-Figma-Token': 'manual-figma-token' }), figmaEnv,
    async (_, options) => {
      assert.equal(options.headers['X-Figma-Token'], 'manual-figma-token')
      return Response.json({ err: 'Invalid token' }, { status: 403 })
    })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).err, 'Invalid token')
})

test('Figma routes reject missing credentials, invalid paths and unsafe image proxy targets', async () => {
  const noCall = () => { throw new Error('unexpected upstream call') }
  assert.equal((await handleApi(figmaRequest('me'), {}, noCall)).status, 401)
  assert.equal((await handleApi(figmaRequest('files/../../secret'), figmaEnv, noCall)).status, 404)
  assert.equal((await handleApi(figmaRequest('proxy-image?url=http%3A%2F%2Flocalhost%2Fprivate'), figmaEnv, noCall)).status, 403)

  const image = await handleApi(figmaRequest('proxy-image?url=https%3A%2F%2Fs3-alpha-sig.figma.com%2Fimg%2Fpreview.png'), figmaEnv,
    async (_, options) => {
      assert.equal(options.redirect, 'error')
      return new Response('image', { headers: { 'Content-Type': 'image/png' } })
    })
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('Content-Type'), 'image/png')
})

test('OpenAI status and generation use the server default without exposing it', async () => {
  const calls = []
  const upstream = async (url, options) => {
    calls.push({ url, auth: options.headers.Authorization })
    return options.method === 'POST'
      ? Response.json({ data: [{ b64_json: 'aW1hZ2U=' }] })
      : Response.json({ id: 'gpt-image-2' })
  }
  const status = await handleApi(openAIRequest('status', undefined, { 'X-OpenAI-Api-Key': 'stale-browser-key' }), openAIEnv, upstream)
  assert.equal((await status.json()).ok, true)
  const generated = await handleApi(openAIRequest('text2image', { prompt: 'HMI dashboard' }), openAIEnv, upstream)
  assert.deepEqual(await generated.json(), { ok: true, images: ['data:image/png;base64,aW1hZ2U='] })
  assert.deepEqual(calls, [
    { url: 'https://api.openai.com/v1/models/gpt-image-2', auth: `Bearer ${openAIEnv.OPENAI_API_KEY}` },
    { url: 'https://api.openai.com/v1/images/generations', auth: `Bearer ${openAIEnv.OPENAI_API_KEY}` },
  ])
})

test('manual OpenAI keys are validated separately and work as fallback', async () => {
  const manualKey = 'manual-openai-key'
  const upstream = async (_, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${manualKey}`)
    return Response.json({ id: 'gpt-image-2' })
  }
  const saved = await handleApi(openAIRequest('save_key', { api_key: manualKey }, { 'X-OpenAI-Api-Key': manualKey }), openAIEnv, upstream)
  assert.equal((await saved.json()).ok, true)
  const status = await handleApi(openAIRequest('status', undefined, { 'X-OpenAI-Api-Key': manualKey }), {}, upstream)
  assert.equal((await status.json()).ok, true)
})

test('OpenAI routes reject missing credentials and invalid requests without upstream calls', async () => {
  const noCall = () => { throw new Error('unexpected upstream call') }
  assert.equal((await handleApi(openAIRequest('text2image', { prompt: 'x' }), {}, noCall)).status, 503)
  assert.equal((await handleApi(openAIRequest('text2image', {}), openAIEnv, noCall)).status, 400)
  assert.equal((await handleApi(openAIRequest('image2image', { prompt: 'x' }), openAIEnv, noCall)).status, 400)
  assert.equal((await handleApi(openAIRequest('save_key', {}), openAIEnv, noCall)).status, 400)
})
