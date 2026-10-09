# HMI Codex & Theme Tools

1. 解压插件包。
2. 在 Figma Desktop 中选择 `Plugins → Development → Import plugin from manifest…`。
3. 选择本目录下的 `manifest.json`。
4. 在 HMI Agent Studio 的“Codex 生成 Figma”中生成页面并点击“复制到 Figma 插件”。
5. 在 Figma 中运行 `HMI Codex & Theme Tools → Codex 生成 HMI 原生页面`，从剪贴板粘贴并创建。

Codex 导入会新建一个页面，并通过 Figma Plugin API 创建 Frame、Component、Rectangle、Ellipse、Line、Text 与颜色样式。所有图层均可编辑，不包含 PNG，也不经过 SVG 转换。

如需使用换色工具，先运行 `配置颜色映射`，粘贴并保存 HMI Agent Studio 生成的规则；选择画板、分组或组件后再运行 `Light → Dark` 或 `Dark → Light`。

插件使用 Figma Plugin API 直接修改当前选择中的填充、描边、渐变、阴影和文字颜色。锁定节点会被跳过，所有更改均可使用 Figma 撤销。
