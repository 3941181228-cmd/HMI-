// Tripo 3D 模型生成服务模块
// 通过后端代理调用 Tripo v3 API（异步任务模式：提交 → 轮询 → 获取模型 URL）

/** 任务状态枚举（与 Tripo API 对齐） */
export type TripoTaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'unknown'

/**
 * 将 Tripo API 返回的英文错误信息翻译为中文。
 * 按关键词匹配，未命中时返回通用中文提示。
 */
function translateError(raw?: string): string | undefined {
  if (!raw) return undefined
  const msg = raw.toLowerCase()
  // 常见错误关键词 → 中文映射
  const map: Array<[string, string]> = [
    ['not enough credit', '账户额度不足，请充值后重试'],
    ['insufficient credit', '账户额度不足，请充值后重试'],
    ['unauthorized', 'API Key 无效或已过期，请检查配置'],
    ['invalid api key', 'API Key 无效或已过期，请检查配置'],
    ['authentication', '身份认证失败，请检查 API Key'],
    ['rate limit', '请求过于频繁，请稍后再试'],
    ['too many request', '请求过于频繁，请稍后再试'],
    ['task not found', '任务不存在或已失效'],
    ['not found', '任务不存在或已失效'],
    ['invalid prompt', '提示词无效，请重新输入'],
    ['prompt', '提示词内容不合规或不被支持，请修改后重试'],
    ['content moderation', '内容审核未通过，请修改后重试'],
    ['moderation', '内容审核未通过，请修改后重试'],
    ['nsfw', '内容审核未通过，请修改后重试'],
    ['timeout', '请求超时，请稍后重试'],
    ['timed out', '请求超时，请稍后重试'],
    ['internal server error', 'Tripo 服务内部错误，请稍后重试'],
    ['server error', 'Tripo 服务内部错误，请稍后重试'],
    ['service unavailable', 'Tripo 服务暂不可用，请稍后重试'],
    ['bad request', '请求参数有误，请检查输入'],
    ['forbidden', '无访问权限，请检查 API Key 权限'],
    ['quota', '已达到用量上限，请检查账户配额'],
    ['credit', '账户额度不足，请充值后重试'],
  ]
  for (const [kw, zh] of map) {
    if (msg.includes(kw)) return zh
  }
  // 兜底：保留原始信息但前置中文说明
  return `生成失败：${raw}`
}

/** 提交任务结果 */
export interface TripoSubmitResult {
  success: boolean
  taskId?: string
  error?: string
}

/** 轮询任务结果 */
export interface TripoTaskResult {
  success: boolean
  status: TripoTaskStatus
  progress: number
  /** 成功时的模型下载地址，key 为格式名（如 glb / usdz / fbx） */
  models: Record<string, string>
  error?: string
}

/** 提交文生 3D 模型任务 */
export async function textToModel(prompt: string, model?: string): Promise<TripoSubmitResult> {
  try {
    const res = await fetch('/api/tripo/text-to-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model }),
    })
    const data = await res.json()
    if (data.ok && data.task_id) {
      return { success: true, taskId: data.task_id }
    }
    return { success: false, error: translateError(data.error) || '提交任务失败' }
  } catch (err) {
    return { success: false, error: `请求失败：${err instanceof Error ? err.message : String(err)}` }
  }
}

/** 提交图生 3D 模型任务（传入 base64 data URI 格式的参考图） */
export async function imageToModel(image: string, model?: string): Promise<TripoSubmitResult> {
  try {
    const res = await fetch('/api/tripo/image-to-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, model }),
    })
    const data = await res.json()
    if (data.ok && data.task_id) {
      return { success: true, taskId: data.task_id }
    }
    return { success: false, error: translateError(data.error) || '提交任务失败' }
  } catch (err) {
    return { success: false, error: `请求失败：${err instanceof Error ? err.message : String(err)}` }
  }
}

/** 查询单次任务状态 */
export async function queryTask(taskId: string): Promise<TripoTaskResult> {
  try {
    const res = await fetch(`/api/tripo/task?id=${encodeURIComponent(taskId)}`)
    const data = await res.json()
    return {
      success: data.ok === true,
      status: (data.status || 'unknown') as TripoTaskStatus,
      progress: typeof data.progress === 'number' ? data.progress : 0,
      models: data.models || {},
      error: translateError(data.error),
    }
  } catch (err) {
    return {
      success: false,
      status: 'unknown',
      progress: 0,
      models: {},
      error: `请求失败：${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * 提交并轮询直至任务结束（成功 / 失败 / 取消）。
 * 传入 image 时走图生 3D，否则走文生 3D。
 * @param onProgress 每次轮询回调，用于更新 UI 进度
 * @param interval 轮询间隔（毫秒），默认 3000
 * @param timeout 超时时间（毫秒），默认 5 分钟
 */
export async function generateModelWithPoll(
  prompt: string,
  model?: string,
  onProgress?: (result: TripoTaskResult) => void,
  interval = 3000,
  timeout = 5 * 60 * 1000,
  image?: string,
): Promise<TripoTaskResult> {
  // 1. 提交任务（有参考图走图生 3D，否则走文生 3D）
  const submit = image
    ? await imageToModel(image, model)
    : await textToModel(prompt, model)
  if (!submit.success || !submit.taskId) {
    return { success: false, status: 'failed', progress: 0, models: {}, error: submit.error }
  }

  // 2. 轮询任务状态
  const start = Date.now()
  while (Date.now() - start < timeout) {
    await new Promise((r) => setTimeout(r, interval))
    const result = await queryTask(submit.taskId)
    onProgress?.(result)

    if (result.status === 'success') return result
    if (result.status === 'failed' || result.status === 'cancelled') {
      return { ...result, error: result.error || '任务失败或已取消' }
    }
    // queued / running / unknown → 继续轮询
  }

  return {
    success: false,
    status: 'unknown',
    progress: 0,
    models: {},
    error: '任务超时，请稍后在历史记录中查看',
  }
}

/** 将 Tripo 模型 URL 包装为本地代理地址，规避浏览器 CORS 限制 */
export function proxyModelUrl(modelUrl: string): string {
  return `/api/tripo/proxy-model?url=${encodeURIComponent(modelUrl)}`
}
