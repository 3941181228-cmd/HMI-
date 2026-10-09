import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { handleApi } from './sites-api.mjs'

// Synthetic unit-test fixtures only. Never imported by application/runtime code.
const bundle = await build({ stdin: { contents: `
  export * from './src/services/figmaAnalyzer.ts';
  export * from './src/services/auditEvidence.ts';
  export * from './src/services/figmaVisualAudit.ts';
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' })
const { analyzeFigmaDocument: analyze, getIssueOverlay, parseVisualAudit, mergeVisualAudit } =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const solid = gray => ({ type: 'SOLID', color: { r: gray, g: gray, b: gray, a: 1 } })
const box = (x = 1000, y = -500, width = 1920, height = 1080) => ({ x, y, width, height })
const text = (props = {}) => ({ id: '2:1', name: 'Test label', type: 'TEXT', absoluteBoundingBox: box(1192, -392, 192, 108),
  fills: [solid(1)], style: { fontSize: 16, fontWeight: 400, fontFamily: 'Test' }, ...props })
const frame = (children = [text()], props = {}) => ({ id: '1:1', name: 'Test screen', type: 'FRAME', absoluteBoundingBox: box(), fills: [solid(1)], children, ...props })
const file = (frames = [frame()]) => ({ name: 'UNIT TEST FIXTURE', version: 'fixture-v1', document: {
  id: '0:0', name: 'Document', type: 'DOCUMENT', children: [{ id: '0:1', name: 'Page', type: 'CANVAS', children: frames }],
} })
const detect = data => analyze(data, 'fixture', undefined, { targetNodeId: '1:1' })
const byRule = (result, rule) => result.issues.filter(i => i.ruleId === rule)

test('unversioned snapshots cannot produce audit data', () => {
  for (const version of [undefined, null, '', '  ', 123]) {
    assert.throws(() => detect({ ...file(), version }), /文件版本/)
  }
})

test('missing, invalid, duplicate and wrong-target files fail closed', () => {
  for (const data of [null, {}, { document: {} }, { document: { id: '0:0', type: 'DOCUMENT', children: [] } }]) assert.throws(() => detect(data))
  assert.throws(() => analyze(file(), 'fixture', undefined, { targetNodeId: '404:1' }), /不会回退/)
  assert.throws(() => detect(file([frame([text(), text()])])), /ID 重复/)
})

test('only requested nodes are measured; inherited hidden text is excluded', () => {
  const data = file([frame([{ id: '3:1', name: 'Hidden group', type: 'GROUP', visible: false,
    children: [text({ style: { fontSize: 2 } })] }]), frame([], { id: '9:1', name: 'Outside scope' })])
  const result = detect(data)
  assert.equal(result.totalNodes, 3)
  assert.equal(result.textCount, 0)
  assert.equal(result.auditMeta.hiddenNodeCount, 2)
  assert.equal(byRule(result, 'text.minSize').length, 0)
  assert.equal(result.dataSnapshot.nodes.some(n => n.id === '9:1'), false)
})

test('same-color nearest background is measured as 1:1, never replaced with a dark default', () => {
  const result = detect(file([frame([frame([text()], { id: '1:2' })], { fills: [solid(0)] })]))
  const issue = byRule(result, 'contrast.minimum')[0]
  assert.equal(issue.actualValue, '1.00:1')
  assert.match(issue.evidence, /节点 1:2/)
  assert.equal(issue.nodeId, '2:1')
})

test('unknown, transparent, image, mixed-style and sibling backgrounds never produce a numerical contrast', () => {
  const cases = [
    frame([text()], { fills: [] }), frame([text()], { fills: [{ type: 'IMAGE', imageRef: 'fixture' }] }),
    frame([text()], { opacity: 0.5 }), frame([text({ characterStyleOverrides: [0, 1] })]),
    frame([text(), { id: '3:1', name: 'Overlay', type: 'RECTANGLE', absoluteBoundingBox: box(), fills: [solid(0)] }]),
  ]
  for (const f of cases) {
    const result = detect(file([f]))
    assert.equal(byRule(result, 'contrast.minimum').length, 0)
    assert.equal(byRule(result, 'contrast.unavailable')[0].status, 'uncheckable')
    assert.equal(result.categories.find(c => c.id === 'color').metrics.find(m => m.label === '对比度低于规则').status, 'unknown')
  }
})

test('large text uses its selected threshold rather than the normal-text threshold', () => {
  const result = detect(file([frame([text({ fills: [solid(0.55)], style: { fontSize: 24, fontWeight: 400 } })])]))
  assert.equal(byRule(result, 'contrast.minimum').length, 0)
  assert.equal(byRule(result, 'contrast.unavailable').length, 0)
})

test('touch checks run without Auto Layout and do not classify every instance as a button', () => {
  const result = detect(file([frame([
    { id: '4:1', name: 'Logo', type: 'INSTANCE', absoluteBoundingBox: box(1010, -490, 20, 20) },
    { id: '4:2', name: '开关', type: 'INSTANCE', absoluteBoundingBox: box(1050, -490, 20, 20) },
  ])]))
  const targets = byRule(result, 'touch.candidate')
  assert.equal(targets.length, 1)
  assert.equal(targets[0].nodeId, '4:2')
  assert.equal(targets[0].status, 'review')
})

test('clipped overflow and off-scope prototype destinations are not claimed as proven interaction failures', () => {
  const result = detect(file([frame([text({ absoluteBoundingBox: box(2900, 0, 500, 100), reactions: [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: 'outside:1' }] }] })], { clipsContent: true })]))
  assert.equal(byRule(result, 'interaction.clipping')[0].status, 'review')
  assert.equal(byRule(result, 'interaction.destination')[0].status, 'uncheckable')
})

test('every rule observation has real node IDs, path, evidence, threshold and provenance', () => {
  const result = analyze(file(), 'fixture', undefined, { targetNodeId: '1:1', fetchedAt: '2026-09-23T00:00:00Z', documentHash: 'fixture-only' })
  for (const issue of result.issues) {
    assert.ok(issue.ruleId && issue.nodePath && issue.evidence && issue.actualValue && issue.expectedValue)
    assert.ok(issue.affectedNodeIds.every(id => result.dataSnapshot.nodes.some(n => n.id === id)))
    assert.ok(issue.figmaUrl.includes(encodeURIComponent(issue.nodeId)))
  }
  assert.equal(result.auditMeta.fileVersion, 'fixture-v1')
  assert.equal(result.auditMeta.documentHash, 'fixture-only')
})

test('overlay uses frame-relative geometry; rejects other pages, missing bounds, old versions and AI coordinates', () => {
  const result = detect(file()), snapshot = result.dataSnapshot
  const issue = byRule(result, 'contrast.minimum')[0]
  const image = { id: '1:1', name: 'Test', url: 'unused', bounds: box(), absoluteBounds: true, version: 'fixture-v1' }
  assert.deepEqual(getIssueOverlay(issue, image, snapshot), { left: 10, top: 10, width: 10, height: 10 })
  for (const change of [{ id: 'other-page:1' }, { bounds: undefined }, { version: 'old' }, { absoluteBounds: false }]) {
    assert.equal(getIssueOverlay(issue, { ...image, ...change }, snapshot), null)
  }
  assert.equal(getIssueOverlay({ ...issue, source: 'ai' }, image, snapshot), null)
})

const finding = { title: 'Fixture', description: 'Fixture only', severity: 'medium', confidence: 0.8,
  evidence: 'Observed test pixels', location: 'Test screen', recommendation: 'Verify manually' }
test('malformed AI never becomes a clean result and valid suggestions remain unverified without guessed coordinates', () => {
  for (const raw of [{}, { summary: 'x' }, { findings: [] }, { summary: 'x', findings: [{ ...finding, evidence: '' }] },
    { summary: 'x', findings: [{ ...finding, confidence: '90' }] }]) assert.throws(() => parseVisualAudit(raw))
  const result = detect(file())
  const merged = mergeVisualAudit(result, { summary: 'Fixture', findings: [{ ...finding, nodeId: '2:1', position: box() }],
    frameId: '1:1', frameName: 'Test screen', fileVersion: 'fixture-v1', imageHash: 'fixture-only' }, 'fixture')
  const ai = merged.issues.find(i => i.source === 'ai')
  assert.equal(ai.status, 'review')
  assert.equal(ai.type, 'warning')
  assert.equal(ai.nodeId, undefined)
  assert.equal(ai.position, undefined)
  assert.equal(merged.categories.find(c => c.id === 'visualAI').highlights.length, 0)
  assert.throws(() => mergeVisualAudit(result, { summary: 'Fixture', findings: [], frameId: '1:1', fileVersion: 'old' }, 'fixture'), /不匹配/)
})

test('AI API returns failure for malformed and evidence-free upstream responses, not success with empty findings', async () => {
  for (const raw of ['not json', '{}', JSON.stringify({ summary: 'x', findings: [{ ...finding, evidence: '' }] })]) {
    const response = await handleApi(new Request('https://fixture.test/api/hmi/analyze', { method: 'POST',
      body: JSON.stringify({ mode: 'design_audit', image_base64: 'data:image/png;base64,AA==' }) }),
      { ARK_API_KEY: 'unit-test-only' }, async () => Response.json({ choices: [{ message: { content: raw }, finish_reason: 'stop' }] }))
    assert.equal(response.status, 422)
    assert.equal((await response.json()).ok, false)
  }
})

test('Figma proxy preserves exact snapshot version and absolute image bounds; unauthorized reads are not replaced', async () => {
  const url = 'https://fixture.test/api/figma/images/fixture?ids=1%3A1&version=fixture-v1&use_absolute_bounds=true&format=png'
  const response = await handleApi(new Request(url), { FIGMA_API_TOKEN: 'unit-test-only' }, async target => {
    const query = new URL(target).searchParams
    assert.equal(query.get('version'), 'fixture-v1')
    assert.equal(query.get('use_absolute_bounds'), 'true')
    return Response.json({ err: 'No access' }, { status: 403 })
  })
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { err: 'No access' })
})
