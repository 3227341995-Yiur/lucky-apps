# 快速开始

周报由 Tauri 窗口 + Cordis Node 服务组成。扩展分两类：

```text
src-tauri/target/profile/
├─ package.json        weekReport.profile.bundles
├─ cordis.yml          []
├─ cordis.patch.yml    用户 patch
└─ node_modules/
   ├─ my-widget/        组件包
   └─ ...

resources/
├─ css/theme.css
└─ js/my-plugin.js
```

可以在「设置 → 扩展」中复制 profile / 资源路径、重新扫描或热加载功能插件；列组件与画布组件在「设置 → 周报组件」维护。

## 三步开始

1. **组件包**：在 `plugins/<name>` 里用标准 Vue 3 + TypeScript 开发，`pnpm plugins:build` 输出到包内 `lib/client.js`；`pnpm profile:build` 打包并 `pnpm install` 到 `src-tauri/target/profile/node_modules`，宿主按 `weekReport.client.entry` 自动加载，不需要 `cordis.patch.yml`。
2. **脚本 / 样式**：放入 `resources/js` / `resources/css`，服务端 `/api/boot` 清单会下发。
3. **启用**：到「设置 → 扩展」确认已加载；profile 变化由 Node 服务自动重载。

::: warning 加载顺序
插件脚本按文件名排序加载。需要强顺序时使用数字前缀，例如 `01-init.js`、`02-search.js`。
:::
