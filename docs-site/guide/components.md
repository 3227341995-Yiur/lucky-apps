# 外部组件

把 Vue SFC 放进 `resources/comps`，系统使用官方 `@vue/compiler-sfc` 在浏览器中编译并注册，不包含自研模板编译器。

## 单元格组件

列组件接收 `v-model`（单元格值）和列的 `attrs`，在周报表格中渲染。

```vue
<!-- resources/comps/HelloCell.vue -->
<script setup>
const value = defineModel({ type: String, default: '' })
defineProps({
  placeholder: { type: String, default: '输入内容' }
})
</script>

<template>
  <el-input v-model="value" :placeholder="placeholder" size="small" />
</template>
```

文件名决定组件名：`HelloCell.vue` → `hello-cell`，在列设置的组件下拉框中选择。

## 列属性插槽

与同名单元格组件配套，用于编辑列的 `attrs`，会显示在列设置弹窗中。

```vue
<!-- resources/comps/HelloCell.cslot.vue -->
<script setup>
const column = defineModel()
</script>

<template>
  <div class="option-editor">
    <el-tag
      v-for="(option, index) in column.attrs?.options || []"
      :key="option"
      closable
      @close="column.attrs.options.splice(index, 1)"
    >{{ option }}</el-tag>
  </div>
</template>
```

## JS 组件模块

没有 SFC 编译需求时，可以用 `.js` 默认导出一个 Vue 组件对象。

```js
// resources/comps/RatingCell.js
import { defineComponent, h } from 'vue'

export default defineComponent({
  props: { modelValue: Number },
  emits: ['update:modelValue'],
  setup(props) {
    return () => h('span', String(props.modelValue ?? 0))
  }
})
```

## 支持的导入

| 模块 | 说明 |
| --- | --- |
| `vue` | defineProps / defineEmits / defineModel 等官方宏 |
| `element-plus` | 全部 Element Plus 组件 |
| `@element-plus/icons-vue` | 图标组件 |
| `@tauri-apps/api/*`、`plugin-fs`、`plugin-sql` | 桌面端能力 |
| `handlebars`、`moment`、`lodash`、`vditor` | 运行时全局模块 |
| `@resources/xxx.js` | 资源目录下的 JS 模块 |

::: tip 样式
支持 `<style scoped>` 和普通 CSS；不做 SCSS / Less 预处理。建议使用 Element Plus 主题变量，自动适配亮暗色。
:::
