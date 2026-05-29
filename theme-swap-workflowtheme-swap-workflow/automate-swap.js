#!/usr/bin/env node

/**
 * 自动化换色脚本 — BE12 Theme Color Swapper
 *
 * 读取 BE12_color_mapping_rules.json，通过桥接服务器通知
 * Figma 插件扫描/匹配/应用换色。
 *
 * ─── 使用方式 ───
 *
 *   # 前提：bridge-server.js 已运行 + Figma 插件已打开
 *
 *   1) 扫描画板颜色:
 *      node automate-swap.js scan --node-ids "2004:2,2004:3"
 *
 *   2) 从 Light 切换到 Dark:
 *      node automate-swap.js apply --direction light-to-dark --node-ids "2004:2,2004:3"
 *
 *   3) 一键扫描+换色:
 *      node automate-swap.js auto --direction light-to-dark --node-ids "2004:2,2004:3"
 *
 *   4) 获取文件所有画板 (需要 FIGMA_TOKEN 环境变量):
 *      export FIGMA_TOKEN="your-personal-access-token"
 *      node automate-swap.js list-frames --file-key 5CudGNyGhckKyHW0OFPOyx
 *
 *   5) 按尺寸筛选 + 一键换色:
 *      node automate-swap.js auto \
 *        --direction light-to-dark \
 *        --file-key 5CudGNyGhckKyHW0OFPOyx \
 *        --min-width 360 --max-width 1440
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8766';
const FIGMA_API = 'https://api.figma.com';

// ─── 读取颜色映射规则 ──────────────────────────────────

const RULES_PATH = path.join(__dirname, 'BE12_color_mapping_rules.json');
let colorRules = [];

try {
  colorRules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
  console.log(`[加载] ${colorRules.length} 条颜色映射规则`);
} catch (e) {
  console.error(`[错误] 无法读取颜色映射文件: ${RULES_PATH}`);
  console.error(e.message);
  process.exit(1);
}

// ─── 工具函数 ──────────────────────────────────────────

function roundTo4(n) {
  return Math.round(n * 10000) / 10000;
}

function colorToKey(r, g, b, a) {
  const rr = roundTo4(r);
  const gg = roundTo4(g);
  const bb = roundTo4(b);
  const aa = a !== undefined ? roundTo4(a) : 1;
  if (aa === 1) return `rgb(${rr},${gg},${bb})`;
  return `rgba(${rr},${gg},${bb},${aa})`;
}

function colorsMatch(c1, c2, tolerance) {
  tolerance = tolerance || 0.02;
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance &&
    Math.abs((c1.a || 1) - (c2.a || 1)) <= tolerance
  );
}

// ─── 颜色匹配: 从规则中找匹配的颜色映射 ────────────────

function parseColorKey(colorKey) {
  // 解析 "rgb(0.1,0.2,0.3)" 或 "rgba(0.1,0.2,0.3,0.5)"
  const rgba = colorKey.replace(/[rgba()]/g, '').split(',').map(Number);
  if (rgba.length >= 3) {
    return {
      r: rgba[0],
      g: rgba[1],
      b: rgba[2],
      a: rgba.length >= 4 ? rgba[3] : 1
    };
  }
  return null;
}

function buildMappings(scannedColors, direction, tolerance) {
  const mappings = [];
  let matched = 0;
  let unmatched = 0;

  for (const scanned of scannedColors) {
    // 从 colorKey 解析颜色值，不依赖插件返回的 color 对象
    const sc = parseColorKey(scanned.colorKey);
    if (!sc) {
      console.log(`  ⚠️ 无法解析: ${scanned.colorKey}`);
      unmatched++;
      continue;
    }

    let found = false;

    for (const rule of colorRules) {
      const source = direction === 'light-to-dark' ? rule.light : rule.dark;
      const target = direction === 'light-to-dark' ? rule.dark : rule.light;

      if (colorsMatch(sc, source, tolerance)) {
        mappings.push({
          sourceColorKey: scanned.colorKey,
          strategy: 'raw',
          targetColor: {
            r: target.r,
            g: target.g,
            b: target.b,
            a: target.a !== undefined ? target.a : 1
          }
        });
        matched++;
        found = true;
        break;
      }
    }

    if (!found) {
      // 放宽容差再试一次
      const looseMatch = colorRules.find((rule) => {
        const source = direction === 'light-to-dark' ? rule.light : rule.dark;
        return colorsMatch(sc, source, 0.05);
      });
      if (looseMatch) {
        const target = direction === 'light-to-dark' ? looseMatch.dark : looseMatch.light;
        mappings.push({
          sourceColorKey: scanned.colorKey,
          strategy: 'raw',
          targetColor: {
            r: target.r,
            g: target.g,
            b: target.b,
            a: target.a !== undefined ? target.a : 1
          }
        });
        matched++;
        found = true;
      } else {
        unmatched++;
        console.log(`  ⚠️ 未匹配: ${scanned.hex} (${scanned.colorKey})`);
      }
    }
  }

  return { mappings, matched, unmatched };
}

// ─── 桥接服务器通信 ────────────────────────────────────

function sendCommand(action, data, timeout) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      action: action,
      data: data || {},
      timeout: timeout || 120000
    });

    const options = {
      hostname: 'localhost',
      port: 8766,
      path: '/command',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseBody);
          if (result.success) resolve(result.data);
          else reject(new Error(result.error || '未知错误'));
        } catch (e) {
          reject(new Error('响应解析失败: ' + responseBody));
        }
      });
    });

    req.on('error', (e) => reject(new Error('请求失败: ' + e.message)));
    req.setTimeout(timeout || 120000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(body);
    req.end();
  });
}

// ─── Figma REST API ────────────────────────────────────

function figmaAPI(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.figma.com',
      path: '/v1' + path,
      method: 'GET',
      headers: { 'X-Figma-Token': token }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Figma API 解析失败')); }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ─── 从文件中提取 Frame 节点 ────────────────────────────

function findFrames(node, minWidth, maxWidth) {
  const frames = [];

  function walk(n) {
    if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE') {
      const w = n.absoluteBoundingBox ? n.absoluteBoundingBox.width : 0;
      const h = n.absoluteBoundingBox ? n.absoluteBoundingBox.height : 0;
      if (w >= (minWidth || 0) && w <= (maxWidth || Infinity)) {
        frames.push({
          id: n.id,
          name: n.name,
          width: Math.round(w),
          height: Math.round(h)
        });
      }
    }
    if (n.children) {
      for (const child of n.children) walk(child);
    }
  }

  walk(node);
  return frames;
}

// ─── 命令处理 ──────────────────────────────────────────

async function cmdScan(nodeIds) {
  console.log(`[扫描] ${nodeIds.length} 个画板...`);
  const result = await sendCommand('scan-nodes', { nodeIds });
  console.log(`[扫描] 完成: ${result.colors.length} 种颜色`);
  for (const c of result.colors) {
    console.log(`  ${c.hex}  (${c.source}) x${c.count}`);
  }
  return result;
}

async function cmdApply(nodeIds, direction, dryRun, skipLocked) {
  // 先扫描
  console.log(`[应用] 扫描颜色...`);
  const scanResult = await sendCommand('scan-nodes', { nodeIds });
  console.log(`[应用] 扫描到 ${scanResult.colors.length} 种颜色`);

  if (scanResult.colors.length === 0) {
    console.log('[应用] 无颜色可替换，跳过');
    return;
  }

  // 匹配映射
  const { mappings, matched, unmatched } = buildMappings(scanResult.colors, direction);
  console.log(`[应用] 匹配: ${matched} 条 | 未匹配: ${unmatched} 条`);

  if (mappings.length === 0) {
    console.log('[应用] 无匹配映射，跳过');
    return;
  }

  if (dryRun) {
    console.log(`[应用] (DRY RUN) 将替换 ${mappings.length} 条颜色`);
    return { dryRun: true, matches: mappings.length };
  }

  // 执行替换
  console.log(`[应用] 执行替换 (${mappings.length} 条映射)...`);
  console.log(`[应用] 跳过锁定图层: ${skipLocked !== false}`);
  const result = await sendCommand('apply-swap', {
    nodeIds,
    mappings,
    skipLocked: skipLocked !== false
  });
  console.log(`[应用] ✅ 完成! 替换了 ${result.changed} 处颜色`);
  return result;
}

// ─── 主入口 ────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  let nodeIds = [];
  let direction = 'light-to-dark';
  let fileKey = null;
  let minWidth = 0;
  let maxWidth = Infinity;
  let dryRun = false;
  let skipLocked = true;

  // 解析参数
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--node-ids':
        nodeIds = (args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--direction':
        direction = args[++i] || 'light-to-dark';
        break;
      case '--file-key':
        fileKey = args[++i];
        break;
      case '--min-width':
        minWidth = parseFloat(args[++i]) || 0;
        break;
      case '--max-width':
        maxWidth = parseFloat(args[++i]) || Infinity;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--skip-locked':
        skipLocked = true;
        break;
      case '--no-skip-locked':
        skipLocked = false;
        break;
      case '--help':
      case '-h':
        printHelp();
        return;
    }
  }

  if (!mode || mode === 'help') {
    printHelp();
    return;
  }

  // 先检查桥接服务器连通性
  try {
    const ping = await sendCommand('ping', {});
    console.log(`[状态] 插件在线 ✓  (${ping.status})`);
  } catch (e) {
    console.error('[错误] 插件未连接。请确保:');
    console.error('  1) bridge-server.js 已运行 (node bridge-server.js)');
    console.error('  2) Figma 中已打开 Theme Color Swapper 插件');
    console.error('  3) 文件已在 Figma 中打开');
    process.exit(1);
  }

async function detectMode(nodeIds) {
  console.log('[检测] 分析当前颜色模式...');
  try {
    const result = await sendCommand('detect-mode', {
      nodeIds: nodeIds && nodeIds.length > 0 ? nodeIds : undefined
    });
    console.log(`[检测] 模式: ${result.mode}`);
    return result.mode;
  } catch (e) {
    console.log('[检测] 失败，使用默认方向');
    return null;
  }
}

  switch (mode) {
    case 'scan': {
      if (nodeIds.length === 0) {
        console.error('[错误] 请指定 --node-ids');
        process.exit(1);
      }
      await cmdScan(nodeIds);
      break;
    }

    case 'detect': {
      const mode = await detectMode(nodeIds);
      if (mode === 'light' || mode === 'dark') {
        const dir = mode === 'light' ? 'light-to-dark' : 'dark-to-light';
        console.log(`[检测] 建议方向: ${dir}`);
      } else {
        console.log('[检测] 无法确定模式');
      }
      break;
    }

    case 'apply': {
      if (nodeIds.length === 0) {
        console.error('[错误] 请指定 --node-ids');
        process.exit(1);
      }
      await cmdApply(nodeIds, direction, dryRun, skipLocked);
      break;
    }

    case 'auto': {
      // 自动检测模式（如果没指定方向）
      if (!args.includes('--direction')) {
        const autoMode = await detectMode(nodeIds);
        if (autoMode === 'light') {
          direction = 'light-to-dark';
        } else if (autoMode === 'dark') {
          direction = 'dark-to-light';
        }
        console.log(`[自动] 方向: ${direction}`);
      }

      // 如果提供了 file-key 但没有 node-ids，从 Figma API 获取
      if (nodeIds.length === 0 && fileKey) {
        const token = process.env.FIGMA_TOKEN;
        if (!token) {
          console.error('[错误] 需要设置 FIGMA_TOKEN 环境变量');
          console.error('  export FIGMA_TOKEN="your-personal-access-token"');
          process.exit(1);
        }

        console.log(`[自动] 从 Figma API 获取文件节点...`);
        const fileData = await figmaAPI(`/files/${fileKey}?depth=3`, token);
        const frames = findFrames(fileData.document, minWidth, maxWidth);
        console.log(`[自动] 找到 ${frames.length} 个符合条件的画板`);

        if (frames.length === 0) {
          console.log('[自动] 无符合条件的画板，退出');
          return;
        }

        frames.forEach((f) => console.log(`  ${f.id}  ${f.name}  (${f.width}x${f.height})`));
        nodeIds = frames.map((f) => f.id);
      }

      if (nodeIds.length === 0) {
        console.error('[错误] 未指定 node-ids 且无法从 API 获取');
        process.exit(1);
      }

      console.log(`[自动] 跳过锁定图层: ${skipLocked}`);
      await cmdApply(nodeIds, direction, dryRun, skipLocked);
      break;
    }

    case 'list-frames': {
      if (!fileKey) {
        console.error('[错误] 请指定 --file-key');
        process.exit(1);
      }
      const token = process.env.FIGMA_TOKEN;
      if (!token) {
        console.error('[错误] 需要设置 FIGMA_TOKEN 环境变量');
        process.exit(1);
      }

      const fileData = await figmaAPI(`/files/${fileKey}?depth=3`, token);
      console.log(`[清单] 文件: ${fileData.name}`);
      const frames = findFrames(fileData.document, 0, Infinity);

      if (minWidth > 0 || maxWidth < Infinity) {
        const filtered = frames.filter((f) =>
          f.width >= minWidth && f.width <= maxWidth
        );
        console.log(`[清单] 共 ${frames.length} 个画板，筛选后 ${filtered.length} 个:`);
        filtered.forEach((f) => console.log(`  ${f.id}  ${f.name}  (${f.width}x${f.height})`));
      } else {
        console.log(`[清单] 共 ${frames.length} 个画板:`);
        frames.forEach((f) => console.log(`  ${f.id}  ${f.name}  (${f.width}x${f.height})`));
      }
      break;
    }

    default:
      console.error(`[错误] 未知模式: ${mode}`);
      printHelp();
  }
}

function printHelp() {
  console.log(`
BE12 Theme Color Swapper — 自动化换色

用法:
  node automate-swap.js <模式> [选项]

模式:
  scan            扫描指定画板的颜色
  detect          自动检测当前模式 (light/dark)
  apply           应用换色
  auto            自动检测模式 + 扫描 + 换色一步完成
  list-frames     列出文件中的画板（需 FIGMA_TOKEN）

选项:
  --node-ids      画板 ID 列表，逗号分隔 (1:2,1:3,2004:2)
  --direction     换色方向: light-to-dark (默认) 或 dark-to-light
  --file-key      Figma 文件 key (从 URL 获取)
  --min-width     最小宽度筛选 (px)
  --max-width     最大宽度筛选 (px)
  --dry-run       仅显示匹配结果，不执行替换

示例:
  # 扫描画板
  node automate-swap.js scan --node-ids "2004:2,2004:3"

  # 一键 Light→Dark
  node automate-swap.js auto --direction light-to-dark --node-ids "2004:2,2004:3"

  # 从 Figma API 获取画板并换色
  export FIGMA_TOKEN="xxx"
  node automate-swap.js auto --direction light-to-dark --file-key 5CudGNyGhckKyHW0OFPOyx --min-width 360 --max-width 1440

  # 从 Dark → Light
  node automate-swap.js auto --direction dark-to-light --node-ids "2004:2"
  `);
}

main().catch((err) => {
  console.error('[错误]', err.message);
  process.exit(1);
});
