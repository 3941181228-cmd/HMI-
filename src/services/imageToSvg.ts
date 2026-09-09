import { quantizeRgba } from './vectorPalette'
/**
 * PNG 位图转 SVG 矢量图工具
 * 参考 Inkscape 的 Trace Bitmap 功能，使用 Potrace WASM 替代 imagetracerjs。
 *
 * 支持 5 种追踪模式（对应 Inkscape）：
 *  - brightness  亮度截断（默认，适合黑白线条图/剪影）
 *  - edge         边缘检测（Canny，保留边缘细节）
 *  - color        颜色量化（中值切分，多色图标）
 *  - multiscan    多重扫描（按亮度分层，potrace 原生 posterize）
 *  - centerline   中心线白描（autotrace 功能，potrace 不支持，会抛错）
 */
// 使用本地 vendor 副本，避免 npm install 后构建产物缺失问题
import { potrace, init } from '../vendor/esm-potrace-wasm/index.js'

/** 追踪模式（参考 Inkscape 的 5 种 Trace Bitmap 模式） */
export type TraceMode =
  | 'brightness'   // 亮度截断
  | 'edge'          // 边缘检测
  | 'color'         // 颜色量化
  | 'multiscan'     // 多重扫描
  | 'centerline'    // 中心线白描

/** 转换参数配置 */
export interface SvgTraceOptions {
  mode: TraceMode
  // 亮度截断参数
  brightnessThreshold?: number  // 0.0-1.0，默认 0.45
  // 边缘检测参数
  edgeThreshold?: number        // 0.0-1.0，默认 0.5
  // 颜色量化参数
  colorCount?: number           // 2-32，默认 8
  // 多重扫描参数
  multiscanColors?: number      // 2-32，默认 8
  multiscanSmooth?: boolean     // 默认 true（使用插值算法，更平滑）
  multiscanStack?: boolean      // 默认 true（颜色分层堆叠）
  // Potrace 参数（所有模式通用）
  turdSize?: number             // 斑点大小阈值，默认 2
  alphaMax?: number             // 角点平滑 0-1.33，默认 1.0
  opttolerance?: number         // 曲线优化容忍度 0-2，默认 0.2
  curveOptimization?: boolean   // 是否启用曲线优化，默认 true
  // 后处理优化（参考 vectorizer.ai 输出特性）
  enableShapeFitting?: boolean       // 形状拟合：圆/椭圆/矩形检测替换，默认 true
  enableCornerCleaning?: boolean     // 角点清理：直角锐化、近直曲线改直线，默认 true
  enableArcDetection?: boolean       // 圆弧检测：连续贝塞尔合并为 A 命令，默认 true
  enableSymmetryDetection?: boolean  // 对称建模：镜像/旋转对称用 <use> 引用，默认 true
  enablePathSimplification?: boolean // 路径简化：RDP + 共线合并 + 零长命令清理，默认 true
}

/** 默认参数（适合图标矢量化） */
export const DEFAULT_TRACE_OPTIONS: SvgTraceOptions = {
  mode: 'color',
  brightnessThreshold: 0.45,
  edgeThreshold: 0.5,
  colorCount: 32,
  multiscanColors: 8,
  multiscanSmooth: true,
  multiscanStack: true,
  turdSize: 0,
  alphaMax: 1.0,
  opttolerance: 0.1,
  curveOptimization: true,
  enableShapeFitting: true,
  enableCornerCleaning: true,
  enableArcDetection: true,
  enableSymmetryDetection: true,
  enablePathSimplification: true,
}

/** potrace 原生参数（小写命名，与 esm-potrace-wasm 一致） */
interface PotraceNativeOptions {
  turdsize: number
  turnpolicy: number
  alphamax: number
  opticurve: number
  opttolerance: number
  pathonly: boolean
  extractcolors: boolean
  posterizelevel: number
  posterizationalgorithm: number
}

/** turnpolicy 取值（potrace 默认 4 = MINORITY） */
const TURN_POLICY_MINORITY = 4

// ============== WASM 初始化 ==============

// 全局 WASM 初始化 Promise（仅需初始化一次）
let wasmInitPromise: Promise<void> | null = null

/** 确保 Potrace WASM 已初始化（仅需一次） */
function ensureWasmInit(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = init()
  }
  return wasmInitPromise
}

// ============== PNG → ImageData ==============

/** 将 PNG Blob 加载为 ImageData（使用 Canvas 绘制后提取像素） */
function pngBlobToImageData(blob: Blob): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    const img = new Image()
    const cleanup = () => URL.revokeObjectURL(objectUrl)

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          reject(new Error('无法获取 Canvas 2D 上下文'))
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        cleanup()
        resolve(imageData)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }
    img.onerror = () => {
      cleanup()
      reject(new Error('PNG 图片加载失败，可能数据已损坏'))
    }
    img.src = objectUrl
  })
}

// ============== Inkscape 风格预处理算法 ==============

/**
 * 亮度截断（Brightness Cutoff）
 * 亮度 = (R + G + B) / 3 / 255；亮度 < threshold → 黑（1），否则白（0）
 * 透明像素（alpha < 128）视为白（背景）
 *
 * @returns 单通道位图（每像素 1 字节，值 0 或 1，1 表示黑）
 */
function brightnessCutoff(imageData: ImageData, threshold: number): Uint8Array {
  const { data, width, height } = imageData
  const bitmap = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // 透明像素视为背景（白）
    if (data[i + 3] < 128) {
      bitmap[p] = 0
      continue
    }
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255
    bitmap[p] = brightness < threshold ? 1 : 0
  }
  return bitmap
}

/**
 * Canny 边缘检测（Edge Detection）
 * 流程：灰度化 → 高斯模糊(5x5, sigma=1.4) → Sobel 梯度 → 非极大值抑制 → 双阈值 → 滞后连接
 *
 * @param threshold 高阈值 0.0-1.0，低阈值 = threshold * 0.4
 * @returns 二值位图（1 表示边缘像素）
 */
function cannyEdgeDetection(imageData: ImageData, threshold: number): Uint8Array {
  const { data, width, height } = imageData
  const size = width * height

  // 1. 灰度化（透明像素视为白）
  const gray = new Float32Array(size)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 128) {
      gray[p] = 255
    } else {
      // 使用 ITU-R BT.601 亮度公式
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
  }

  // 2. 高斯模糊（5x5，sigma=1.4 的归一化核）
  const gaussianKernel = [
    2, 4, 5, 4, 2,
    4, 9, 12, 9, 4,
    5, 12, 15, 12, 5,
    4, 9, 12, 9, 4,
    2, 4, 5, 4, 2,
  ]
  const GAUSSIAN_SUM = 159
  const blurred = new Float32Array(size)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx))
          const py = Math.min(height - 1, Math.max(0, y + ky))
          sum += gray[py * width + px] * gaussianKernel[(ky + 2) * 5 + (kx + 2)]
        }
      }
      blurred[y * width + x] = sum / GAUSSIAN_SUM
    }
  }

  // 3. Sobel 算子计算梯度幅值与方向
  const magnitude = new Float32Array(size)
  const direction = new Uint8Array(size) // 量化方向：0=0°, 1=45°, 2=90°, 3=135°
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const tl = blurred[idx - width - 1]
      const tc = blurred[idx - width]
      const tr = blurred[idx - width + 1]
      const ml = blurred[idx - 1]
      const mr = blurred[idx + 1]
      const bl = blurred[idx + width - 1]
      const bc = blurred[idx + width]
      const br = blurred[idx + width + 1]
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy)
      // 量化梯度方向（0/45/90/135 度）
      const angle = Math.atan2(gy, gx) * 180 / Math.PI
      const a = angle < 0 ? angle + 180 : angle
      if ((a >= 0 && a < 22.5) || (a >= 157.5 && a <= 180)) {
        direction[idx] = 0
      } else if (a >= 22.5 && a < 67.5) {
        direction[idx] = 1
      } else if (a >= 67.5 && a < 112.5) {
        direction[idx] = 2
      } else {
        direction[idx] = 3
      }
    }
  }

  // 4. 非极大值抑制（NMS）：沿梯度方向保留局部最大值
  const nms = new Float32Array(size)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const mag = magnitude[idx]
      let n1 = 0
      let n2 = 0
      switch (direction[idx]) {
        case 0: // 水平方向，比较左右
          n1 = magnitude[idx - 1]
          n2 = magnitude[idx + 1]
          break
        case 1: // 45°，比较左下/右上
          n1 = magnitude[idx + width - 1]
          n2 = magnitude[idx - width + 1]
          break
        case 2: // 垂直方向，比较上下
          n1 = magnitude[idx - width]
          n2 = magnitude[idx + width]
          break
        case 3: // 135°，比较左上/右下
          n1 = magnitude[idx - width - 1]
          n2 = magnitude[idx + width + 1]
          break
      }
      nms[idx] = mag >= n1 && mag >= n2 ? mag : 0
    }
  }

  // 5. 双阈值 + 6. 滞后连接（边缘连接）
  const highThreshold = threshold * 255
  const lowThreshold = highThreshold * 0.4
  const bitmap = new Uint8Array(size)
  const strong = new Uint8Array(size) // 强边缘
  const weak = new Uint8Array(size)   // 弱边缘
  for (let i = 0; i < size; i++) {
    if (nms[i] >= highThreshold) {
      strong[i] = 1
    } else if (nms[i] >= lowThreshold) {
      weak[i] = 1
    }
  }
  // 滞后阈值：弱边缘若与强边缘连通则保留
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      if (weak[idx] && !strong[idx]) {
        let connected = false
        for (let ky = -1; ky <= 1 && !connected; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            if (strong[idx + ky * width + kx]) {
              connected = true
              break
            }
          }
        }
        bitmap[idx] = connected ? 1 : 0
      } else {
        bitmap[idx] = strong[idx]
      }
    }
  }
  return bitmap
}

/**
 * 颜色量化（Color Quantization）- 中值切分（Median Cut）算法
 * 将图像颜色量化为 numColors 种，每种颜色生成一个二值图
 *
 * 增强（参考 vectorizer.ai）：保留 alpha 通道信息。
 *  - 调色板仍基于 RGB（避免半透明边缘像素污染调色板）
 *  - 每个调色板颜色额外记录其所属像素的平均 alpha，用于输出 fill-opacity
 *
 * @returns bitmaps: 每个颜色一个二值图（1=该颜色像素）；palette: 颜色调色板；alphas: 每色调色板平均不透明度（0-1）
 */
const colorQuantization = quantizeRgba

// ============== Potrace 调用 ==============

/** 将单通道二值位图（0/1，1=黑）转换为黑白 ImageData */
function bitmapToImageData(
  bitmap: Uint8Array,
  width: number,
  height: number,
): ImageData {
  const out = new ImageData(width, height)
  for (let p = 0; p < bitmap.length; p++) {
    const v = bitmap[p] ? 0 : 255 // 1=黑(0)，0=白(255)
    const i = p * 4
    out.data[i] = v
    out.data[i + 1] = v
    out.data[i + 2] = v
    out.data[i + 3] = 255
  }
  return out
}

/** 构建 potrace 原生参数对象 */
function buildPotraceOptions(
  opts: SvgTraceOptions,
  pathonly: boolean,
  extractcolors: boolean,
  posterizelevel = 2,
  posterizationalgorithm = 0,
): PotraceNativeOptions {
  return {
    turdsize: opts.turdSize ?? DEFAULT_TRACE_OPTIONS.turdSize!,
    turnpolicy: TURN_POLICY_MINORITY,
    alphamax: opts.alphaMax ?? DEFAULT_TRACE_OPTIONS.alphaMax!,
    opticurve: (opts.curveOptimization ?? DEFAULT_TRACE_OPTIONS.curveOptimization!) ? 1 : 0,
    opttolerance: opts.opttolerance ?? DEFAULT_TRACE_OPTIONS.opttolerance!,
    pathonly,
    extractcolors,
    posterizelevel,
    posterizationalgorithm,
  }
}

/**
 * 对单张二值位图调用 Potrace WASM 进行追踪
 * @returns pathonly=true 时返回路径 d 字符串数组；否则返回完整 SVG 字符串
 */
async function traceBlackWhite(
  bitmap: Uint8Array,
  width: number,
  height: number,
  options: PotraceNativeOptions,
): Promise<string[]> {
  await ensureWasmInit()
  const imageData = bitmapToImageData(bitmap, width, height)
  const result = await potrace(imageData, options as unknown as Record<string, unknown>)
  // pathonly=true 时返回 string[]；统一返回数组形式
  if (Array.isArray(result)) {
    return [(result as string[]).join(' ')] // 保留同一轮廓的孔洞子路径
  }
  return [result as string]
}

// ============== SVG 输出 ==============

/** 生成 SVG 头部（带 viewBox） */
function svgHeader(width: number, height: number): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" ` +
    `xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`
  )
}

const SVG_FOOTER = '\n</svg>'

/**
 * 将多个（路径 d, 填充色）组合为一个完整 SVG
 * 增强：当 fillOpacity < 1 时输出 fill-opacity 属性，保留透明度信息（参考 vectorizer.ai）
 */
function buildSvg(
  paths: Array<{ d: string; fill: string; fillOpacity?: number }>,
  width: number,
  height: number,
): string {
  if (paths.length === 0) {
    return svgHeader(width, height) + SVG_FOOTER
  }
  const body = paths
    .map(p => {
      const op = p.fillOpacity !== undefined && p.fillOpacity < 0.999
        ? ` fill-opacity="${roundNum(p.fillOpacity)}"`
        : ''
      return `  <path d="${p.d}" fill="${p.fill}" fill-rule="evenodd"${op}/>`
    })
    .join('\n')
  return `${svgHeader(width, height)}\n<g transform="translate(0,${height}) scale(0.1,-0.1)">\n${body}\n</g>${SVG_FOOTER}`
}

// ============== 后处理优化（参考 vectorizer.ai 输出特性）==============
//
// 在 Potrace 生成原始 SVG 后执行五类几何优化：
//   1. 形状拟合（Shape Fitting）：近似圆/椭圆/矩形的路径替换为 <circle>/<ellipse>/<rect>
//   2. 角点清理（Clean Corners）：近直曲线改直线、微小圆角锐化，用 L 替代 C
//   3. 圆弧检测（Curve Support）：恒曲率连续贝塞尔合并为单条 A（圆弧）命令
//   4. 对称建模（Symmetry Modelling）：镜像/旋转对称路径用 <use> 引用，只存一份
//   5. 路径简化（Path Simplification）：RDP 抽稀 + 共线 L 合并 + 零长命令清理
//
// 设计原则：
//   - 纯原生实现（DOMParser + XMLSerializer），不引入新依赖
//   - 每条路径独立优化，仅在结果更紧凑时才替换，绝不劣化输出
//   - 任一步骤异常都回退到原始 SVG
//   - 阶段间用 setTimeout(0) 让出主线程，避免阻塞 UI

/** 后处理配置 */
interface PostProcessOptions {
  enableShapeFitting: boolean
  enableCornerCleaning: boolean
  enableArcDetection: boolean
  enableSymmetryDetection: boolean
  enablePathSimplification: boolean
}

/** 二维点 */
interface Pt { x: number; y: number }

/** 解析后的路径命令（统一为大写绝对坐标形式） */
interface PathCommand {
  cmd: string       // M / L / C / Q / A / Z
  args: number[]
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** 数字格式化：保留 3 位小数并去掉尾零，缩短输出 */
function roundNum(v: number): string {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/** 让出主线程：阶段间短暂释放控制权，避免长时间阻塞 UI */
function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// -------- 路径解析 --------

/** 匹配路径命令字母或数字（支持科学计数法、前导符号、省略分隔符） */
const PATH_TOKEN_RE = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g

/** 解析路径 d 字符串为命令序列（保留原始大小写，便于后续转绝对坐标） */
function parsePath(d: string): PathCommand[] {
  const commands: PathCommand[] = []
  PATH_TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  let currentCmd: string | null = null
  let currentArgs: number[] = []
  const flush = () => {
    if (currentCmd !== null) {
      commands.push({ cmd: currentCmd, args: currentArgs })
    }
    currentArgs = []
  }
  while ((match = PATH_TOKEN_RE.exec(d)) !== null) {
    if (match[1] !== undefined) {
      flush()
      currentCmd = match[1]
    } else if (match[2] !== undefined && currentCmd !== null) {
      currentArgs.push(parseFloat(match[2]))
    }
  }
  flush()
  return commands
}

/** 将命令序列转为绝对坐标（H/V 归并为 L，M 后的隐式 L 显式化），输出全大写 */
function toAbsolute(commands: PathCommand[]): PathCommand[] {
  const result: PathCommand[] = []
  let cx = 0, cy = 0
  let startX = 0, startY = 0
  for (const c of commands) {
    const upper = c.cmd.toUpperCase()
    const isRel = c.cmd !== upper
    const a = c.args
    switch (upper) {
      case 'M': {
        const x = isRel ? cx + a[0] : a[0]
        const y = isRel ? cy + a[1] : a[1]
        result.push({ cmd: 'M', args: [x, y] })
        cx = x; cy = y; startX = x; startY = y
        // M 命令后续点对视为隐式 L
        for (let i = 2; i + 1 < a.length; i += 2) {
          const lx = isRel ? cx + a[i] : a[i]
          const ly = isRel ? cy + a[i + 1] : a[i + 1]
          result.push({ cmd: 'L', args: [lx, ly] })
          cx = lx; cy = ly
        }
        break
      }
      case 'L': {
        const x = isRel ? cx + a[0] : a[0]
        const y = isRel ? cy + a[1] : a[1]
        result.push({ cmd: 'L', args: [x, y] })
        cx = x; cy = y
        break
      }
      case 'H': {
        const x = isRel ? cx + a[0] : a[0]
        result.push({ cmd: 'L', args: [x, cy] })
        cx = x
        break
      }
      case 'V': {
        const y = isRel ? cy + a[0] : a[0]
        result.push({ cmd: 'L', args: [cx, y] })
        cy = y
        break
      }
      case 'C': {
        const x1 = isRel ? cx + a[0] : a[0]
        const y1 = isRel ? cy + a[1] : a[1]
        const x2 = isRel ? cx + a[2] : a[2]
        const y2 = isRel ? cy + a[3] : a[3]
        const x = isRel ? cx + a[4] : a[4]
        const y = isRel ? cy + a[5] : a[5]
        result.push({ cmd: 'C', args: [x1, y1, x2, y2, x, y] })
        cx = x; cy = y
        break
      }
      case 'Q': {
        const x1 = isRel ? cx + a[0] : a[0]
        const y1 = isRel ? cy + a[1] : a[1]
        const x = isRel ? cx + a[2] : a[2]
        const y = isRel ? cy + a[3] : a[3]
        result.push({ cmd: 'Q', args: [x1, y1, x, y] })
        cx = x; cy = y
        break
      }
      case 'A': {
        const x = isRel ? cx + a[5] : a[5]
        const y = isRel ? cy + a[6] : a[6]
        result.push({ cmd: 'A', args: [a[0], a[1], a[2], a[3], a[4], x, y] })
        cx = x; cy = y
        break
      }
      case 'Z': {
        result.push({ cmd: 'Z', args: [] })
        cx = startX; cy = startY
        break
      }
      default:
        result.push({ cmd: upper, args: a.slice() })
    }
  }
  return result
}

/** 将路径命令展平为采样点序列（贝塞尔按 steps 等分离散，便于几何分析） */
function flattenCommands(commands: PathCommand[], steps = 12): Pt[] {
  const points: Pt[] = []
  let cx = 0, cy = 0, startX = 0, startY = 0
  for (const c of commands) {
    switch (c.cmd) {
      case 'M':
        cx = c.args[0]; cy = c.args[1]; startX = cx; startY = cy
        points.push({ x: cx, y: cy })
        break
      case 'L':
        cx = c.args[0]; cy = c.args[1]
        points.push({ x: cx, y: cy })
        break
      case 'C': {
        const [x1, y1, x2, y2, x, y] = c.args
        for (let i = 1; i <= steps; i++) {
          const t = i / steps, mt = 1 - t
          const px = mt * mt * mt * cx + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x
          const py = mt * mt * mt * cy + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y
          points.push({ x: px, y: py })
        }
        cx = x; cy = y
        break
      }
      case 'Q': {
        const [x1, y1, x, y] = c.args
        for (let i = 1; i <= steps; i++) {
          const t = i / steps, mt = 1 - t
          const px = mt * mt * cx + 2 * mt * t * x1 + t * t * x
          const py = mt * mt * cy + 2 * mt * t * y1 + t * t * y
          points.push({ x: px, y: py })
        }
        cx = x; cy = y
        break
      }
      case 'A': {
        // A 命令仅出现在后处理产物中，简化为端点连接
        cx = c.args[5]; cy = c.args[6]
        points.push({ x: cx, y: cy })
        break
      }
      case 'Z':
        cx = startX; cy = startY
        break
    }
  }
  return points
}

/** 计算点集包围盒 */
function bboxOf(points: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (points.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** 序列化命令序列为紧凑 d 字符串 */
function serializeCommands(commands: PathCommand[]): string {
  let s = ''
  for (const c of commands) {
    s += c.cmd
    for (let i = 0; i < c.args.length; i++) {
      s += (i === 0 ? '' : ' ') + roundNum(c.args[i])
    }
  }
  return s
}

// -------- 1. 形状拟合（Shape Fitting）--------

/** 检测点集是否近似圆形（宽高比≈1 且各点到中心距离方差小） */
function detectCircle(points: Pt[], tolerance = 0.08): { cx: number; cy: number; r: number } | null {
  if (points.length < 12) return null
  const b = bboxOf(points)
  if (!b) return null
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  if (w < 4 || h < 4) return null
  const aspect = w / h
  if (aspect < 1 - tolerance || aspect > 1 + tolerance) return null
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  let sumR = 0, sumR2 = 0
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy)
    sumR += d
    sumR2 += d * d
  }
  const n = points.length
  const meanR = sumR / n
  if (meanR < 1) return null
  const variance = Math.max(0, sumR2 / n - meanR * meanR)
  const cv = Math.sqrt(variance) / meanR // 变异系数
  if (cv > tolerance) return null
  return { cx, cy, r: meanR }
}

/** 检测点集是否近似椭圆（排除正圆，由 detectCircle 优先处理） */
function detectEllipse(points: Pt[], tolerance = 0.1): { cx: number; cy: number; rx: number; ry: number } | null {
  if (points.length < 12) return null
  const b = bboxOf(points)
  if (!b) return null
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  if (w < 4 || h < 4) return null
  const aspect = w / h
  if (aspect > 1 - 0.03 && aspect < 1 + 0.03) return null // 正圆交给 detectCircle
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const rx = w / 2, ry = h / 2
  if (rx < 1 || ry < 1) return null
  let sum = 0, sum2 = 0
  for (const p of points) {
    const v = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2
    sum += v
    sum2 += v * v
  }
  const n = points.length
  const mean = sum / n
  if (Math.abs(mean - 1) > tolerance) return null
  const variance = Math.max(0, sum2 / n - mean * mean)
  if (Math.sqrt(variance) > tolerance) return null
  return { cx, cy, rx, ry }
}

/** 在闭合采样点序列上检测角点（方向突变处） */
function detectCorners(points: Pt[], minAngleDeg = 30): Pt[] {
  const n = points.length
  if (n < 6) return []
  const span = Math.max(2, Math.floor(n / 40))
  const raw: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = points[(i - span + n) % n]
    const b = points[i]
    const c = points[(i + span) % n]
    const v1x = b.x - a.x, v1y = b.y - a.y
    const v2x = c.x - b.x, v2y = c.y - b.y
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y)
    if (l1 < 1e-6 || l2 < 1e-6) continue
    const dot = (v1x * v2x + v1y * v2y) / (l1 * l2)
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI
    if (angle > minAngleDeg) raw.push({ x: b.x, y: b.y })
  }
  // 合并距离过近的相邻候选角点
  const merged: Pt[] = []
  const minDist = 3
  for (const p of raw) {
    const last = merged[merged.length - 1]
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < minDist) continue
    merged.push(p)
  }
  if (merged.length >= 2) {
    const f = merged[0], l = merged[merged.length - 1]
    if (Math.hypot(f.x - l.x, f.y - l.y) < minDist) merged.pop() // 首尾同一角点
  }
  return merged
}

/** 检测点集是否近似矩形（4 个角点且分别贴近包围盒四角） */
function detectRect(points: Pt[], tolerance = 0.15): { x: number; y: number; w: number; h: number } | null {
  if (points.length < 12) return null
  const b = bboxOf(points)
  if (!b) return null
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  if (w < 4 || h < 4) return null
  const corners = detectCorners(points, 35)
  if (corners.length !== 4) return null
  const bboxCorners = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ]
  const tol = Math.min(w, h) * tolerance + 1
  for (const bc of bboxCorners) {
    let matched = false
    for (const c of corners) {
      if (Math.hypot(c.x - bc.x, c.y - bc.y) <= tol) { matched = true; break }
    }
    if (!matched) return null
  }
  return { x: b.minX, y: b.minY, w, h }
}

/** 拟合结果：替换图元标签 + 属性 */
interface ShapeFit {
  tag: string
  attrs: Record<string, string>
}

/** 尝试将路径拟合为基本图元（圆/矩形/椭圆），无法拟合返回 null */
function fitShape(commands: PathCommand[]): ShapeFit | null {
  const points = flattenCommands(commands, 14)
  if (points.length < 8) return null
  const circle = detectCircle(points)
  if (circle) {
    return { tag: 'circle', attrs: { cx: roundNum(circle.cx), cy: roundNum(circle.cy), r: roundNum(circle.r) } }
  }
  const rect = detectRect(points)
  if (rect) {
    return { tag: 'rect', attrs: { x: roundNum(rect.x), y: roundNum(rect.y), width: roundNum(rect.w), height: roundNum(rect.h) } }
  }
  const ellipse = detectEllipse(points)
  if (ellipse) {
    return { tag: 'ellipse', attrs: { cx: roundNum(ellipse.cx), cy: roundNum(ellipse.cy), rx: roundNum(ellipse.rx), ry: roundNum(ellipse.ry) } }
  }
  return null
}

// -------- 2. 角点清理（Clean Corners）--------

/** 判断单个 C 命令是否近似直线（两控制点均贴近弦） */
function cDeviationRatio(prev: Pt, c: PathCommand): number {
  if (c.cmd !== 'C' || c.args.length < 6) return 0
  const [x1, y1, x2, y2, x, y] = c.args
  const dx = x - prev.x, dy = y - prev.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return 0
  const d1 = Math.abs((x1 - prev.x) * dy - (y1 - prev.y) * dx) / len
  const d2 = Math.abs((x2 - prev.x) * dy - (y2 - prev.y) * dx) / len
  return Math.max(d1, d2) / len
}

/** 角点清理：近直 C 转 L，并对微小圆角锐化，保持直角/锐角清晰 */
function cleanCorners(commands: PathCommand[]): PathCommand[] {
  if (commands.length === 0) return commands
  const closed = commands[commands.length - 1].cmd === 'Z'
  // 收集每个命令的端点，用于估算转角角度与周长
  const pts: Pt[] = []
  for (const c of commands) {
    if (c.cmd === 'M' || c.cmd === 'L') pts.push({ x: c.args[0], y: c.args[1] })
    else if (c.cmd === 'C') pts.push({ x: c.args[4], y: c.args[5] })
    else if (c.cmd === 'Q') pts.push({ x: c.args[2], y: c.args[3] })
    else if (c.cmd === 'A') pts.push({ x: c.args[5], y: c.args[6] })
  }
  const np = pts.length
  // 估算周长（相邻端点距离之和）
  let perimeter = 0
  for (let i = 1; i < np; i++) perimeter += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  if (closed && np >= 2) perimeter += Math.hypot(pts[0].x - pts[np - 1].x, pts[0].y - pts[np - 1].y)
  const cornerChordLimit = Math.max(3, perimeter * 0.015) // 微小圆角阈值

  // 计算每个端点的转角角度
  const cornerAngle = new Array(np).fill(0)
  if (np >= 3) {
    for (let i = 0; i < np; i++) {
      if (!closed && (i === 0 || i === np - 1)) continue
      const a = pts[(i - 1 + np) % np]
      const b = pts[i]
      const c = pts[(i + 1) % np]
      const v1x = b.x - a.x, v1y = b.y - a.y
      const v2x = c.x - b.x, v2y = c.y - b.y
      const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y)
      if (l1 < 1e-6 || l2 < 1e-6) continue
      const dot = (v1x * v2x + v1y * v2y) / (l1 * l2)
      cornerAngle[i] = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI
    }
  }

  const result: PathCommand[] = []
  let prev: Pt | null = null
  let ptIdx = 0
  for (const c of commands) {
    if (c.cmd === 'M') {
      result.push({ cmd: 'M', args: c.args.slice() })
      prev = { x: c.args[0], y: c.args[1] }
      ptIdx++
    } else if (c.cmd === 'L') {
      result.push({ cmd: 'L', args: c.args.slice() })
      prev = { x: c.args[0], y: c.args[1] }
      ptIdx++
    } else if (c.cmd === 'C') {
      const end = { x: c.args[4], y: c.args[5] }
      const chord = prev ? Math.hypot(end.x - prev.x, end.y - prev.y) : 0
      const straight = cDeviationRatio(prev ?? end, c) < 0.06
      // 直角/锐角且为微小圆角（短弦）→ 锐化为直线
      const sharpCorner = cornerAngle[ptIdx] > 50 && chord > 0 && chord < cornerChordLimit
      if (straight || sharpCorner) {
        result.push({ cmd: 'L', args: [end.x, end.y] })
      } else {
        result.push({ cmd: 'C', args: c.args.slice() })
      }
      prev = end
      ptIdx++
    } else if (c.cmd === 'Q') {
      const end = { x: c.args[2], y: c.args[3] }
      const sharpCorner = cornerAngle[ptIdx] > 50 && prev &&
        Math.hypot(end.x - prev.x, end.y - prev.y) < cornerChordLimit
      if (sharpCorner) {
        result.push({ cmd: 'L', args: [end.x, end.y] })
      } else {
        result.push({ cmd: 'Q', args: c.args.slice() })
      }
      prev = end
      ptIdx++
    } else if (c.cmd === 'A') {
      result.push({ cmd: 'A', args: c.args.slice() })
      prev = { x: c.args[5], y: c.args[6] }
      ptIdx++
    } else {
      result.push({ cmd: c.cmd, args: c.args.slice() })
    }
  }
  return result
}

// -------- 3. 圆弧检测（Arc Detection）--------

/** 三点外接圆 */
function fitCircle3(p0: Pt, p1: Pt, p2: Pt): { cx: number; cy: number; r: number } | null {
  const ax = p0.x, ay = p0.y, bx = p1.x, by = p1.y, cx = p2.x, cy = p2.y
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-9) return null
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
  const r = Math.hypot(ax - ux, ay - uy)
  return { cx: ux, cy: uy, r }
}

/** 在三次贝塞尔上取 t 处采样点 */
function bezierSampleAt(prev: Pt, c: PathCommand, t: number): Pt {
  const [x1, y1, x2, y2, x, y] = c.args
  const mt = 1 - t
  return {
    x: mt * mt * mt * prev.x + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x,
    y: mt * mt * mt * prev.y + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y,
  }
}

/** 判断单个 C 命令是否近似圆弧，返回拟合圆心/半径 */
function cIsArc(prev: Pt, c: PathCommand, tol = 0.04): { cx: number; cy: number; r: number } | null {
  if (c.cmd !== 'C' || c.args.length < 6) return null
  const p0 = prev
  const p3 = { x: c.args[4], y: c.args[5] }
  const chord = Math.hypot(p3.x - p0.x, p3.y - p0.y)
  if (chord < 1) return null
  const mid = bezierSampleAt(prev, c, 0.5)
  const circ = fitCircle3(p0, mid, p3)
  if (!circ || circ.r < 1) return null
  // 验证多点贴合圆弧
  const samples = 8
  let maxErr = 0
  for (let i = 1; i < samples; i++) {
    const t = i / samples
    const s = bezierSampleAt(prev, c, t)
    maxErr = Math.max(maxErr, Math.abs(Math.hypot(s.x - circ.cx, s.y - circ.cy) - circ.r))
  }
  if (maxErr > tol * circ.r + 0.3) return null
  return circ
}

/** 根据起点、终点、圆心及中间采样点生成 A 命令（确定 large-arc/sweep 标志） */
function buildArcCommand(
  circ: { cx: number; cy: number; r: number },
  start: Pt,
  end: Pt,
  midPt: Pt,
): PathCommand | null {
  const { cx, cy, r } = circ
  const a0 = Math.atan2(start.y - cy, start.x - cx)
  const a1 = Math.atan2(midPt.y - cy, midPt.x - cx)
  const a2 = Math.atan2(end.y - cy, end.x - cx)
  // 由起点→中点的方向确定扫掠方向
  let dirDelta = a1 - a0
  while (dirDelta > Math.PI) dirDelta -= 2 * Math.PI
  while (dirDelta < -Math.PI) dirDelta += 2 * Math.PI
  if (Math.abs(dirDelta) < 1e-6) return null
  const dirSign = dirDelta > 0 ? 1 : -1
  // 沿 dirSign 方向从 a0 到 a2 的总扫角
  let total = a2 - a0
  while (dirSign * total < 0) total += dirSign * 2 * Math.PI
  if (Math.abs(total) < 1e-3) return null // 起终点重合，退化
  const largeArc = Math.abs(total) > Math.PI ? 1 : 0
  // sweep-flag=1 表示正方向（y 向下时为顺时针），对应角度递增
  const sweepFlag = dirSign > 0 ? 1 : 0
  return { cmd: 'A', args: [r, r, 0, largeArc, sweepFlag, end.x, end.y] }
}

/** 圆弧检测：将同圆连续 C 段合并为单条 A 命令（≥2 段才替换，确保更紧凑） */
function detectArcs(commands: PathCommand[]): PathCommand[] {
  const result: PathCommand[] = []
  let prev: Pt | null = null
  let i = 0
  const endPoint = (c: PathCommand): Pt | null => {
    if (c.cmd === 'M' || c.cmd === 'L') return { x: c.args[0], y: c.args[1] }
    if (c.cmd === 'C') return { x: c.args[4], y: c.args[5] }
    if (c.cmd === 'Q') return { x: c.args[2], y: c.args[3] }
    if (c.cmd === 'A') return { x: c.args[5], y: c.args[6] }
    return null
  }
  while (i < commands.length) {
    const c = commands[i]
    if (c.cmd === 'C' && prev) {
      const first = cIsArc(prev, c)
      if (first) {
        // 收集同圆连续 C
        const group: PathCommand[] = [c]
        const groupStart = prev
        let groupEnd: Pt = { x: c.args[4], y: c.args[5] }
        let curPrev = groupEnd
        let j = i + 1
        while (j < commands.length && commands[j].cmd === 'C') {
          const nc = commands[j]
          const next = cIsArc(curPrev, nc)
          if (!next) break
          if (Math.hypot(next.cx - first.cx, next.cy - first.cy) > first.r * 0.08 + 1) break
          if (Math.abs(next.r - first.r) > first.r * 0.08 + 1) break
          group.push(nc)
          groupEnd = { x: nc.args[4], y: nc.args[5] }
          curPrev = groupEnd
          j++
        }
        if (group.length >= 2) {
          // 取组内中点用于确定扫掠方向
          const midCmd = group[Math.floor(group.length / 2)]
          const midPrev = group.length > 1
            ? endPoint(group[Math.floor(group.length / 2) - 1]) ?? groupStart
            : groupStart
          const midPt = bezierSampleAt(midPrev, midCmd, 0.5)
          const arc = buildArcCommand(first, groupStart, groupEnd, midPt)
          if (arc) {
            result.push(arc)
            prev = groupEnd
            i = j
            continue
          }
        }
      }
    }
    // 默认保留原命令
    result.push({ cmd: c.cmd, args: c.args.slice() })
    prev = endPoint(c)
    i++
  }
  return result
}

// -------- 4. 路径简化（Path Simplification）--------

/** 点到直线的距离 */
function pointLineDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
}

/** Ramer-Douglas-Peucker 算法：返回保留点的索引 */
function rdpIndices(points: Pt[], epsilon: number): number[] {
  const n = points.length
  if (n < 3) return points.map((_, i) => i)
  const keep = new Array(n).fill(false)
  keep[0] = true
  keep[n - 1] = true
  const stack: Array<[number, number]> = [[0, n - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    let maxD = 0, maxIdx = -1
    const a = points[s], b = points[e]
    for (let i = s + 1; i < e; i++) {
      const d = pointLineDist(points[i], a, b)
      if (d > maxD) { maxD = d; maxIdx = i }
    }
    if (maxD > epsilon && maxIdx >= 0) {
      keep[maxIdx] = true
      stack.push([s, maxIdx])
      stack.push([maxIdx, e])
    }
  }
  const idxs: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) idxs.push(i)
  return idxs
}

/** 三点共线判定（叉积/长度比 < tol） */
function isCollinear(a: Pt, b: Pt, c: Pt, tol: number): boolean {
  const dx1 = b.x - a.x, dy1 = b.y - a.y
  const dx2 = c.x - a.x, dy2 = c.y - a.y
  const area = Math.abs(dx1 * dy2 - dy1 * dx2)
  const len = Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2)
  if (len < 1e-9) return true
  return area / len < tol
}

/**
 * 路径简化：
 *  - 纯折线（M/L/Z）使用 RDP 抽稀
 *  - 通用：清理零长命令、合并共线连续 L
 */
function simplifyPath(commands: PathCommand[]): PathCommand[] {
  if (commands.length === 0) return commands
  // 纯折线：RDP 抽稀
  const isPolyline = commands.every(c => c.cmd === 'M' || c.cmd === 'L' || c.cmd === 'Z')
  if (isPolyline && commands.length > 3) {
    let startIdx = 0
    for (let i = 0; i < commands.length; i++) {
      if (commands[i].cmd === 'M') { startIdx = i; break }
    }
    const pts: Pt[] = []
    for (let i = startIdx; i < commands.length; i++) {
      const c = commands[i]
      if (c.cmd === 'M' || c.cmd === 'L') pts.push({ x: c.args[0], y: c.args[1] })
    }
    if (pts.length >= 3) {
      const idxs = rdpIndices(pts, 0.8)
      const out: PathCommand[] = []
      for (let i = 0; i < startIdx; i++) out.push({ cmd: commands[i].cmd, args: commands[i].args.slice() })
      out.push({ cmd: 'M', args: [pts[idxs[0]].x, pts[idxs[0]].y] })
      for (let k = 1; k < idxs.length; k++) out.push({ cmd: 'L', args: [pts[idxs[k]].x, pts[idxs[k]].y] })
      if (commands[commands.length - 1].cmd === 'Z') out.push({ cmd: 'Z', args: [] })
      return out
    }
  }
  // 通用：零长命令清理 + 共线 L 合并
  const result: PathCommand[] = []
  let prev: Pt | null = null
  const endPoint = (c: PathCommand): Pt | null => {
    if (c.cmd === 'M' || c.cmd === 'L') return { x: c.args[0], y: c.args[1] }
    if (c.cmd === 'C') return { x: c.args[4], y: c.args[5] }
    if (c.cmd === 'Q') return { x: c.args[2], y: c.args[3] }
    if (c.cmd === 'A') return { x: c.args[5], y: c.args[6] }
    return null
  }
  for (const c of commands) {
    if (c.cmd === 'M') {
      result.push({ cmd: 'M', args: c.args.slice() })
      prev = { x: c.args[0], y: c.args[1] }
    } else if (c.cmd === 'L') {
      const end = { x: c.args[0], y: c.args[1] }
      if (prev && Math.hypot(end.x - prev.x, end.y - prev.y) < 0.01) continue // 零长
      // 共线合并：上一条也是 L，且前点→当前点→新终点共线
      const last = result[result.length - 1]
      if (last && last.cmd === 'L' && result.length >= 2) {
        const beforeLast = result[result.length - 2]
        const pprev = endPoint(beforeLast)
        if (pprev && prev && isCollinear(pprev, prev, end, 0.02)) {
          last.args = [end.x, end.y]
          prev = end
          continue
        }
      }
      result.push({ cmd: 'L', args: [end.x, end.y] })
      prev = end
    } else if (c.cmd === 'C' || c.cmd === 'Q' || c.cmd === 'A') {
      const end = endPoint(c)
      if (prev && end && Math.hypot(end.x - prev.x, end.y - prev.y) < 0.01) continue // 零长
      result.push({ cmd: c.cmd, args: c.args.slice() })
      prev = end
    } else {
      result.push({ cmd: c.cmd, args: c.args.slice() })
    }
  }
  return result
}

// -------- 5. 对称建模（Symmetry Modelling）--------

/** 等间隔采样点（控制对比规模，加速匹配） */
function samplePoints(points: Pt[], maxCount: number): Pt[] {
  if (points.length <= maxCount) return points
  const step = points.length / maxCount
  const out: Pt[] = []
  for (let i = 0; i < maxCount; i++) out.push(points[Math.floor(i * step)])
  return out
}

/** 点集质心 */
function centroid(points: Pt[]): Pt {
  let sx = 0, sy = 0
  for (const p of points) { sx += p.x; sy += p.y }
  return { x: sx / points.length, y: sy / points.length }
}

/** 反射后与目标点集匹配的比例 */
function matchRatio(src: Pt[], dst: Pt[], reflect: (p: Pt) => Pt, tol: number): number {
  const reflected = src.map(reflect)
  let matched = 0
  for (const p of reflected) {
    for (const q of dst) {
      if (Math.hypot(p.x - q.x, p.y - q.y) <= tol) { matched++; break }
    }
  }
  return matched / reflected.length
}

interface SymPathInfo {
  el: Element
  points: Pt[]
  fill: string
  fillOpacity: string
}

/** 检测两路径是否互为镜像/旋转，返回使 A 映射到 B 的 transform */
function trySymmetry(A: SymPathInfo, B: SymPathInfo): string | null {
  const sz = Math.min(
    bboxOf(A.points)?.maxX ?? 0, bboxOf(A.points)?.maxY ?? 0,
  )
  const tol = Math.max(2, Math.abs(sz) * 0.04)
  const sA = samplePoints(A.points, 50)
  const sB = samplePoints(B.points, 50)
  const cA = centroid(sA), cB = centroid(sB)
  // 水平镜像（轴为竖直线 x = kx）
  if (Math.abs(cA.y - cB.y) < tol + 1) {
    const kx = (cA.x + cB.x) / 2
    if (matchRatio(sA, sB, p => ({ x: 2 * kx - p.x, y: p.y }), tol) > 0.85) {
      return `translate(${roundNum(2 * kx)} 0) scale(-1 1)`
    }
  }
  // 垂直镜像（轴为水平线 y = ky）
  if (Math.abs(cA.x - cB.x) < tol + 1) {
    const ky = (cA.y + cB.y) / 2
    if (matchRatio(sA, sB, p => ({ x: p.x, y: 2 * ky - p.y }), tol) > 0.85) {
      return `translate(0 ${roundNum(2 * ky)}) scale(1 -1)`
    }
  }
  // 180° 旋转（点对称）
  const cx = (cA.x + cB.x) / 2, cy = (cA.y + cB.y) / 2
  if (matchRatio(sA, sB, p => ({ x: 2 * cx - p.x, y: 2 * cy - p.y }), tol) > 0.85) {
    return `rotate(180 ${roundNum(cx)} ${roundNum(cy)})`
  }
  return null
}

/** 对整个 SVG 做对称检测：互为对称的路径，后者替换为 <use> 引用前者 */
function detectSymmetry(doc: Document): boolean {
  const svgRoot = doc.documentElement
  const pathEls = Array.from(svgRoot.querySelectorAll('path'))
  if (pathEls.length < 2 || pathEls.length > 120) return false
  const infos: SymPathInfo[] = []
  for (const el of pathEls) {
    const d = el.getAttribute('d') || ''
    const pts = flattenCommands(toAbsolute(parsePath(d)), 8)
    if (pts.length < 4) continue
    infos.push({
      el,
      points: pts,
      fill: el.getAttribute('fill') || '#000',
      fillOpacity: el.getAttribute('fill-opacity') || '',
    })
  }
  if (infos.length < 2) return false
  let modified = false
  const used = new Set<number>()
  let idCounter = 0
  const ensureId = (el: Element): string => {
    let id = el.getAttribute('id')
    if (!id) {
      id = `sym${++idCounter}`
      el.setAttribute('id', id)
    }
    return id
  }
  for (let i = 0; i < infos.length; i++) {
    if (used.has(i)) continue
    for (let j = i + 1; j < infos.length; j++) {
      if (used.has(j)) continue
      const A = infos[i], B = infos[j]
      if (A.fill !== B.fill || A.fillOpacity !== B.fillOpacity) continue
      if (Math.abs(A.points.length - B.points.length) > Math.max(4, A.points.length * 0.1)) continue
      const transform = trySymmetry(A, B)
      if (transform) {
        const id = ensureId(A.el)
        const useEl = doc.createElementNS(SVG_NS, 'use')
        useEl.setAttribute('href', `#${id}`)
        useEl.setAttribute('transform', transform)
        B.el.parentNode?.replaceChild(useEl, B.el)
        used.add(j)
        modified = true
        break
      }
    }
  }
  return modified
}

// -------- 后处理主流程 --------

/** 将属性对象序列化为属性字符串 */
function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')
}

/**
 * SVG 后处理主入口：对 Potrace 输出做几何优化。
 * - 任一阶段异常或结果不更紧凑均回退到原始 SVG，绝不劣化输出
 * - 阶段间让出主线程，避免阻塞 UI
 */
async function postProcessSvg(svgString: string, options: PostProcessOptions): Promise<string> {
  // 任一开关关闭则跳过对应阶段；全关闭直接返回
  const anyEnabled = options.enableShapeFitting || options.enableCornerCleaning ||
    options.enableArcDetection || options.enableSymmetryDetection || options.enablePathSimplification
  if (!anyEnabled) return svgString

  let doc: Document
  try {
    const parser = new DOMParser()
    doc = parser.parseFromString(svgString, 'image/svg+xml')
  } catch {
    return svgString
  }
  if (doc.querySelector('parsererror')) return svgString
  const svgRoot = doc.documentElement
  if (!svgRoot || svgRoot.tagName.toLowerCase() !== 'svg') return svgString

  const originalSize = svgString.length
  let modified = false

  // 逐路径几何优化
  const pathEls = Array.from(svgRoot.querySelectorAll('path'))
  for (let idx = 0; idx < pathEls.length; idx++) {
    const el = pathEls[idx]
    const originalD = el.getAttribute('d')
    if (!originalD) continue
    let commands: PathCommand[]
    try {
      commands = toAbsolute(parsePath(originalD))
    } catch {
      continue
    }
    if (commands.length === 0) continue
    const baselineD = serializeCommands(commands)
    let working = commands
    let changed = false

    // 1. 路径简化
    if (options.enablePathSimplification) {
      try {
        const simplified = simplifyPath(working)
        if (serializeCommands(simplified) !== baselineD && serializeCommands(simplified).length < baselineD.length) {
          working = simplified
          changed = true
        }
      } catch { /* 回退 */ }
    }
    // 2. 角点清理
    if (options.enableCornerCleaning) {
      try {
        const cleaned = cleanCorners(working)
        if (serializeCommands(cleaned) !== serializeCommands(working)) {
          working = cleaned
          changed = true
        }
      } catch { /* 回退 */ }
    }
    // 3. 圆弧检测
    if (options.enableArcDetection) {
      try {
        const arced = detectArcs(working)
        if (serializeCommands(arced).length < serializeCommands(working).length) {
          working = arced
          changed = true
        }
      } catch { /* 回退 */ }
    }

    const finalD = serializeCommands(working)

    // 4. 形状拟合：尝试替换为基本图元（仅在更紧凑时替换）
    if (options.enableShapeFitting) {
      try {
        const shape = fitShape(working)
        if (shape) {
          const fill = el.getAttribute('fill') || '#000'
          const fillOpacity = el.getAttribute('fill-opacity')
          const attrs: Record<string, string> = { ...shape.attrs, fill }
          if (fillOpacity) attrs['fill-opacity'] = fillOpacity
          const newStr = `<${shape.tag} ${attrsToString(attrs)}/>`
          const oldStr = `<path d="${finalD}" fill="${fill}"${fillOpacity ? ` fill-opacity="${fillOpacity}"` : ''}/>`
          if (newStr.length < oldStr.length) {
            const newEl = doc.createElementNS(SVG_NS, shape.tag)
            for (const [k, v] of Object.entries(attrs)) newEl.setAttribute(k, v)
            el.parentNode?.replaceChild(newEl, el)
            modified = true
            continue // 元素已替换，跳过 d 更新
          }
        }
      } catch { /* 回退 */ }
    }

    // 更新 d（仅当确有变化且不比原始大）
    if (changed && finalD !== originalD && finalD.length <= originalD.length) {
      el.setAttribute('d', finalD)
      modified = true
    }

    // 大图像分块让出：每处理若干路径让出一次主线程
    if (idx > 0 && idx % 64 === 0) await yieldToMain()
  }

  // 5. 对称检测（跨路径）
  if (options.enableSymmetryDetection) {
    try {
      if (detectSymmetry(doc)) modified = true
    } catch { /* 回退 */ }
  }

  if (!modified) return svgString

  // 序列化并保留 XML 声明
  let result: string
  try {
    result = new XMLSerializer().serializeToString(doc)
  } catch {
    return svgString
  }
  if (svgString.trimStart().startsWith('<?xml') && !result.startsWith('<?xml')) {
    result = '<?xml version="1.0" encoding="UTF-8"?>\n' + result
  }
  // 全局回退：若结果不比原始更小，返回原始 SVG
  if (result.length >= originalSize) return svgString
  return result
}

// ============== 主转换函数 ==============

/**
 * 将 PNG Blob 转换为 SVG 矢量字符串
 *
 * 参考 Inkscape 的 Trace Bitmap，根据 mode 选择不同的追踪策略：
 *  - brightness  亮度截断（默认）
 *  - edge         Canny 边缘检测
 *  - color        颜色量化（中值切分）
 *  - multiscan    多重扫描（potrace 原生 posterize）
 *  - centerline   中心线白描（暂不支持，抛错）
 *
 * @param blob PNG 图片的 Blob 对象
 * @param options 追踪参数（默认使用 DEFAULT_TRACE_OPTIONS）
 * @returns 完整的 SVG 字符串（包含 <?xml?> 头和 <svg> 标签）
 */
export async function pngBlobToSvg(
  blob: Blob,
  options?: Partial<SvgTraceOptions>,
): Promise<string> {
  if (!blob || blob.size === 0) {
    throw new Error('PNG 数据为空（0 字节）')
  }

  return imageDataToSvg(await pngBlobToImageData(blob), options)
}

/** Pixel entry point usable in a dedicated worker without DOM access. */
export async function imageDataToSvg(imageData: ImageData, options?: Partial<SvgTraceOptions>): Promise<string> {
  if (!imageData.width || !imageData.height || imageData.width * imageData.height > 4_000_000) {
    throw new Error('图片需小于 400 万像素，请先缩小或裁剪')
  }
  const opts: SvgTraceOptions = { ...DEFAULT_TRACE_OPTIONS, ...(options || {}) }
  const mode = opts.mode

  // 中心线模式：potrace 不支持，按需求抛错
  if (mode === 'centerline') {
    throw new Error('中心线模式（centerline）暂未实现：potrace 不直接支持中心线追踪，请选择其他模式')
  }

  // 1. PNG Blob → ImageData
  const { width, height } = imageData

  // rawSvg：Potrace 生成的原始 SVG（后处理阶段会在此基础上做几何优化）
  let rawSvg = ''
  try {
    // 2. 根据模式选择追踪策略
    if (mode === 'multiscan') {
      // 多重扫描：使用 potrace 原生颜色分层（posterize）
      const level = Math.min(255, Math.max(2, Math.round(opts.multiscanColors ?? 8)))
      const algorithm = (opts.multiscanSmooth ?? true) ? 1 : 0
      const nativeOpts = buildPotraceOptions(opts, false, true, level, algorithm)
      await ensureWasmInit()
      // multiscan 直接使用原始 ImageData（potrace 内部处理颜色分层）
      const svg = await potrace(imageData, nativeOpts as unknown as Record<string, unknown>)
      const svgStr = Array.isArray(svg) ? svg.join('') : (svg as string)
      if (!svgStr || svgStr.indexOf('<svg') === -1) {
        throw new Error('多重扫描结果为空')
      }
      rawSvg = svgStr
    } else if (mode === 'color') {
      // 颜色量化：中值切分得到多个二值图，逐个追踪后按颜色合并
      const colorCount = Math.min(64, Math.max(2, Math.round(opts.colorCount ?? 32)))
      const { bitmaps, palette, alphas } = colorQuantization(imageData, colorCount)
      if (bitmaps.length === 0) {
        throw new Error('颜色量化结果为空（可能图像完全透明）')
      }
      const nativeOpts = buildPotraceOptions(opts, true, false)
      // 按像素数量降序排列：像素多的颜色（背景）先绘制，细节后绘制覆盖在上
      const order = bitmaps
        .map((bm, idx) => ({ idx, count: bm.reduce((s, v) => s + v, 0) }))
        .sort((a, b) => b.count - a.count)
      const allPaths: Array<{ d: string; fill: string; fillOpacity?: number }> = []
      for (const { idx } of order) {
        const bm = bitmaps[idx]
        if (bm.reduce((s, v) => s + v, 0) === 0) continue // 跳过空颜色
        const paths = await traceBlackWhite(bm, width, height, nativeOpts)
        for (const d of paths) {
          if (d) allPaths.push({ d, fill: palette[idx], fillOpacity: alphas[idx] })
        }
      }
      if (allPaths.length === 0) {
        throw new Error('颜色量化追踪结果为空')
      }
      rawSvg = buildSvg(allPaths, width, height)
    } else {
      // brightness / edge 模式：预处理得到二值位图，再调用 potrace
      let bitmap: Uint8Array
      if (mode === 'edge') {
        const threshold = Math.min(1, Math.max(0, opts.edgeThreshold ?? 0.5))
        bitmap = cannyEdgeDetection(imageData, threshold)
      } else {
        // brightness（默认）
        const threshold = Math.min(1, Math.max(0, opts.brightnessThreshold ?? 0.45))
        bitmap = brightnessCutoff(imageData, threshold)
      }

      const nativeOpts = buildPotraceOptions(opts, true, false)
      const paths = await traceBlackWhite(bitmap, width, height, nativeOpts)
      if (paths.length === 0) {
        throw new Error('追踪结果为空')
      }
      // 黑白模式统一填充黑色
      rawSvg = buildSvg(
        paths.map(d => ({ d, fill: '#000000' })),
        width,
        height,
      )
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`位图追踪失败：${reason}。请调整颜色数量或细节参数后重试。`)
  }
  // Worker output retains the original traced geometry; size alone is not a fidelity metric.
  if (typeof DOMParser === 'undefined') return rawSvg

  // 3. 后处理优化（参考 vectorizer.ai）：形状拟合 / 角点清理 / 圆弧检测 / 对称建模 / 路径简化
  //    任一阶段失败或结果不更紧凑均回退到 rawSvg，绝不劣化输出
  try {
    const postOpts: PostProcessOptions = {
      enableShapeFitting: opts.enableShapeFitting ?? true,
      enableCornerCleaning: opts.enableCornerCleaning ?? true,
      enableArcDetection: opts.enableArcDetection ?? true,
      enableSymmetryDetection: opts.enableSymmetryDetection ?? true,
      enablePathSimplification: opts.enablePathSimplification ?? true,
    }
    return await postProcessSvg(rawSvg, postOpts)
  } catch {
    // 后处理异常：回退到原始 SVG
    return rawSvg
  }
}
