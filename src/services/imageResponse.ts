export async function readImageResponse(response: Response): Promise<{ status: number; payload: any }> {
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const payload = await response.json().catch(() => { throw new Error(`生成接口未返回有效数据（HTTP ${response.status}），连接可能已中断。`) })
    return { status: response.status, payload }
  }
  if (!response.body) throw new Error('生成连接没有返回数据流')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) throw new Error('生成连接提前结束，尚未收到图片结果。未自动重复提交。')
      buffer += decoder.decode(value, { stream: true })
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (!event.startsWith('event: result\n')) continue
        const data = event.split('\n').find(line => line.startsWith('data: '))?.slice(6)
        if (!data) throw new Error('生成服务未返回结果数据')
        return JSON.parse(data)
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
