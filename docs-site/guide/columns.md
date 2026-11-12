# 列扩展

插件可以把 Vue 组件注册进宿主，内置 `reports` 插件的列设置下拉框会直接展示这些组件。

```js
import { defineComponent, h } from 'vue'

export default {
  name: 'my-columns',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerColumn('rating', defineComponent({
      props: { modelValue: Number },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () => h('el-rate', {
          modelValue: props.modelValue,
          'onUpdate:modelValue': value => emit('update:modelValue', value),
        })
      },
    }), { description: '评分列' })
  },
}
```

## 注册后

1. 打开报表任意区块的「列设置」。
2. 在「编辑器组件」中选择 `rating`。
3. 表格单元格会用该组件渲染；如果同时注册列属性插槽，列设置中会出现属性编辑区。

## 内置列组件

`status-selector`、`date-selector`、`number-input`、`textarea`、`select`、`multi-select`、`switch`。

::: warning 默认值
列默认值由组件注册时的 `defaultValue` 或内部 `resolveDefaultValue` 决定，宿主不执行任意代码。
:::
