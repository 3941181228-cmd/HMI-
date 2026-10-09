import { getStoredOpenAIKey } from './apiStorage'

export type FigmaNodeType = 'FRAME' | 'COMPONENT' | 'RECTANGLE' | 'ELLIPSE' | 'LINE' | 'TEXT'
export type FigmaLayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL'

export interface CodexTextStyle {
  fontSize: number
  fontWeight: number
  textAlign: 'LEFT' | 'CENTER' | 'RIGHT'
  verticalAlign: 'TOP' | 'CENTER' | 'BOTTOM'
  lineHeight: number
  letterSpacing: number
  color: string
}

export interface CodexLayout {
  mode: FigmaLayoutMode
  itemSpacing: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  clipContent: boolean
}

export interface CodexFigmaNode {
  id: string
  parentId: string | null
  type: FigmaNodeType
  name: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
  rotation: number
  cornerRadius: number
  fill: string
  stroke: string
  strokeWidth: number
  text: string
  textStyle: CodexTextStyle
  layout: CodexLayout
}

export interface CodexFigmaDesign {
  generationModel?: string
  version: '1.0'
  documentName: string
  pageName: string
  summary: string
  frame: {
    name: string
    width: number
    height: number
    background: string
  }
  palette: {
    background: string
    surface: string
    primary: string
    secondary: string
    accent: string
    text: string
    muted: string
    warning: string
  }
  nodes: CodexFigmaNode[]
}

export interface CodexFigmaRequest {
  model?: string
  request: string
  scenario: string
  style: string
  width: number
  height: number
  referenceImage?: string | null
}

export async function generateCodexFigmaDesign(input: CodexFigmaRequest): Promise<CodexFigmaDesign> {
  const key = getStoredOpenAIKey().trim()
  const response = await fetch('/api/openai/hmi-design', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'X-OpenAI-Api-Key': key } : {}),
    },
    body: JSON.stringify({
      prompt: input.request,
      model: input.model || 'default',
      scenario: input.scenario,
      style: input.style,
      width: input.width,
      height: input.height,
      reference_image: input.referenceImage || undefined,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.ok || !data?.design) {
    throw new Error(data?.error || data?.message || `Codex 生成失败（HTTP ${response.status}）`)
  }
  return { ...data.design, generationModel: data.model } as CodexFigmaDesign
}

export function designToClipboardText(design: CodexFigmaDesign): string {
  return JSON.stringify(design, null, 2)
}

export interface CodexMcpHandoffInput {
  figmaUrl: string
  componentLibraryUrls: string[]
  design: CodexFigmaDesign
  request: string
  scenario: string
  style: string
  scope: 'screen' | 'flow'
}

export function isValidFigmaDesignUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return ['figma.com', 'www.figma.com'].includes(url.hostname.toLowerCase()) &&
      /^\/(?:design|file|proto)\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname)
  } catch {
    return false
  }
}

export function isValidFigmaLibraryUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return ['figma.com', 'www.figma.com'].includes(url.hostname.toLowerCase()) &&
      /^\/(?:design|file)\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname)
  } catch {
    return false
  }
}

export function designToCodexMcpPrompt(input: CodexMcpHandoffInput): string {
  const flowInstruction = input.scope === 'flow'
    ? 'Create a complete, coherent HMI product flow with 8–12 core screens. Include the home screen, navigation search and active guidance, media, climate, vehicle controls, charging/energy, ADAS settings, and important overlay/error states when relevant. Arrange screens left-to-right by journey and add clear flow labels.'
    : 'Create one production-ready HMI screen from the specification below.'

  const librarySection = input.componentLibraryUrls.length > 0
    ? [
        '',
        'User-provided Figma component libraries:',
        ...input.componentLibraryUrls.map((url, index) => `${index + 1}. ${url}`),
        '',
        'Component library workflow:',
        '- Use official Figma MCP library discovery for the target file before assembly. Call get_libraries first, then search_design_system using the relevant returned library keys.',
        '- Inspect the supplied library files and match components by purpose, supported properties, variants, and token compatibility—not by name alone.',
        '- Reuse priority: compatible local target-file component → compatible component from a supplied library → editable native Figma layers.',
        '- Import or enable compatible remote components through the official Figma MCP capabilities and place component instances in the screens. Preserve their variables, variants, nested instances, and component properties.',
        '- Never detach imported instances, copy library internals as loose shapes, or recreate a supplied component when a compatible library component exists.',
        '- If a supplied library is unpublished, inaccessible, or incompatible, do not invent a successful import. Report the exact library and reason, then continue with editable native Figma layers.',
      ]
    : []

  return [
    'Use the official Figma MCP server and its use_figma write capability to modify the target file directly.',
    `Target Figma file: ${input.figmaUrl.trim()}`,
    '',
    'Important constraints:',
    '- Do not install, call, or depend on any custom Figma plugin.',
    '- Inspect the target file first. Preserve all existing pages and content; create a new page named "Codex HMI Flow".',
    '- Use editable Figma-native frames, text, shapes, variables/styles, and Auto Layout.',
    '- Do not create a PNG, screenshot, flattened image, SVG import, or raster-to-vector conversion.',
    '- Inspect the target file for compatible variables and styles before creating anything. Reuse them when their semantics match.',
    '- Keep semantic layer names, consistent spacing, strong automotive glanceability, safe contrast, and large touch targets.',
    '- Work incrementally and validate the created structure after each section.',
    `- ${flowInstruction}`,
    ...librarySection,
    '',
    'Design brief:',
    `- Request: ${input.request}`,
    `- Scenario: ${input.scenario}`,
    `- Visual style: ${input.style}`,
    '',
    'Use this structured design as the visual foundation and token reference. Expand it consistently when creating a full flow:',
    '```json',
    JSON.stringify(input.design, null, 2),
    '```',
    '',
    'After writing, report the created page name, screen list, reused library components, variables/styles, and any Figma MCP limitations encountered.',
  ].join('\n')
}
