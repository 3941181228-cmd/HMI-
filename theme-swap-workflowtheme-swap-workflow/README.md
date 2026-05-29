# Theme Swap Workflow

Figma 主题换色自动化工作流。Web 控制台 + 桥接服务 + Figma 插件，三合一。

## 目录结构

```
theme-swap-workflow/
├── server.js              ← 主服务（端口 3000，前端 + API + 桥接全包）
├── start.sh               ← 一键启动脚本
├── package.json           ← 基础配置
├── public/
│   └── index.html         ← Web 前端
├── plugin/                ← Figma 插件（需加载到 Figma Desktop）
│   ├── manifest.json
│   ├── code.js
│   └── ui.html
├── automate-swap.js       ← 换色匹配逻辑
└── BE12_color_mapping_rules.json  ← 颜色映射规则
```

## 快速开始

### 在新电脑上使用

```bash
# 1. 确保装了 Node.js (>= 18)
node -v

# 2. 进入目录
cd theme-swap-workflow

# 3. 启动服务（全功能，单端口）
bash start.sh
# 或: node server.js

# 4. 浏览器打开
open http://localhost:3000

# 5. Figma 中加载插件
#    菜单 → Plugins → Development → "Link existing plugin"
#    选择 plugin/manifest.json
#    （每台电脑只需加载一次，之后自动出现在 Plugin 菜单）

# 6. 在 Figma 中打开一个设计文件
#    菜单 → Plugins → Theme Color Swapper
#    插件面板底部应显示 🟢 已连接
```

### 工作流

```
浏览器              服务                     Figma + 插件
 │                  │                          │
 ├─ 配置 Token ───→ │                          │
 ├─ 贴 Figma 链接 → │── Figma API 获取画板 ──→ │
 ├─ 选尺寸筛选 ────→ │                          │
 ├─ 点"开始执行" ──→ │── 桥接 /command ──────→ │── 扫描颜色
 │                  │                          │── 匹配映射
 │                  │                          │── 替换颜色
 │← 日志/结果 ───── │←── 桥接 /result ─────── │
```

## 端口说明

| 端口 | 用途 |
|------|------|
| 3000 | 主服务（前端 + API + 桥接，单端口） |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |

## 技术栈

- 后端: Node.js (原生 http/https，无框架)
- 前端: 纯 HTML/CSS/JS（无框架，单页）
- Figma 插件: Figma Plugin API
- AI: DeepSeek API（可选，用于自动生成颜色映射）
