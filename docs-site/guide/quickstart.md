# 快速开始

Lucky Apps 由 Tauri 窗口 + Cordis Node 服务 + Vue 前端组成。扩展分三类：

```text
src-tauri/target/profile/
├─ package.json        la.profile.bundles
├─ cordis.yml          []
├─ cordis.patch.yml    用户 patch
└─ node_modules/
   ├─ my-widget/        插件包
   └─ ...

resources/
├─ css/theme.css
└─ js/my-plugin.js
```

可以在「设置 → 扩展」中复制 profile / 资源路径、重新扫描或热加载功能插件；内置 `reports` 插件的组件在「设置 → 周报」维护。

## 三步开始

1. **插件包**：在 `packages/extensions/<name>` 里用标准 Vue 3 + TypeScript 开发。`package.json` 声明 `la.bundle.patch` / `la.client.entry` / `la.kind`，`cordis.patch.yml` 必须入库；`pnpm plugins:build` 输出到包内 `lib/`，`pnpm profile:build` 打包并安装到 profile。
2. **脚本 / 样式**：放入 `resources/js` / `resources/css`，服务端 `/api/boot` 清单会下发。
3. **启用**：到「设置 → 扩展」确认已加载；profile 变化由 Node 服务自动重载。

发布到 npm 供搜索安装的插件，必须在 `package.json` 声明 `keywords: ["cordis", "lucky-app"]`。安装面板只检索带 `lucky-app` 标签的包，本地目录、GitHub / Git 仓库和直接包名安装不受限制。

::: warning 加载顺序
插件脚本按文件名排序加载。需要强顺序时使用数字前缀，例如 `01-init.js`、`02-search.js`。
:::
