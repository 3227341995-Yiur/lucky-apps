# 安装与发布

外部组件不是靠手写 profile 配置安装的，使用安装命令：

```bash
# 安装到仓库内置 profile
pnpm lucky-apps plugin add ../my-widget

# 安装到当前用户的应用 profile
pnpm lucky-apps plugin add ../my-widget --user

# 查看 / 移除
pnpm lucky-apps plugin list --user
pnpm lucky-apps plugin remove my-widget --user

# 从 GitHub / Git 仓库安装
pnpm lucky-apps plugin add github:owner/repo
pnpm lucky-apps plugin add https://github.com/owner/repo
```

也可以直接使用 CLI bin：

```bash
lucky-apps plugin add <包名|本地目录> [--profile <dir>|--user]
```

## 命令做了什么

1. 在目标 profile 中执行 `pnpm add <spec>`；
2. 读取安装后包的 `package.json`；
3. 包声明 `weekReport.bundle.patch` 时，自动把包名加入
   `weekReport.profile.bundles`；
4. 外部 Vue + TypeScript 插件与 DSH bundle 一样自带 `cordis.patch.yml` 和 Node/client 两个 half；
5. 没有 bundle 声明的包只作为普通依赖安装。

它不会复制 `node_modules`，也不会手写一份固定配置。组件包可以自己决定构建产物在哪，只要 `package.json` 的
`weekReport.client.entry` 指向它；发布到 npm 后直接写包名即可。
设置面板里的搜索安装框支持 npm（仅带 `lucky-apps` 标签的包）、GitHub 仓库 URL、
`github:owner/repo` 和本地目录。

## 包要求

外部插件是标准 Vue 3 + TypeScript 的 DSH bundle 形态：

```json
{
  "name": "my-widget",
  "type": "module",
  "keywords": ["cordis", "lucky-apps"],
  "main": "lib/node.js",
  "exports": {
    ".": "./lib/node.js",
    "./client": "./lib/client.js"
  },
  "weekReport": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "entry": "./lib/client.js" },
    "kind": "feature"
  }
}
```

`keywords` 必须包含 `cordis` 与 `lucky-apps`。设置面板的 npm 搜索只返回带 `lucky-apps`
标签的包；本地目录、Git 仓库与直接包名安装不走这个过滤。

````yaml
# cordis.patch.yml
- insert:
    - id: my-widget
      name: my-widget
````

Node half 登记 client bundle，浏览器 half 通过 `plugin-api` 注册组件或页面。

外部项目通过 `plugin-api` 注册组件，不依赖宿主源码。
