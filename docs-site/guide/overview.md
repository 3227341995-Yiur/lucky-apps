# 概览

周报管理系统支持在不重新构建客户端的前提下扩展样式、插件脚本和 Vue 组件。所有扩展都放在应用资源目录中，保存后即时生效。

## 三种扩展方式

| 方式 | 目录 | 生效方式 |
| --- | --- | --- |
| 外部组件 | `resources/comps` | 保存后热加载 |
| 插件脚本 | `resources/js` | 重新加载应用 |
| 全局样式 | `resources/css` | 重新加载应用 |

## 装配顺序

1. 安装内置能力并暴露 `window.weekReport`。
2. 按文件名顺序注入 `resources/css/*.css`。
3. 按文件名顺序加载 `resources/js/*.js`。
4. 运行时编译并注册 `resources/comps` 下的组件。
5. 挂载 Vue 应用；插件脚本执行时 API 已就绪。

::: tip 热加载
保存 `resources/comps` 下的文件会自动重新编译注册，无需重启。也可以在「设置 → 扩展」手动热加载。
:::

## API 版本

当前 API 版本为 **2**，入口是 `window.weekReport`。完整字段参考见 [API 参考](/guide/api)。
