/**
 * AI 生成图片尺寸校验工具
 * - 预设尺寸表（1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 21:9 / 3:2 / 2:3）
 * - 获取图片实际尺寸（通过 Image 对象加载，不增加显著耗时）
 * - 校验尺寸一致性
 * - 不一致时通过 canvas 中心裁剪到目标尺寸
 * - 记录校验日志
 */

// ============================================================
// 预设尺寸表（基于即梦 Seedream 2K 推荐像素值）
// ============================================================

export interface PresetSize {
  /** 尺寸 ID */
  id: string
  /** 显示名称 */
  label: string
  /** 宽高比（宽/高） */
  ratio: string
  /** 即梦 API 的 size 参数值（具体像素，确保生成结果精确） */
  apiSize: string
  /** 期望宽度 px */
  width: number
  /** 期望高度 px */
  height: number
  /** 方向：landscape 横 / portrait 竖 / square 方 */
  orientation: 'landscape' | 'portrait' | 'square'
}

/** 预设尺寸列表（2K 分辨率档位，平衡清晰度与生成速度） */
export const PRESET_SIZES: PresetSize[] = [
  { id: '1:1',   label: '正方形',   ratio: '1:1',  apiSize: '2048x2048', width: 2048, height: 2048, orientation: 'square'   },
  { id: '16:9',  label: '横版宽屏', ratio: '16:9', apiSize: '2560x1440', width: 2560, height: 1440, orientation: 'landscape' },
  { id: '9:16',  label: '竖版全屏', ratio: '9:16', apiSize: '1440x2560', width: 1440, height: 2560, orientation: 'portrait'  },
  { id: '4:3',   label: '横版标准', ratio: '4:3',  apiSize: '2304x1728', width: 2304, height: 1728, orientation: 'landscape' },
  { id: '3:4',   label: '竖版标准', ratio: '3:4',  apiSize: '1728x2304', width: 1728, height: 2304, orientation: 'portrait'  },
  { id: '3:2',   label: '横版照片', ratio: '3:2',  apiSize: '2496x1664', width: 2496, height: 1664, orientation: 'landscape' },
  { id: '2:3',   label: '竖版照片', ratio: '2:3',  apiSize: '1664x2496', width: 1664, height: 2496, orientation: 'portrait'  },
  { id: '21:9',  label: '超宽横幅', ratio: '21:9', apiSize: '3024x1296', width: 3024, height: 1296, orientation: 'landscape' },
]

/** 默认尺寸 ID */
export const DEFAULT_SIZE_ID = '1:1'

/** 根据 ID 查找预设 */
export function getPresetSize(id: string): PresetSize {
  return PRESET_SIZES.find(s => s.id === id) || PRESET_SIZES[0]
}

// ============================================================
// 校验日志
// ============================================================

export interface SizeCheckLog {
  /** 时间戳 */
  timestamp: string
  /** 图片 URL（截断） */
  imageUrl: string
  /** 预期尺寸 ID（如 "16:9"） */
  expectedSizeId: string
  /** 预期宽 */
  expectedWidth: number
  /** 预期高 */
  expectedHeight: number
  /** 实际宽 */
  actualWidth: number
  /** 实际高 */
  actualHeight: number
  /** 是否一致 */
  match: boolean
  /** 处理措施：none / adjusted / error */
  action: 'none' | 'adjusted' | 'error'
  /** 备注 */
  note?: string
}

/** 内存中的校验日志（最多保留 50 条） */
const logBuffer: SizeCheckLog[] = []
const MAX_LOGS = 50

/** 记录一条校验日志 */
function appendLog(log: SizeCheckLog) {
  logBuffer.unshift(log)
  if (logBuffer.length > MAX_LOGS) logBuffer.length = MAX_LOGS
  // 同时输出到控制台，便于开发者排查
  if (log.match) {
    // eslint-disable-next-line no-console
    console.info(`[尺寸校验] ✓ ${log.expectedSizeId} ${log.actualWidth}x${log.actualHeight} 一致`)
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[尺寸校验] ✗ 预期 ${log.expectedWidth}x${log.expectedHeight} | 实际 ${log.actualWidth}x${log.actualHeight} | 措施: ${log.action}`)
  }
}

/** 获取所有校验日志（最新在前） */
export function getSizeCheckLogs(): SizeCheckLog[] {
  return [...logBuffer]
}

// ============================================================
// 尺寸获取与校验
// ============================================================

export interface ImageDimensions {
  width: number
  height: number
}

export interface VerifyResult {
  match: boolean
  expected: ImageDimensions
  actual: ImageDimensions
  presetSize: PresetSize
  /** 偏差百分比（宽高各自偏差的较大值） */
  deviationPercent: number
}

/**
 * 通过 Image 对象加载图片获取实际尺寸
 * - 不下载完整数据，仅触发元信息解析，耗时通常 < 100ms
 */
export function getImageDimensions(url: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('图片加载失败，无法获取尺寸'))
    img.src = url
  })
}

/**
 * 校验图片尺寸是否与预设一致
 * - 允许 ±2% 误差（即梦 API 偶有微小偏差）
 */
export function verifyImageSize(
  actual: ImageDimensions,
  presetSize: PresetSize
): VerifyResult {
  const expected = { width: presetSize.width, height: presetSize.height }
  const widthDiff = Math.abs(actual.width - expected.width) / expected.width
  const heightDiff = Math.abs(actual.height - expected.height) / expected.height
  const deviationPercent = Math.max(widthDiff, heightDiff) * 100
  const match = deviationPercent <= 2

  return {
    match,
    expected,
    actual,
    presetSize,
    deviationPercent,
  }
}

// ============================================================
// 尺寸调整（中心裁剪到目标比例）
// ============================================================

export interface AdjustResult {
  /** 调整后的图片 DataURL */
  dataUrl: string
  /** 调整后的 Blob */
  blob: Blob
  /** 裁剪前尺寸 */
  before: ImageDimensions
  /** 裁剪后尺寸 */
  after: ImageDimensions
}

/**
 * 通过 canvas 将图片中心裁剪/缩放到目标尺寸
 * - 策略：先等比缩放使图片覆盖目标区域，再中心裁剪多余部分
 * - 保证输出图片严格等于预设的 width × height
 */
export async function adjustImageToSize(
  url: string,
  presetSize: PresetSize
): Promise<AdjustResult> {
  const img = new Image()
  img.crossOrigin = 'anonymous'

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片加载失败，无法调整尺寸'))
    img.src = url
  })

  const srcW = img.naturalWidth
  const srcH = img.naturalHeight
  const dstW = presetSize.width
  const dstH = presetSize.height

  // 等比缩放：让源图覆盖目标区域（cover 策略）
  const scale = Math.max(dstW / srcW, dstH / srcH)
  const scaledW = srcW * scale
  const scaledH = srcH * scale
  // 中心裁剪偏移
  const offsetX = (scaledW - dstW) / 2
  const offsetY = (scaledH - dstH) / 2

  const canvas = document.createElement('canvas')
  canvas.width = dstW
  canvas.height = dstH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH, 0, 0, dstW, dstH)

  const dataUrl = canvas.toDataURL('image/png')
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png')
  })

  return {
    dataUrl,
    blob,
    before: { width: srcW, height: srcH },
    after: { width: dstW, height: dstH },
  }
}

// ============================================================
// 一站式校验流程
// ============================================================

export interface CheckAndVerifyResult {
  /** 校验结果 */
  verify: VerifyResult
  /** 调整后的图片（仅当不一致且已调整时存在） */
  adjusted?: AdjustResult
  /** 最终使用的图片 URL（原始或调整后） */
  finalUrl: string
}

/**
 * 完整的校验+调整流程：
 * 1. 获取图片实际尺寸
 * 2. 与预设比对
 * 3. 不一致时通过 canvas 调整
 * 4. 记录日志
 */
export async function checkAndVerifyImage(
  imageUrl: string,
  presetSize: PresetSize,
  options?: { autoAdjust?: boolean }
): Promise<CheckAndVerifyResult> {
  const autoAdjust = options?.autoAdjust ?? true

  try {
    const actual = await getImageDimensions(imageUrl)
    const verify = verifyImageSize(actual, presetSize)

    if (verify.match) {
      // 尺寸一致，无需调整
      appendLog({
        timestamp: new Date().toISOString(),
        imageUrl: imageUrl.slice(0, 80),
        expectedSizeId: presetSize.id,
        expectedWidth: verify.expected.width,
        expectedHeight: verify.expected.height,
        actualWidth: verify.actual.width,
        actualHeight: verify.actual.height,
        match: true,
        action: 'none',
        note: '尺寸一致',
      })
      return { verify, finalUrl: imageUrl }
    }

    // 尺寸不一致
    if (autoAdjust) {
      const adjusted = await adjustImageToSize(imageUrl, presetSize)
      appendLog({
        timestamp: new Date().toISOString(),
        imageUrl: imageUrl.slice(0, 80),
        expectedSizeId: presetSize.id,
        expectedWidth: verify.expected.width,
        expectedHeight: verify.expected.height,
        actualWidth: verify.actual.width,
        actualHeight: verify.actual.height,
        match: false,
        action: 'adjusted',
        note: `已裁剪调整至 ${presetSize.width}x${presetSize.height}`,
      })
      return { verify, adjusted, finalUrl: adjusted.dataUrl }
    }

    // 不自动调整，仅记录
    appendLog({
      timestamp: new Date().toISOString(),
      imageUrl: imageUrl.slice(0, 80),
      expectedSizeId: presetSize.id,
      expectedWidth: verify.expected.width,
      expectedHeight: verify.expected.height,
      actualWidth: verify.actual.width,
      actualHeight: verify.actual.height,
      match: false,
      action: 'none',
      note: `偏差 ${verify.deviationPercent.toFixed(1)}%`,
    })
    return { verify, finalUrl: imageUrl }
  } catch (err) {
    appendLog({
      timestamp: new Date().toISOString(),
      imageUrl: imageUrl.slice(0, 80),
      expectedSizeId: presetSize.id,
      expectedWidth: presetSize.width,
      expectedHeight: presetSize.height,
      actualWidth: 0,
      actualHeight: 0,
      match: false,
      action: 'error',
      note: err instanceof Error ? err.message : String(err),
    })
    return {
      verify: {
        match: false,
        expected: { width: presetSize.width, height: presetSize.height },
        actual: { width: 0, height: 0 },
        presetSize,
        deviationPercent: 100,
      },
      finalUrl: imageUrl,
    }
  }
}
