// Send headers and heartbeats while a synchronous image provider is working.
// A stream transport's HTTP 200 is not generation success: preserve the result status.
export function streamImageGeneration(run, heartbeatMs = 5000) {
  const encoder = new TextEncoder()
  let closed = false
  let heartbeat
  let deadline
  const cleanup = () => { clearInterval(heartbeat); clearTimeout(deadline) }
  const stream = new ReadableStream({
    start(controller) {
      const finish = (status, payload) => {
        if (closed) return
        closed = true
        cleanup()
        controller.enqueue(encoder.encode(`event: result\ndata: ${JSON.stringify({ status, payload })}\n\n`))
        controller.close()
      }
      controller.enqueue(encoder.encode(': connected\n\n'))
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(': generating\n\n'))
      }, heartbeatMs)
      deadline = setTimeout(() => finish(504, { ok: false, error: '生成等待超时，未自动重复提交。请稍后再试。' }), 190000)
      Promise.resolve().then(run).then(async response => {
        const payload = await response.json()
        finish(response.status, payload)
      }).catch(() => finish(502, { ok: false, error: '生成服务响应异常，请稍后重试。' }))
    },
    cancel() { closed = true; cleanup() },
  })
  return new Response(stream, { headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'X-Accel-Buffering': 'no',
  } })
}
