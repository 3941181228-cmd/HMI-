import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('./code.js', import.meta.url), 'utf8')

async function execute(command, selection, mapping) {
  const notices = []
  let finish
  const closed = new Promise(resolve => { finish = resolve })
  const figma = {
    command,
    mixed: Symbol('mixed'),
    currentPage: { selection },
    clientStorage: { getAsync: async () => mapping },
    notify(message) { notices.push(message); return { cancel() {} } },
    closePlugin() { finish() },
  }
  vm.runInNewContext(source, { figma, console, Set, JSON, Math, Number, parseInt })
  await closed
  return notices
}

function nativeNode(type, id) {
  return {
    id, type, name: '', children: [], parent: null, fills: [], strokes: [], opacity: 1, rotation: 0,
    x: 0, y: 0, width: 100, height: 100, cornerRadius: 0, strokeWeight: 0, clipsContent: false,
    appendChild(child) {
      if (child.parent?.children) child.parent.children = child.parent.children.filter(item => item !== child)
      child.parent = this
      this.children.push(child)
    },
    resize(width, height) { this.width = width; this.height = height },
  }
}

async function executeImport(spec) {
  const notices = []
  const styles = []
  let counter = 0
  let finish
  const closed = new Promise(resolve => { finish = resolve })
  const firstPage = nativeNode('PAGE', 'page:initial')
  firstPage.selection = []
  const figma = {
    command: 'import-hmi',
    mixed: Symbol('mixed'),
    currentPage: firstPage,
    ui: { onmessage: null, postMessage() {} },
    viewport: { scrollAndZoomIntoView(nodes) { this.last = nodes } },
    showUI() {},
    notify(message) { notices.push(message); return { cancel() {} } },
    closePlugin() { finish() },
    async setCurrentPageAsync(page) { this.currentPage = page },
    async loadFontAsync() {},
    createPage() { const page = nativeNode('PAGE', `page:${++counter}`); page.selection = []; return page },
    createPaintStyle() { const style = { name: '', paints: [] }; styles.push(style); return style },
  }
  for (const type of ['Frame', 'Component', 'Rectangle', 'Ellipse', 'Line', 'Text']) {
    figma[`create${type}`] = () => {
      const node = nativeNode(type.toUpperCase(), `node:${++counter}`)
      figma.currentPage.appendChild(node)
      return node
    }
  }
  vm.runInNewContext(source, { figma, __html__: '<html></html>', console, Set, Map, JSON, Math, Number, parseInt })
  await Promise.resolve()
  await figma.ui.onmessage({ type: 'import-hmi-spec', value: JSON.stringify(spec) })
  await closed
  return { figma, notices, styles }
}

test('headless command recolors selected fills, strokes, gradients and effects', async () => {
  const frame = {
    id: '1:2', type: 'FRAME', locked: false, fillStyleId: 'S:light', strokeStyleId: '', effectStyleId: '',
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
    strokes: [{ type: 'GRADIENT_LINEAR', gradientStops: [{ position: 0, color: { r: 1, g: 1, b: 1, a: 1 } }] }],
    effects: [{ type: 'DROP_SHADOW', color: { r: 1, g: 1, b: 1, a: 1 } }],
    children: [],
  }
  const notices = await execute('light-to-dark', [frame], [{
    name: 'Surface', light: '#FFFFFF', dark: '#101010',
  }])
  const expected = 16 / 255
  assert.equal(frame.fillStyleId, '')
  assert.equal(frame.fills[0].color.r, expected)
  assert.equal(frame.strokes[0].gradientStops[0].color.g, expected)
  assert.equal(frame.effects[0].color.b, expected)
  assert.ok(notices.some(message => message.includes('换色完成')))
})

test('headless command requires a selection and saved mapping', async () => {
  const emptySelection = await execute('light-to-dark', [], [{ light: '#FFFFFF', dark: '#000000' }])
  assert.ok(emptySelection.some(message => message.includes('请先选择')), JSON.stringify(emptySelection))
  const emptyMapping = await execute('light-to-dark', [{ id: '1:2', locked: false, children: [] }], [])
  assert.ok(emptyMapping.some(message => message.includes('配置颜色映射')), JSON.stringify(emptyMapping))
})

test('Codex import creates a new page with editable native Figma nodes and palette styles', async () => {
  const spec = {
    version: '1.0', documentName: 'Cabin', pageName: 'Codex Home', summary: 'Native UI',
    frame: { name: 'Main HMI', width: 1920, height: 1080, background: '#0B0F14' },
    palette: { background: '#0B0F14', surface: '#151C24', primary: '#4DA3FF', text: '#F4F7FA' },
    nodes: [
      {
        id: 'panel', parentId: null, type: 'FRAME', name: 'Status Panel', x: 48, y: 48, width: 500, height: 240,
        opacity: 1, rotation: 0, cornerRadius: 24, fill: '#151C24', stroke: '#4DA3FF', strokeWidth: 1, text: '',
        textStyle: { fontSize: 16, fontWeight: 400, textAlign: 'LEFT', verticalAlign: 'TOP', lineHeight: 20, letterSpacing: 0, color: '#F4F7FA' },
        layout: { mode: 'NONE', itemSpacing: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, clipContent: true },
      },
      {
        id: 'title', parentId: 'panel', type: 'TEXT', name: 'Speed', x: 24, y: 24, width: 300, height: 72,
        opacity: 1, rotation: 0, cornerRadius: 0, fill: '', stroke: '', strokeWidth: 0, text: '88 km/h',
        textStyle: { fontSize: 48, fontWeight: 600, textAlign: 'LEFT', verticalAlign: 'CENTER', lineHeight: 58, letterSpacing: 0, color: '#F4F7FA' },
        layout: { mode: 'NONE', itemSpacing: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, clipContent: false },
      },
    ],
  }
  const { figma, notices, styles } = await executeImport(spec)
  assert.equal(figma.currentPage.name, 'Codex Home')
  assert.equal(figma.currentPage.selection[0].name, 'Main HMI')
  const root = figma.currentPage.selection[0]
  assert.equal(root.children[0].type, 'FRAME')
  assert.equal(root.children[0].children[0].type, 'TEXT')
  assert.equal(root.children[0].children[0].characters, '88 km/h')
  assert.ok(styles.some(style => style.name === 'Codex HMI/Primary'))
  assert.ok(notices.some(message => message.includes('2 个可编辑图层')))
})
