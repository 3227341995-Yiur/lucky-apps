# Contributing

## 环境

Node ≥ 24、pnpm 12+。`pnpm install` 会安装 lefthook hooks。

## 常用命令

```bash
pnpm dev            # Vite 前端开发
pnpm build          # 前端 + 文档（dist/docs）
pnpm plugins:build  # 构建全部内置插件
pnpm packages:build # tsdown 编译 packages/core
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

1. 在 `packages/extensions/<name>/` 创建标准包：`package.json`（`weekReport.client.entry`、`kind`、`bundle.patch`）、`vite.config.ts`（`createExtensionConfig`）、`tsconfig.json`（extends 根 `tsconfig.base.json`）、`cordis.patch.yml`。
2. `src/index.ts` 导出 `definePlugin({ name, apply(ctx) { ctx.navigation.register(...) } })`。
3. 需要 Node 能力时写 `src/node-extra.ts`，构建时编译进 `lib/node-extra.js`。
4. `pnpm plugins:build && pnpm profile:build` 验证。
