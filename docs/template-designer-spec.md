# 模板设计器规范（IDE 布局 + 周报预览）

## 入口

- 快捷键 `Ctrl+P`
- 侧栏「导出模板」按钮
- 设置中心 → 模板 → 打开模板设计器

## 布局

```
┌──────────────────────────────────────────────────────────────┐
│ 模板资源（搜索 / 新建 / 复制 / 删除 / 设为默认） │ 编辑器 │ 预览 │
│ HTML 模板 / Markdown 模板                        │ 工具栏 │ 周报选择 │
│ - 系统模板 / 自定义模板                          │ 代码区 │ iframe / Markdown │
│                                                  │ 状态栏 │            │
└──────────────────────────────────────────────────────────────┘
```

- 左侧：`TemplateListPane.vue`
- 中间：`index.vue`（编辑器、脏标记、Ctrl+S、类型切换）
- 右侧：`TemplatePreviewPane.vue`

## 数据

模板仍存储于 `templates` 表：

```js
{
  id: 1762312345678001,
  name: '系统 HTML 模板',
  type: 'html',          // html | markdown
  isDefault: true,
  isSystem: true,
  template: '<!DOCTYPE html>...',
  createdAt: 0,
  updatedAt: 0
}
```

预览数据由选中的周报构建：

```js
{
  title: '工作周报 - 2026-11-02 ~ 2026-11-08',
  dateRange: '2026-11-02 ~ 2026-11-08',
  sections: [/* 从数据库按需加载 */]
}
```

## 渲染与预览

- Handlebars 渲染：`src/utils/templateRenderer.js`
- HTML 预览：`<iframe sandbox="" :srcdoc="rendered">`，不执行模板脚本
- Markdown 预览：`Vditor.preview(element, markdown)`，失败时降级为纯文本
- 编辑输入防抖 300ms 刷新预览；切换周报时懒加载 sections

## 编辑约束

- 系统模板不可删除
- 每种类型保留一个默认模板；删除默认模板后自动补选同类模板
- 未保存时切换模板 / 关闭窗口需二次确认
- `Ctrl+S` 保存；保存基线以提交内容为准，保存期间的新编辑保持未保存状态
- 新建模板使用系统默认 HTML / Markdown 模板内容
