#!/usr/bin/env node

/**
 * Theme Swap Workflow — 合并服务
 *
 * 一个端口提供全部功能：
 *   - Figma 桥接 + 插件通信（/command /poll /result）
 *   - API 代理（/api/*）
 *   - Web 前端（/）
 *
 * 端口: 3000（可环境变量 PORT 覆盖）
 */

const http = require('http');
const https = require('https');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIR = __dirname;

// ─── 桥接队列 ──────────────────────────────────────────
const bridgeQueue = [];
const pendingResults = new Map();

function genId() {
  return 'cmd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

// ─── 运行时配置（内存） ────────────────────────────────
const config = { figmaToken: '', deepseekKey: '', deepseekModel: 'deepseek-chat', currentMapping: null };

// ─── 工具 ──────────────────────────────────────────────

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function parseFileUrl(url) {
  const m = url.match(/figma\.com\/(design|file)\/([a-zA-Z0-9]+)/);
  return m ? m[2] : url;
}

// ─── Figma API ─────────────────────────────────────────

function figmaAPI(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.figma.com', path: '/v1' + path, method: 'GET',
      headers: { 'X-Figma-Token': token }
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(new Error('Figma API 解析失败')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── 提取画板 ──────────────────────────────────────────

function extractFrames(node, minW, maxW) {
  const frames = [];
  function walk(n) {
    if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE') {
      const w = n.absoluteBoundingBox ? n.absoluteBoundingBox.width : 0;
      const h = n.absoluteBoundingBox ? n.absoluteBoundingBox.height : 0;
      if (w >= (minW || 0) && w <= (maxW || Infinity))
        frames.push({ id: n.id, name: n.name || '(无名)', width: Math.round(w), height: Math.round(h) });
    }
    if (n.children) n.children.forEach(walk);
  }
  walk(node);
  return frames;
}

// ─── DeepSeek API ──────────────────────────────────────

function deepseekChat(messages, apiKey, model) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: model || 'deepseek-chat', messages, temperature: 0.1, max_tokens: 16384
    });
    const opts = {
      hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('DeepSeek 解析失败')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── 提取文件颜色 ──────────────────────────────────────

async function extractFileColors(fileKey, token) {
  const { status, data } = await figmaAPI('/files/' + fileKey + '?depth=3', token);
  if (status !== 200) throw new Error('Figma API ' + status);
  const colors = {}, seen = new Set();
  function walk(n) {
    if (n.fills && Array.isArray(n.fills)) {
      n.fills.forEach(fill => {
        if (fill.type === 'SOLID' && fill.color) {
          const c = fill.color;
          const a = fill.opacity !== undefined ? Math.round(fill.opacity * 100) / 100 : 1;
          const key = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
          if (!seen.has(key)) {
            seen.add(key);
            if (!colors[key]) colors[key] = { rgb: key, r: c.r, g: c.g, b: c.b, a, usage: [] };
            colors[key].usage.push({ node: n.name || '(unnamed)', id: n.id });
          }
        }
      });
    }
    if (n.children) n.children.forEach(walk);
  }
  walk(data.document);
  return Object.values(colors).sort((a, b) => a.r - b.r);
}

// ═══════════════════════════════════════════════════════
// HTTP 服务
// ═══════════════════════════════════════════════════════

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost:' + PORT);
  const p = url.pathname;

  // ─── 桥接：POST /command ───────────────────────────
  if (req.method === 'POST' && p === '/command') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let cmd;
      try { cmd = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'JSON 解析失败' }); }

      const id = genId();
      const timeout = cmd.timeout || 120000;
      bridgeQueue.push({ id, action: cmd.action, data: cmd.data || {}, createdAt: Date.now() });
      console.log('[桥接] 入队: ' + id + ' action=' + cmd.action);

      const timer = setTimeout(() => {
        pendingResults.delete(id);
        const idx = bridgeQueue.findIndex(q => q.id === id);
        if (idx >= 0) bridgeQueue.splice(idx, 1);
        json(res, 504, { error: '执行超时', id });
      }, timeout);

      pendingResults.set(id, {
        resolve: (data) => { clearTimeout(timer); json(res, 200, { success: true, id, data }); },
        reject: (err) => { clearTimeout(timer); json(res, 500, { error: err, id }); },
        timer
      });
    });
    return;
  }

  // ─── 桥接：GET /poll ──────────────────────────────
  if (req.method === 'GET' && p === '/poll') {
    const now = Date.now();
    while (bridgeQueue.length > 0 && (now - bridgeQueue[0].createdAt) > 120000) {
      console.log('[桥接] 丢弃超时: ' + bridgeQueue.shift().id);
    }
    if (bridgeQueue.length === 0) { res.writeHead(204); res.end(); return; }
    const cmd = bridgeQueue.shift();
    console.log('[桥接] 出队: ' + cmd.id + ' action=' + cmd.action);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hasCommand: true, command: cmd }));
    return;
  }

  // ─── 桥接：POST /result/<id> ──────────────────────
  const resultMatch = p.match(/^\/result\/(.+)$/);
  if (req.method === 'POST' && resultMatch) {
    const cmdId = resultMatch[1];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let result;
      try { result = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'JSON 解析失败' }); }
      const pending = pendingResults.get(cmdId);
      if (pending) {
        pendingResults.delete(cmdId);
        result.error ? pending.reject(result.error) : pending.resolve(result.data);
        console.log('[桥接] 结果: ' + cmdId + (result.error ? ' FAIL' : ' OK'));
      } else {
        console.log('[桥接] 丢弃结果: ' + cmdId);
      }
      json(res, 200, { received: true });
    });
    return;
  }

  // ─── 前端 HTML ──────────────────────────────────────
  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    const fp = path.join(DIR, 'public', 'index.html');
    if (fs.existsSync(fp)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(fp));
    } else {
      json(res, 404, { error: '前端文件未找到' });
    }
    return;
  }

  // ─── GET /api/* ──────────────────────────────────────
  if (req.method === 'GET' && p.startsWith('/api/')) {
    // health: 检查插件连接
    if (p === '/api/health') {
      const queueLen = bridgeQueue.length;
      const pendLen = pendingResults.size;
      // 尝试 ping 插件
      const id = genId();
      bridgeQueue.push({ id, action: 'ping', data: {}, createdAt: Date.now() });
      const timer = setTimeout(() => {
        pendingResults.delete(id);
        json(res, 200, { bridge: true, plugin: false, message: '插件未响应' });
      }, 3000);
      pendingResults.set(id, {
        resolve: () => { clearTimeout(timer); json(res, 200, { bridge: true, plugin: true }); },
        reject: () => { clearTimeout(timer); json(res, 200, { bridge: true, plugin: false }); }
      });
      return;
    }
    return json(res, 404, { error: 'Not found' });
  }

  // ─── POST /api/* ─────────────────────────────────────
  if (req.method === 'POST' && p.startsWith('/api/')) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      let params;
      try { params = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'JSON 解析失败' }); }

      try {
        switch (p) {

          // ── 配置 ──────────────────────────────────────
          case '/api/config': {
            if (params.figmaToken) config.figmaToken = params.figmaToken;
            if (params.deepseekKey) config.deepseekKey = params.deepseekKey;
            if (params.deepseekModel) config.deepseekModel = params.deepseekModel;
            json(res, 200, { ok: true });
            break;
          }

          // ── 列出画板 ─────────────────────────────────
          case '/api/list-frames': {
            const ft = params.figmaToken || config.figmaToken;
            if (!ft) return json(res, 400, { error: '未配置 Figma Token' });
            const fk = parseFileUrl(params.fileUrl || params.fileKey);
            if (!fk) return json(res, 400, { error: '无效链接' });
            const { status, data } = await figmaAPI('/files/' + fk + '?depth=3', ft);
            if (status !== 200) return json(res, 400, { error: 'Figma API: ' + (data.err || status) });
            const all = extractFrames(data.document, 0, Infinity);
            const filtered = extractFrames(data.document, params.minWidth || 0, params.maxWidth || Infinity);
            json(res, 200, { fileKey: fk, fileName: data.name, allFrames: all.length, filteredFrames: filtered, totalFiltered: filtered.length });
            break;
          }

          // ── 执行换色 ─────────────────────────────────
          case '/api/swap': {
            const ft = params.figmaToken || config.figmaToken;
            if (!ft) return json(res, 400, { error: '未配置 Figma Token' });
            const fk = parseFileUrl(params.fileUrl || params.fileKey);
            if (!fk) return json(res, 400, { error: '无效链接' });
            const dir = params.direction || 'dark-to-light';
            const minW = params.minWidth || 0;
            const maxW = params.maxWidth || Infinity;
            const skipLocked = params.skipLocked !== false;

            // 获取画板
            const { status, data } = await figmaAPI('/files/' + fk + '?depth=3', ft);
            if (status !== 200) return json(res, 400, { error: 'Figma API 错误' });
            const frames = extractFrames(data.document, minW, maxW);
            if (frames.length === 0) return json(res, 400, { error: '无符合条件的画板' });

            const nodeIds = frames.map(f => f.id);
            const autoArgs = [
              path.join(DIR, 'automate-swap.js'), 'auto',
              '--node-ids', nodeIds.join(','),
              '--direction', dir
            ];
            if (skipLocked === false) autoArgs.push('--no-skip-locked');

            // 通过子进程调用（它会走桥接通信）
            const child = cp.execFile('node', autoArgs, {
              env: Object.assign({}, process.env, { FIGMA_TOKEN: ft }),
              timeout: 180000
            });
            let stderr = '';
            child.stderr.on('data', c => stderr += c);
            await new Promise((resolve, reject) => {
              child.on('close', code => {
                code === 0 ? resolve() : reject(new Error(stderr.split('\n').filter(l => l.includes('[错误]')).join('; ') || '退出码 ' + code));
              });
              child.on('error', reject);
            });
            json(res, 200, { success: true, frames, nodeIds, direction: dir });
            break;
          }

          // ── AI 生成映射 ──────────────────────────────
          case '/api/ai/generate-mapping': {
            const dk = params.deepseekKey || config.deepseekKey;
            if (!dk) return json(res, 400, { error: '未配置 DeepSeek Key' });
            const ft = params.figmaToken || config.figmaToken;
            if (!ft) return json(res, 400, { error: '未配置 Figma Token' });
            const lfk = parseFileUrl(params.lightFileUrl);
            const dfk = parseFileUrl(params.darkFileUrl);
            if (!lfk || !dfk) return json(res, 400, { error: '请提供两个 Figma 文件链接' });

            const [lc, dc] = await Promise.all([extractFileColors(lfk, ft), extractFileColors(dfk, ft)]);
            const prompt = `你是 Figma 主题颜色映射专家。根据以下 Light/Dark 颜色列表生成映射。

Light (${lc.length}):
${JSON.stringify(lc.map(c => ({ rgb: c.rgb, r: c.r, g: c.g, b: c.b, a: c.a })))}

Dark (${dc.length}):
${JSON.stringify(dc.map(c => ({ rgb: c.rgb, r: c.r, g: c.g, b: c.b, a: c.a })))}

生成 JSON 数组，格式: {"name":"描述","light":{"r":0.1,"g":0.2,"b":0.3,"a":1},"dark":{"r":0.9,"g":0.8,"b":0.7,"a":1}}
只输出 JSON。`;

            const aiResp = await deepseekChat([
              { role: 'system', content: '你是一个 Figma 主题颜色映射专家。只输出 JSON。' },
              { role: 'user', content: prompt }
            ], dk, config.deepseekModel);

            if (aiResp.error) return json(res, 400, { error: 'DeepSeek 错误' });
            let raw = aiResp.choices?.[0]?.message?.content || '';
            const jm = raw.match(/\[\s*\{.*\}\s*\]/s);
            if (jm) raw = jm[0];
            try {
              const mapping = JSON.parse(raw);
              json(res, 200, { total: mapping.length, mapping });
            } catch (e) {
              json(res, 400, { error: 'AI 返回 JSON 无效，请重试' });
            }
            break;
          }

          // ── 上传映射规则 ────────────────────────────
          case '/api/upload-mapping': {
            if (!params.mapping || !Array.isArray(params.mapping)) return json(res, 400, { error: 'mapping 必须是数组' });
            config.currentMapping = params.mapping;
            json(res, 200, { ok: true, total: params.mapping.length });
            break;
          }

          case '/api/current-mapping': {
            json(res, 200, { mapping: config.currentMapping || null });
            break;
          }

          // ── 验证 Token ──────────────────────────────
          case '/api/validate-token': {
            const ft = params.figmaToken || config.figmaToken;
            if (!ft) return json(res, 400, { error: '未提供 Token' });
            const { status, data } = await figmaAPI('/me', ft);
            json(res, status === 200 ? { ok: true, email: data.email, handle: data.handle } : { ok: false, error: data.err });
            break;
          }

          case '/api/validate-deepseek': {
            const dk = params.deepseekKey || config.deepseekKey;
            if (!dk) return json(res, 400, { error: '未提供 Key' });
            try {
              const r = await deepseekChat([{ role: 'user', content: 'Hi' }], dk, config.deepseekModel);
              json(res, 200, { ok: true, model: config.deepseekModel });
            } catch (e) {
              json(res, 400, { ok: false, error: e.message });
            }
            break;
          }

          default:
            json(res, 404, { error: '未知接口' });
        }
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

// ─── 兼容桥接端口 8766（Figma 插件硬编码的地址） ──
const bridgeCompat = http.createServer((req, res) => {
  // 只处理桥接路由，其余 404
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost:8766');
  const p = url.pathname;

  // POST /command
  if (req.method === 'POST' && p === '/command') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let cmd;
      try { cmd = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'JSON 解析失败' }); }
      const id = genId();
      const timeout = cmd.timeout || 120000;
      bridgeQueue.push({ id, action: cmd.action, data: cmd.data || {}, createdAt: Date.now() });
      console.log('[桥接8766] 入队: ' + id + ' action=' + cmd.action);
      const timer = setTimeout(() => {
        pendingResults.delete(id);
        const idx = bridgeQueue.findIndex(q => q.id === id);
        if (idx >= 0) bridgeQueue.splice(idx, 1);
        json(res, 504, { error: '执行超时', id });
      }, timeout);
      pendingResults.set(id, {
        resolve: (data) => { clearTimeout(timer); json(res, 200, { success: true, id, data }); },
        reject: (err) => { clearTimeout(timer); json(res, 500, { error: err, id }); }
      });
    });
    return;
  }

  // GET /poll
  if (req.method === 'GET' && p === '/poll') {
    const now = Date.now();
    while (bridgeQueue.length > 0 && (now - bridgeQueue[0].createdAt) > 120000) {
      console.log('[桥接8766] 丢弃超时: ' + bridgeQueue.shift().id);
    }
    if (bridgeQueue.length === 0) { res.writeHead(204); res.end(); return; }
    const cmd = bridgeQueue.shift();
    console.log('[桥接8766] 出队: ' + cmd.id + ' action=' + cmd.action);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hasCommand: true, command: cmd }));
    return;
  }

  // POST /result/<id>
  const resultMatch8766 = p.match(/^\/result\/(.+)$/);
  if (req.method === 'POST' && resultMatch8766) {
    const cmdId = resultMatch8766[1];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let result;
      try { result = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'JSON 解析失败' }); }
      const pending = pendingResults.get(cmdId);
      if (pending) {
        pendingResults.delete(cmdId);
        result.error ? pending.reject(result.error) : pending.resolve(result.data);
        console.log('[桥接8766] 结果: ' + cmdId + (result.error ? ' FAIL' : ' OK'));
      }
      json(res, 200, { received: true });
    });
    return;
  }

  // GET /health
  if (req.method === 'GET' && (p === '/health' || p === '/')) {
    json(res, 200, { status: 'ok', queueLength: bridgeQueue.length, pendingResults: pendingResults.size });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

bridgeCompat.listen(8766, () => {
  console.log('  [兼容] 桥接端口: http://localhost:8766');
});

server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Theme Swap Workflow                  ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  端口: http://localhost:' + String(PORT).padEnd(5) + '             ║');
  console.log('║  前端: http://localhost:' + String(PORT).padEnd(5) + '/          ║');
  console.log('║  桥接: /command  /poll  /result/:id      ║');
  console.log('║  API:  /api/*                            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  启动步骤:');
  console.log('  1. Figma → 插件 → Theme Color Swapper');
  console.log('  2. 浏览器 → http://localhost:' + PORT);
});
