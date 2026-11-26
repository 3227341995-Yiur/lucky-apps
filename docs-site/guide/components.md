# 外部组件

外部组件项目由组件自己管理：目录结构、入口文件名、构建工具都不由宿主规定。宿主只读取 `package.json`：

```json
{
  "name": "my-widget",
  "version": "1.0.0",
  "keywords": ["cordis", "lucky-app"],
  "la": {
    "client": { "entry": "./dist/my-widget.js" }
  }
}
```

宿主从 profile 的 `node_modules` 发现包，并加载 `client.entry`。入口叫 `index.js`、`plugin.js`、`dist/widget.js` 都可以。

`keywords` 必须包含 `lucky-app`；设置中心的搜索安装只展示带该标签的 npm 包。

如果还需要 Node 侧 Cordis 逻辑，再声明 `main` / `exports`；宿主会用真实 Cordis loader 挂载。组件注册入口示例：

```js
// 入口名随意，由 package.json exports/main 指定
import KpiCard from './KpiCard.vue'

export default {
  name: 'kpi-card',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      description: 'KPI 指标卡'
    })
  }
}
```

- 画布组件用 `components.registerCanvas`，表格列组件用 `components.registerColumn`，列属性插槽用 `components.registerColumnSlot`。
- 侧边栏入口/页面用 `navigation.register`，和画布组件、列组件是不同扩展类型。仓库的 `trash-bin` 就是一个独立功能组件包：注册左侧回收站入口和完整页面，样式与内置版一致。
- 设置面板入口用 `settings.register`；程序名称/图标用 `ctx.branding.set`。桌面端的窗口标题、标题栏/任务栏/托盘图标与 exe 文件图标由设置中心「程序名称与图标」统一写入，exe 图标重启应用后生效。
- 托盘图标右键菜单用 `ctx.tray.registerItem` 注册；处理函数在主窗口执行，可用 `class` / `style` 或 `ctx.tray.addStyle` 定制菜单外观，详见 [Cordis 服务](/guide/api#托盘右键菜单)。
- 包由 Cordis 或 manifest client 入口管理生命周期，热加载时先 dispose 再重新挂载。

## 页面顶栏渲染到窗口标题栏

页面级的标题、状态和工具按钮不要再在自己的内容里画第二条 header。窗口标题栏预留了
`#wr-titlebar-slot`，用 Vue 的 `<Teleport>` 把页面顶栏投进去；切页时跟着页面一起卸载，
不会在 KeepAlive 里残留：

```vue
<script setup>
import { computed, inject } from 'vue'

const ctx = inject('cordis')
// 只有当前页面激活时才占用标题栏
const active = computed(() => ctx.ui.activeView.value === 'my-plugin')
</script>

<template>
  <Teleport v-if="active" to="#wr-titlebar-slot">
    <header class="my-toolbar">
      <span>我的页面</span>
      <el-button type="primary">新建</el-button>
    </header>
  </Teleport>

  <div class="my-page">页面内容</div>
</template>

<style scoped>
.my-toolbar {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: transparent; /* 跟随标题栏主题 */
}
</style>
```

- 标题栏高度统一是 40px，顶栏内容保持单行；空白处仍然是窗口拖拽区，按钮/下拉正常可点。
- 顶栏背景不要写死颜色，保持透明即可跟随亮/暗主题；标题栏自身的底和边框由宿主绘制。
- 周报页 `ReportEditor.vue` 的顶栏已经这样接入，可作为完整示例。

## 组件内部直接 import

组件按普通 Vue 项目写，不需要关心运行时模块映射：

```vue
<script setup>
import { ref, computed } from 'vue'
import { ElButton } from 'element-plus'
import { TrendCharts } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
</script>

<template>
  <div class="kpi">
    <el-button>详情</el-button>
  </div>
</template>

<style scoped lang="scss">
.kpi {
  .title {
    color: var(--el-color-primary);
  }
}
</style>
```

npm 依赖、Vue SFC、TypeScript、less / scss 都由 Vite 正常打包。

## 包与 profile

每个插件是独立的 **Vue 3 + TypeScript** bundle 包，自己执行 `vite build`，产物为
`lib/client.js`（浏览器）和 `lib/node.js`（Cordis loader 行）。包自带 `cordis.patch.yml`，
`package.json` 声明 `la.bundle.patch`；`pnpm profile:build` 会把包 `pnpm pack`
成 tarball，安装到 `src-tauri/target/profile/node_modules`（真实 pnpm profile，不是手工复制）。

这是 Lucky Apps 的 bundle 形态：画布 / 列 / 功能包都通过 Cordis loader 行挂载，
Node half 把浏览器 bundle 登记进 clientModules。

profile 结构：

```text
src-tauri/target/profile/
├─ package.json        la.profile.bundles + 依赖
├─ cordis.yml          []（空根节点）
├─ cordis.patch.yml    用户 patch 层
├─ vendor/             pnpm pack 生成的包 tarball
├─ pnpm-lock.yaml      pnpm 安装锁
└─ node_modules/       pnpm install 的真实依赖树
   ├─ base/
   ├─ kpi-card/ ...
   └─ 外部 Node 插件 ...
```

组合顺序：空根 → 各 bundle 的 `la.bundle.patch` →
profile 的 `cordis.patch.yml`。内置 profile 的 `la.profile.bundles` 列出
`base`、画布包、列包、功能包和外部功能插件。

用户 profile 在 `%APPDATA%\com.lu.lucky-apps\profile`，安装外部组件不需要重新打包应用。

::: tip 内置组件包
仓库自带 `kpi-card`、`progress-board`、`timeline-card` 三个画布包，以及
`rating-cell`、`progress-cell`、`user-cell`、`money-cell` 四个列组件包，可以直接作为模板。
:::

::: tip Vue / Element Plus
组件包是标准 Vite 项目，依赖和版本由插件自己的 `package.json` 声明并打包。
`handlebars` 由宿主 client module 注册表提供，插件构建时 external，不重复打包。
:::
