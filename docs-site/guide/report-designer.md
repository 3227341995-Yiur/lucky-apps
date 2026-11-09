# 周报画布设计器

自由画布（Axure 风格）设计周报版面：组件跟随鼠标实时预览、自由定位、缩放、改样式，并直接用于周报编辑与 HTML 导出。

## 数据模型

```js
{
  version: 2,
  page: { width: 794, height: 1123, background: 'var(--el-bg-color)', padding: 48 },
  elements: [
    {
      id: '...',
      type: 'title' | 'date' | 'section' | 'text' | 'divider' | 'el',
      x: 48, y: 36, w: 698, h: 46,
      style: { fontSize: 26, color: 'var(--el-text-color-primary)', ... },
      sectionType: 'completed',   // type=section
      text: '说明文字',            // type=text / el
      component: 'el-button',      // type=el
      props: { type: 'primary' }   // type=el，透传给 Element Plus 组件
    }
  ],
  sections: [
    { type: 'completed', title: '本周完成', icon: 'fas fa-check-circle', columns: [...], hasExpandColumn: false }
  ]
}
```

- 默认画布保存在 `config` 表；报表自身保存 `page + elements`（`layout` 字段），数据表结构复用 `report.sections`。
- 旧版 sections 数组会自动转换为默认画布。
- 默认布局、样式均使用 Element Plus 变量，跟随亮/暗主题。

## 交互

| 操作 | 说明 |
| --- | --- |
| 从左侧拖入组件 | 原生拖拽图 + 画布落点实时预览（真实组件渲染） |
| 移动 | 按住组件拖动，8px 网格吸附；与其他元素/页面中心对齐时出现橙色对齐线 |
| 缩放 | 选中后拖动 8 个控制点 |
| 双击文本 | 画布内直接编辑 |
| 标尺 | 画布上方/左侧显示像素刻度 |
| 对齐 | 右侧属性面板「对齐页面」左/中/右/上/中/下 |
| 撤销 / 重做 | 工具栏按钮或 `Ctrl+Z` / `Ctrl+Shift+Z` |
| 图层 | 右侧属性面板置顶 / 置底 |
| 复制 / 删除 | 元素悬浮工具条或属性面板 |

## 组件

- 标题、日期范围：绑定当前周报的标题与日期。
- 数据表格：绑定区块数据，右侧可编辑区块标题、列结构、组件、默认值。
- 文本、分割线：静态版面元素。
- **Element Plus 组件**：左侧 Element Plus 分组会加载当前 Element Plus 导出的全部组件（el-button、el-input、el-select、el-table、el-card…），可搜索；右侧 `props JSON` 可配置任意组件属性。
- 列编辑器组件（status-selector / date-selector / number-input / 外部组件）在「列设置」中选择；外部 `.cslot.vue` 会出现在对应列属性面板。

## 交互预览

设计器顶部「交互预览」切换到真实报表页面：

- 使用与正式编辑相同的 `ReportPage` / `ReportSection` / Element Plus 组件；
- 可点击状态、日期、输入框、表格行等；
- 预览修改不会写入当前周报，只用于验证排版和交互。

## 周报渲染

- 区块表格使用 Element Plus `el-table`，跟随系统主题；
- 区块高度随记录数增长（不固定裁切）；
- 「添加记录」在区块标题右侧，始终可见；
- 右上角齿轮打开「列设置」对话框：列顺序、列名、prop、宽度、编辑器组件、默认值、attrs。

## 快捷键

- `Ctrl+Z` / `Ctrl+Shift+Z`：撤销 / 重做（设计器内）
- `Ctrl+S`：模板设计器内保存模板
- `Ctrl+P`：模板设计器
- `Ctrl+Shift+E`：导入 / 导出
- `Ctrl+N`：新建周报

## 限制

- 自由画布中的区块元素高度是设计时的最小高度；正式渲染时数据表格会自动增高，内容很多时可能覆盖其下方元素，建议在设计中留出空间或把表格放到页面底部。
- 任意 Element Plus 组件的复杂插槽（如 tabs / steps）通过通用 `props` 与默认文本渲染，复杂组合建议使用「数据表格」或外部组件。
- HTML 导出会生成与画布一致的静态版面；复杂 Element Plus 交互组件以静态近似样式输出。
