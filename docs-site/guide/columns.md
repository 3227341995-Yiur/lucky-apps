# 列扩展

插件可以把已有组件注册进宿主，内置 `reports` 插件的列设置下拉框会直接展示这些组件。

```js
const { defineComponent, h } = window.Vue

window.weekReport.components.register('rating', defineComponent({
  props: { modelValue: Number },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('el-rate', {
      modelValue: props.modelValue,
      'onUpdate:modelValue': value => emit('update:modelValue', value)
    })
  }
}), { description: '评分列' })
```

## 注册后

1. 打开报表任意区块的「列设置」。
2. 在「编辑器组件」中选择 `rating`。
3. 表格单元格会用该组件渲染；如果同时提供 `Rating.cslot.vue`，列设置中会出现属性编辑区。

## 内置列组件

`status-selector`、`date-selector`、`number-input`、`textarea`、`select`、`multi-select`、`switch`。

::: warning 默认值
列默认值是 JS 表达式，新建行时执行。例如 `"开发中"`、`moment().format('YYYY-MM-DD')`、`Date.now()`。
:::
