# 插件规范

Lucky Apps 的插件是标准 **Vue 3 + TypeScript + Vite** 包。以下规范适用于内置插件和发布到 npm 的外部插件，目标是可安装、可升级、可卸载、可强杀后自恢复。

## 1. 包与元数据

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "type": "module",
  "keywords": ["cordis", "lucky-app"],
  "main": "lib/node.js",
  "exports": {
    ".": "./lib/node.js",
    "./client": "./lib/client.js"
  },
  "files": ["lib", "cordis.patch.yml", "README.md"],
  "la": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "entry": "./lib/client.js" },
    "kind": "feature"
  }
}
```

- `keywords` 必须包含 `cordis` 与 `lucky-app`。宿主安装面板只检索带 `lucky-app` 标签的 npm 包。
- `la.bundle.patch` 指向必须入库的 `cordis.patch.yml`；`lib/` 是构建产物，不入库。
- `la.kind` 使用 `feature` / `canvas` / `column`，决定插件出现在扩展中心的分类。
- `files` 只包含运行时需要的文件，不要把源码、测试、截图打进包。

## 2. 依赖与版本

插件是标准 npm 包：需要什么依赖、用什么版本，由插件自己的 `package.json` 决定，由插件自己的 Vite 打进 bundle。宿主不提供依赖，也不锁定插件版本；需要升级时插件自己升 `version`。

- 不要假设宿主会提供某个库或某个版本；需要什么就在插件里声明什么。
- `handlebars` 由宿主 client module 注册表提供唯一实例，插件构建时 external，由 loader 注入；helper 由 `resources/js/registerHelper.js` 统一注册，插件不要另打包一份。
- 插件不能引用宿主源码别名 `@/...`；需要宿主能力时使用 `@lucky-apps/plugin-api` 或 Cordis `ctx` 服务。

## 3. 生命周期

```ts
export default definePlugin({
  name: 'my-plugin',
  inject: ['navigation'],
  apply(ctx) {
    const timer = setInterval(sync, 1000)
    const off = api.events.on('report:changed', refresh)
    ctx.on('dispose', () => {
      clearInterval(timer)
      off()
    })
  },
})
```

- `apply(ctx)` 只做注册与启动；所有定时器、事件订阅、文件监听、子进程、本地 HTTP 服务都要在 `ctx.on('dispose')` 中释放。
- 反复 `apply` 必须幂等：先关闭旧实例，再创建新实例。
- 插件自己拉起的常驻进程（例如 nginx）遵守“插件加载即启动、插件卸载即停止”；宿主进程退出时同步清理，宿主被强杀时用独立 watchdog 收尾。
- 不要依赖插件 `apply` 的执行顺序；需要其他服务时声明 `inject`。

## 4. 数据与配置

- 业务数据库归插件自己所有，宿主不持有；卸载插件即不再挂载该数据层。
- 表结构迁移必须幂等，重复启动不重复建表、不丢用户数据。
- 用户配置放在 `%APPDATA%/<app>/...` 或插件自己的数据目录，不写宿主源码目录。
- 默认值只影响新用户，升级时不要覆盖已有配置。

## 5. 本地服务与安全

- 本地 HTTP 服务只监听 `127.0.0.1`，不要绑定 `0.0.0.0`。
- 固定 token 或每次启动随机 token 校验请求；CORS 只允许 `localhost` / `127.0.0.1`。
- 所有文件路径用 `path.resolve` + 根目录前缀校验，拒绝 `..` 穿越。
- 调用外部命令使用 `execFile` / `spawn` 的数组参数，不拼接 shell 字符串；PowerShell 参数必须转义单引号。
- 日志只输出必要信息，不打印 token、用户数据或完整配置。

## 6. 界面与交互

- 优先使用 Element Plus 组件和宿主 CSS 变量（`--el-*`、`--wr-*`），不要写死颜色。
- 导航、设置面板、侧栏面板、全局浮层分别用 `navigation` / `settings` / `sidebar` / `overlay` 注册。
- 应用内提示用 `ElMessage`；需要系统级通知时通过 Node half 调用原生通知，并随包提供图标资源。
- 右键菜单、浮层等交互应限制在触发元素内部；不要把菜单挂到 `body` 后随鼠标漂移。
- 可点击元素必须有可见的选中态、键盘操作与 `aria-label`。

## 7. 发布与升级

```bash
pnpm build
npm publish
```

- 版本遵循 semver；破坏插件 API 或配置结构时升 major。
- 发布前跑 `pnpm build` 与 `pnpm test`，确认 `lib/` 产物包含 `client.js`、`node.js` 和所需资源。
- 宿主通过 `la.profile.bundles` 升级内置插件，通过 npm 安装外部插件；不要手工复制 `node_modules`。
- 安装面板只搜索带 `lucky-app` 标签的包；本地目录、Git 仓库和直接包名安装不受限制。
