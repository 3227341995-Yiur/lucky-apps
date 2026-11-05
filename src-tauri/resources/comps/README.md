# 外部 Vue 组件（运行时热加载）

此目录下的 `.vue`、`.cslot.vue`、`.js` 在应用启动时由 **官方 `@vue/compiler-sfc`** 运行时编译并注册。
新增或修改组件后重新加载应用即可生效，**无需重新构建**。

## 约定

- `Name.vue`：列编辑器组件，接收 `v-model`（单元格值）以及列的 `attrs`。
- `Name.cslot.vue`：列属性编辑插槽，接收列对象（`defineModel()` 或 `column` prop），
  直接修改 `column.attrs` 等字段即可。
- `Name.js`：ES Module，默认导出 Vue 组件（`defineComponent` 或普通对象）。

## 可导入的模块

```js
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { readTextFile } from '@tauri-apps/plugin-fs'
import someModule from '@resources/some/module.js'
```

| 说明符 | 运行时来源 |
| --- | --- |
| `vue` | `window.Vue` |
| `element-plus` | `window.ElementPlus` |
| `@element-plus/icons-vue` | `window.ElementPlusIconsVue` |
| `@tauri-apps/api`、`/core`、`/path`、`/event`、`/window` | 对应 Tauri 模块 |
| `@tauri-apps/plugin-fs`、`@tauri-apps/plugin-sql` | Tauri 插件 |
| `handlebars` / `moment` / `lodash` / `vditor` | 运行时全局模块 |
| `@resources/xxx.js` | 资源目录下的 JS 模块 |

组件样式仅支持普通 CSS（`<style scoped>` 可以）；运行时不做 SCSS/Less 预处理。
`TypeScript` 会擦除类型但不做类型检查。

启停状态在「设置 → 扩展」中管理，保存后重新加载应用生效。
