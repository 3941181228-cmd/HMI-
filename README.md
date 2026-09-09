# HMI Agent Studio

## 即梦默认 API

后端从 `JIMENG_API_KEY` 读取默认密钥，同时兼容 `ARK_API_KEY`。前端通过 `/api/jimeng/*` 调用，不内置或回传默认密钥。

- 本地开发：将 `.env.example` 复制为 `.env.local`，填写自己的 `JIMENG_API_KEY`，然后运行 `npm run dev`。
- Vercel / Netlify：在部署平台的服务端环境变量中设置 `JIMENG_API_KEY`，重新部署后生效。
- 如果部署平台未配置默认密钥，用户可在设置中手动填写；密钥只保存在当前浏览器，并随即梦请求发送给同源服务端代理验证和调用。
- 当前 HMI 预览站的默认密钥已在其服务端单独配置；克隆仓库不会自动获得该密钥。
- `npm run test:jimeng` 检查默认密钥调用、连接状态、输入校验及错误处理，不调用收费生成接口。

## Figma 默认 Token

后端从 `FIGMA_API_TOKEN` 读取默认 Token。线上用户无需在浏览器中填写即可连接 Figma；如果部署平台没有默认配置，也可以在设置中手动输入并验证，手动 Token 只保存在当前浏览器。

默认 Token 只作为服务端环境变量保存，不写入仓库、前端代码或构建产物。读取设计文件需要 `current_user:read` 与 `file_content:read` 权限。

## OpenAI 默认 API

后端从 `OPENAI_API_KEY` 读取默认密钥，驱动工作台中的 GPT Image 文生图和参考图编辑。默认密钥优先于浏览器本地配置；手动填写的密钥必须验证成功后才会保存在当前浏览器。

密钥只存放在部署平台的服务端环境变量中，不写入前端、仓库或构建产物。默认图像模型为 `gpt-image-1`，可通过 `OPENAI_IMAGE_MODEL` 覆盖。

## Sites 后端构建

保留 `npm run build` 用于原有部署方式。`npm run build:sites` 为已有 Sites 项目生成包含页面、即梦接口和 Figma 代理的 Worker；需要该项目的 `.openai/hosting.json` 及相应服务端环境变量。图片沿用仓库中固定版本的公开资源。
