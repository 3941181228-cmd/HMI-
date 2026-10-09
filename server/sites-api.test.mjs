import test from 'node:test'
import assert from 'node:assert/strict'
import { handleApi } from './sites-api.mjs'

const env = { JIMENG_API_KEY: 'test-server-secret' }

test('HMI PNG generation requests embedded image data and preserves JPEG MIME', async () => {
  const response = await handleApi(new Request('https://example.test/api/jimeng/text2image', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'HMI', hmi_preview: true }),
  }), env, async (_url, options) => {
    assert.equal(JSON.parse(options.body).response_format, 'b64_json')
    return Response.json({ data: [{ b64_json: '/9j/fixture', url: 'https://unreachable.example/image.jpeg' }] })
  })
  assert.deepEqual((await response.json()).images, ['data:image/jpeg;base64,/9j/fixture'])
})
const figmaEnv = { FIGMA_API_TOKEN: 'test-figma-secret' }
const openAIEnv = { OPENAI_API_KEY: 'test-openai-secret' }
const request = (path, data, headers = {}) => new Request(`https://example.test/api/jimeng/${path}`, data === undefined ? { headers } : {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
})
const figmaRequest = (path, headers = {}) => new Request(`https://example.test/api/figma/${path}`, { headers })
const figmaPost = (path, data, headers = {}) => new Request(`https://example.test/api/figma/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.test', ...headers }, body: JSON.stringify(data),
})
const openAIRequest = (path, data, headers = {}) => new Request(`https://example.test/api/openai/${path}`, data === undefined ? { headers } : {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
})
const hmiRequest = (data) => new Request('https://example.test/api/hmi/analyze', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
})
const codexDesign = {
  version: '1.0', documentName: 'Cabin', pageName: 'Home', summary: 'Native HMI',
  frame: { name: 'Main', width: 1920, height: 1080, background: '#0B0F14' },
  palette: {
    background: '#0B0F14', surface: '#151C24', primary: '#4DA3FF', secondary: '#6B7A90',
    accent: '#35D0A0', text: '#F4F7FA', muted: '#95A2B3', warning: '#FFB547',
  },
  nodes: [{
    id: 'title', parentId: null, type: 'TEXT', name: 'Title', x: 48, y: 40, width: 300, height: 56,
    opacity: 1, rotation: 0, cornerRadius: 0, fill: '', stroke: '', strokeWidth: 0, text: 'Ready',
    textStyle: { fontSize: 36, fontWeight: 600, textAlign: 'LEFT', verticalAlign: 'CENTER', lineHeight: 44, letterSpacing: 0, color: '#F4F7FA' },
    layout: { mode: 'NONE', itemSpacing: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, clipContent: false },
  }],
}

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

test('Figma frame listing reads the file directly and applies the width filter', async () => {
  const response = await handleApi(figmaPost('list-frames', {
    fileUrl: 'https://www.figma.com/design/abc_123/HMI', minWidth: 1800, maxWidth: 2000,
  }), figmaEnv, async (url, options) => {
    assert.equal(url, 'https://api.figma.com/v1/files/abc_123?depth=3')
    assert.equal(options.headers['X-Figma-Token'], figmaEnv.FIGMA_API_TOKEN)
    return Response.json({
      name: 'Vehicle HMI',
      document: { type: 'DOCUMENT', children: [{ type: 'CANVAS', children: [
        { id: '1:2', type: 'FRAME', name: 'Cluster', absoluteBoundingBox: { width: 1920.2, height: 1080 } },
        { id: '1:3', type: 'FRAME', name: 'Mobile', absoluteBoundingBox: { width: 390, height: 844 } },
      ] }] },
    })
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    fileName: 'Vehicle HMI',
    allFrames: 2,
    frames: [{ id: '1:2', name: 'Cluster', width: 1920, height: 1080, type: 'FRAME' }],
  })
})

test('Figma recolor exports selected SVG nodes and replaces exact mapped colors', async () => {
  let calls = 0
  const response = await handleApi(figmaPost('recolor-svg', {
    fileUrl: 'abc_123',
    frames: [{ id: '1:2', name: 'Cluster' }],
    direction: 'light-to-dark',
    mapping: [
      { light: '#FFFFFF', dark: '#101010' },
      { light: '#000000', dark: '#EEEEEE' },
    ],
  }), figmaEnv, async (url, options) => {
    calls += 1
    if (calls === 1) {
      const target = new URL(url)
      assert.equal(target.pathname, '/v1/images/abc_123')
      assert.equal(target.searchParams.get('ids'), '1:2')
      assert.equal(target.searchParams.get('format'), 'svg')
      assert.equal(options.headers['X-Figma-Token'], figmaEnv.FIGMA_API_TOKEN)
      return Response.json({ images: { '1:2': 'https://s3-alpha-sig.figma.com/recolor.svg' } })
    }
    assert.equal(url, 'https://s3-alpha-sig.figma.com/recolor.svg')
    assert.equal(options.redirect, 'error')
    return new Response('<svg><rect fill="#FFFFFF"/><path stroke="rgb(0, 0, 0)"/></svg>', {
      headers: { 'Content-Type': 'image/svg+xml' },
    })
  })
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.total, 1)
  assert.equal(body.exports[0].name, 'Cluster')
  assert.equal(body.exports[0].replacedColors, 2)
  assert.match(body.exports[0].svg, /fill="#101010"/)
  assert.match(body.exports[0].svg, /stroke="#EEEEEE"/)
})

test('Figma write-style export routes reject cross-origin and invalid payloads before upstream calls', async () => {
  const noCall = () => { throw new Error('unexpected upstream call') }
  const crossOrigin = figmaPost('list-frames', { fileUrl: 'abc_123' }, { Origin: 'https://other.test' })
  assert.equal((await handleApi(crossOrigin, figmaEnv, noCall)).status, 403)
  assert.equal((await handleApi(figmaPost('recolor-svg', { fileUrl: 'abc_123', frames: [] }), figmaEnv, noCall)).status, 400)
})

test('HMI design audit sends rule context and returns structured visual findings', async () => {
  const response = await handleApi(hmiRequest({
    mode: 'design_audit',
    image_base64: 'data:image/png;base64,QUJD',
    context: { targetNodeId: '1:514', ruleFindings: [{ title: 'Style 覆盖率偏低' }] },
  }), env, async (url, options) => {
    assert.equal(url, 'https://ark.cn-beijing.volces.com/api/v3/chat/completions')
    assert.equal(options.headers.Authorization, `Bearer ${env.JIMENG_API_KEY}`)
    const body = JSON.parse(options.body)
    assert.match(body.messages[1].content[1].text, /1:514/)
    assert.match(body.messages[0].content, /规则引擎/)
    return Response.json({ choices: [{ message: { content: '```json\n{"summary":"完成","findings":[{"title":"层级不清","description":"标题与正文视觉权重接近","severity":"medium","confidence":0.88,"evidence":"字号与字重接近","location":"内容区","recommendation":"拉开标题层级"}]}\n```' } }] })
  })
  assert.deepEqual(await response.json(), {
    ok: true,
    mode: 'design_audit',
    result: {
      summary: '完成',
      findings: [{ title: '层级不清', description: '标题与正文视觉权重接近', severity: 'medium', confidence: 0.88, evidence: '字号与字重接近', location: '内容区', recommendation: '拉开标题层级' }],
    },
  })
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

test('PNG HMI reference generation honors the design prompt while recolor keeps its constraint', async () => {
  for (const preview of [true, false]) {
    const response = await handleApi(openAIRequest('image2image', {
      prompt: 'Design a navigation HMI', image_base64: 'data:image/png;base64,aW1hZ2U=', hmi_preview: preview,
    }), openAIEnv, async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/images/edits')
      const prompt = options.body.get('prompt')
      if (preview) assert.equal(prompt, 'Design a navigation HMI')
      else assert.match(prompt, /Color palette replacement ONLY/)
      return Response.json({ data: [{ b64_json: 'aW1hZ2U=' }] })
    })
    assert.equal(response.status, 200)
  }
})

test('Codex HMI generation uses Responses structured output and returns a native Figma document', async () => {
  const response = await handleApi(openAIRequest('hmi-design', {
    prompt: 'Create a driver-focused EV home screen', scenario: 'home', style: 'technical',
    components: ['Navigation', 'Vehicle status'], width: 1920, height: 1080,
  }), openAIEnv, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    assert.equal(options.headers.Authorization, `Bearer ${openAIEnv.OPENAI_API_KEY}`)
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'gpt-5.3-codex')
    assert.equal(body.text.format.type, 'json_schema')
    assert.equal(body.text.format.strict, true)
    assert.equal(body.text.format.schema.additionalProperties, false)
    assert.match(body.input[0].content[0].text, /native Figma primitives/)
    assert.deepEqual(JSON.parse(body.input[1].content[0].text).canvas, { width: 1920, height: 1080 })
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(codexDesign) }] }] })
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.model, 'gpt-5.3-codex')
  assert.equal(body.design.nodes[0].type, 'TEXT')
  assert.equal(body.design.frame.width, 1920)
})

test('Codex HMI generation rejects unsafe sizes and malformed references before upstream calls', async () => {
  const noCall = () => { throw new Error('unexpected upstream call') }
  assert.equal((await handleApi(openAIRequest('hmi-design', { prompt: 'x', width: 200, height: 1080 }), openAIEnv, noCall)).status, 400)
  assert.equal((await handleApi(openAIRequest('hmi-design', { prompt: 'x', width: 1920, height: 1080, reference_image: 'https://example.test/image.png' }), openAIEnv, noCall)).status, 400)
})

test('HMI selected models reach upstream unchanged and invalid models fail closed', async () => {
  for (const model of ['gpt-5.3-codex', 'gpt-5', 'gpt-5-mini', 'default']) {
    const expected = model === 'default' ? 'configured-model' : model
    const response = await handleApi(openAIRequest('hmi-design', { prompt: 'test', width: 1920, height: 1080, model }),
      { ...openAIEnv, OPENAI_CODEX_MODEL: 'configured-model' }, async (_, options) => {
        assert.equal(JSON.parse(options.body).model, expected)
        return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(codexDesign) }] }] })
      })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).model, expected)
  }
  const response = await handleApi(openAIRequest('hmi-design', { prompt: 'test', width: 1920, height: 1080, model: 'invalid-model' }), openAIEnv,
    () => { throw new Error('unexpected upstream call') })
  assert.equal(response.status, 400)
})

test('OpenAI routes reject missing credentials and invalid requests without upstream calls', async () => {
  const noCall = () => { throw new Error('unexpected upstream call') }
  assert.equal((await handleApi(openAIRequest('text2image', { prompt: 'x' }), {}, noCall)).status, 503)
  assert.equal((await handleApi(openAIRequest('text2image', {}), openAIEnv, noCall)).status, 400)
  assert.equal((await handleApi(openAIRequest('image2image', { prompt: 'x' }), openAIEnv, noCall)).status, 400)
  assert.equal((await handleApi(openAIRequest('save_key', {}), openAIEnv, noCall)).status, 400)
})
