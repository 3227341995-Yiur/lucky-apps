# @week-report/cli

外部 Cordis 组件安装命令。

```bash
# 安装到仓库内置 profile
week-report plugin add ../my-widget

# 安装到当前用户的应用 profile
week-report plugin add ../my-widget --user

# 查看 / 移除
week-report plugin list --user
week-report plugin remove my-widget --user
```

`add` 会在 profile 里执行 `pnpm add`，读取包的 `weekReport.bundle.patch`，
自动把包名加入 `weekReport.profile.bundles`。不是手写配置，也不是复制 node_modules。

组件包需要先构建好（`pnpm build`，产物在包内 `lib/`）。本地目录安装会使用 pnpm 的
本地依赖；发布到 npm 后直接写包名即可。
