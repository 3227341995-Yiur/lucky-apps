# 常见问题

## 保存组件后为什么没有生效？

功能插件：确认「设置 → 扩展」中已启用；列组件 / 画布组件：确认内置 `reports` 插件的
「设置 → 周报」中已启用。如果仍不生效，点击「设置 → 扩展」里的热加载或重新加载应用，
并查看列表中的错误信息。

## 组件里的样式不跟随主题？

不要写死颜色。使用 `var(--el-bg-color)`、`var(--el-text-color-primary)` 等 Element Plus 变量，并避免在组件根节点上设置不透明背景。

## 可以 import npm 包吗？

可以。插件是标准 Vue 3 + Vite 项目，依赖和版本写在插件自己的 `package.json`，
由插件自己的 Vite 打包；按自己的依赖树构建即可。`handlebars` 由宿主 client module 注册表
提供唯一实例，helper 由 `resources/js/registerHelper.js` 统一注册。

## 插件脚本的执行顺序？

按文件名排序串行加载。需要明确顺序时使用数字前缀，例如 `01-init.js`、`02-search.js`。

## 修改资源后需要重新构建客户端吗？

不需要。外部插件保存后热加载；样式表切关闭会立即移除。插件脚本以 `Function('ctx', source)` 执行，直接拿到与 Cordis 插件相同的 `ctx`，用 `ctx.effect(() => cleanup)` 注册清理函数（宿主自带脚本都已支持），切开关时由 Cordis 直接卸载；没有注册清理的旧脚本无法撤销已经执行的监听，切开关后界面会自动重新加载。只有修改客户端本身的 Vue 源码才需要重新构建。

## 为什么 npm 搜索不到我的插件？

安装面板只返回 `package.json` 的 `keywords` 含 `lucky-app` 的包。请声明
`"keywords": ["cordis", "lucky-app"]` 并重新发布；本地目录、Git 仓库和直接包名安装不受此限制。
