# Contributing

## 环境

Node ≥ 24、pnpm 12+。`pnpm install` 会安装 lefthook hooks。

## 常用命令

```bash
pnpm dev            # Vite 前端开发
pnpm build          # 前端 + 文档（dist/docs）
pnpm plugins:build  # 构建全部内置插件
pnpm packages:build # tsdown 编译 packages/bundle、client、sdk
pnpm profile:build  # 打包并安装 Cordis profile
pnpm test           # node --test 单元测试
pnpm lint           # oxlint（含 @stylistic 格式规则）
pnpm lint:fix       # 自动修复格式
pnpm tauri:dev      # 桌面调试
pnpm tauri:build    # 打包安装程序
```

## 代码规范

对齐 dsh：oxlint + `@stylistic`（2 空格、单引号、无分号、trailing comma、140 列）、
`@editorconfig`（LF / UTF-8 / 末尾换行）。提交必须 lint 零告警。

## 新增内置插件

1. 在 `packages/extensions/<name>/` 创建标准包：`package.json`（`keywords: ["cordis", "lucky-app"]`、`weekReport.client.entry`、`kind`、`bundle.patch`）、`vite.config.ts`（`createExtensionConfig`）、`tsconfig.json`（extends 根 `tsconfig.base.json`）、`cordis.patch.yml`。插件依赖和版本由包自己的 `package.json` 声明。
2. `src/index.ts` 导出 `definePlugin({ name, apply(ctx) { ctx.navigation.register(...) } })`。
3. 需要 Node 能力时写 `src/node.ts`，用 `nodeHalf()` 或 `createExtensionConfig({ withNodeHalf: false })` 构建成 `lib/node.js`。
4. `pnpm plugins:build && pnpm profile:build` 验证。

内置插件 `package.json` 必须声明 `keywords: ["cordis", "lucky-app"]`，与外部插件保持一致；设置中心的 npm 搜索只展示带该标签的包。
