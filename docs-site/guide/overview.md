# 概览

周报管理系统支持在不重新构建客户端的前提下扩展样式、插件脚本和 Vue 组件。所有扩展都放在应用资源目录中，保存后即时生效。

## 三种扩展方式

| 方式 | 目录 | 生效方式 |
| --- | --- | --- |
| 外部组件 | `extensions` / AppData 插件目录 | 独立包构建后运行时注册 |
| 插件脚本 | `resources/js` | 重新加载应用 |
| 全局样式 | `resources/css` | 重新加载应用 |

## 装配顺序

1. 安装内置能力并暴露 `window.weekReport`。
2. 按文件名顺序注入 `resources/css/*.css`。
3. 按文件名顺序加载 `resources/js/*.js`。
4. 读取 `cordis.yml` profile，按包名/模块路径注册外部组件。
5. 挂载 Vue 应用；插件脚本执行时 API 已就绪。

::: tip 热加载
外部组件包由项目自己构建，宿主在启动时通过 Cordis profile 注册；内置包随应用打包，外部包可放入 AppData/plugins。
:::

## API 版本

当前 API 版本为 **2**，入口是 `window.weekReport`。完整字段参考见 [API 参考](/guide/api)。
