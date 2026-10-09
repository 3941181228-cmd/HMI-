import { handleApi } from './sites-api.mjs'

// Share the same validated Figma implementation with the hosted Worker.
export async function listFramesNode(req, res, env = process.env) {
  try {
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers || {})) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : value)
    }
    const protocol = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]
    const url = `${protocol}://${req.headers.host || 'localhost'}/api/figma/list-frames`
    let body
    if (req.method === 'POST') {
      if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      else {
        const chunks = []; let bytes = 0
        for await (const chunk of req) {
          bytes += Buffer.byteLength(chunk)
          if (bytes > 65536) { res.statusCode = 413; res.end(JSON.stringify({ ok: false, error: '请求内容过大' })); return }
          chunks.push(Buffer.from(chunk))
        }
        body = Buffer.concat(chunks).toString()
      }
    }
    const result = await handleApi(new Request(url, { method: req.method, headers, body }), env)
    res.statusCode = result.status
    result.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(await result.text())
  } catch {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: '画板读取服务失败，请检查服务器网络及配置' }))
  }
}
