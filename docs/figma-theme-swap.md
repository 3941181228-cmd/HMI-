# Figma 插件换色

网页不再依赖旧桥接服务器。画板读取走 `POST /api/figma/list-frames`，Token 通过 `X-Figma-Token` 请求头传递；部署配置的 `FIGMA_API_TOKEN` 优先。颜色规则仅在本页处理，不上传到桥接服务器。

1. 可选：填写文件链接并读取真实画板，打开需要处理的画板。
2. 添加实际的浅色/深色颜色对，或导入 JSON。支持六位/八位十六进制颜色，以及已有 RGB 对象格式。
3. 下载 `/downloads/hmi-theme-swap-plugin.zip`，解压后在 Figma Desktop 的开发插件菜单导入 manifest.json。
4. 运行插件的「配置颜色映射」，粘贴网页复制的 JSON 并保存。
5. 在 Figma 内选中目标画板，运行 Light → Dark 或 Dark → Light。插件自动跳过锁定图层，以插件反馈为准。

网页勾选画板仅作操作清单，不能远程控制 Figma 选区。网页复制或下载规则也不表示已完成换色。读取接口不可用时仍可配置规则并在插件中操作。

## 部署

- 拉取最新 GitHub main，运行 `npm ci`、`npm run build`，按现有平台流程重新部署。
- Sites 使用 `server/sites-api.mjs`；Vite 开发服务器、Vercel 与 Netlify 已增加画板读取接口适配。
- 自建 Node 服务可将 `server/figma-list-frames-node.mjs` 的 `listFramesNode` 挂载到 `POST /api/figma/list-frames`。仅部署 dist 静态文件不足以提供 API；需在实际后端挂载该接口并将 /api 请求转发过去。
- 内网部署需确认服务端可访问 Figma API，并配置有效 Token 或允许网页请求携带 Token。

此流程不需要 DeepSeek Key、`/api/health`、`/api/swap` 或 `node server.js`。
