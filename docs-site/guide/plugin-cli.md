# 安装外部组件（CLI）

外部组件不是靠手写 profile 配置安装的，使用安装命令：

```bash
# 安装到仓库内置 profile
pnpm week-report plugin add ../my-widget

# 安装到当前用户的应用 profile
pnpm week-report plugin add ../my-widget --user

# 查看 / 移除
pnpm week-report plugin list --user
pnpm week-report plugin remove my-widget --user
```

也可以直接使用 CLI bin：

```bash
week-report plugin add <包名|本地目录> [--profile <dir>|--user]
```

## 命令做了什么

1. 在目标 profile 中执行 `pnpm add <spec>`；
2. 读取安装后包的 `package.json`；
3. 如果包声明了 `weekReport.bundle.patch`，自动把包名加入
   `weekReport.profile.bundles`；
4. 如果没有组合包声明，只作为普通依赖安装，不进入 profile。

它不会复制 `node_modules`，也不会手写一份固定配置。组件包可以自己决定构建产物在哪，只要 `package.json` 的
`weekReport.client.entry` 指向它；发布到 npm 后直接写包名即可。

## 包要求

```json
{
  "name": "my-widget",
  "main": "lib/node.js",
  "exports": {
    ".": "./lib/node.js",
    "./client": "./lib/client.js"
  },
  "weekReport": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "entry": "./lib/client.js" }
  }
}
```

外部项目通过 `@week-report/plugin-api` 注册组件，不依赖宿主源码。
