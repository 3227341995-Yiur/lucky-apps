# 模板设计器

内置 `reports` 插件的模板设计器：维护复制、导出时使用的 Handlebars 模板，并实时预览报表渲染结果。

## 入口

- 快捷键 `Ctrl+P`
- 侧栏「导出模板」按钮
- 左侧导航 → 模板设计（内置插件页）
- 快捷键 `Ctrl+P`

## 模板类型

内置类型：

- `html`：带样式的网页模板，复制后可直接粘贴到邮件或富文本编辑器。
- `markdown`：Markdown 文本模板。

还可以在模板编辑器顶部的类型选择框里输入新类型（例如 `text`、`jira`），
或在左侧「新建 → 自定义类型…」创建。自定义类型同样使用 Handlebars 渲染，
复制时输出渲染后的纯文本；类型会出现在复制按钮的下拉菜单里。

每个类型都可以有一个默认模板，复制时默认使用该模板。没有默认模板时使用该类型最近创建的模板。

系统默认模板现在是外部文件，不硬编码在 JS 里：

- `src/config/defaults/templates/default-html.html`
- `src/config/defaults/templates/default-markdown.md`

## 复制设置

模板设计器左侧的「复制设置」控制报表编辑器的复制行为：

| 设置 | 默认 | 说明 |
| --- | --- | --- |
| 复制使用模板 | 开启 | 开启时复制使用模板；关闭时复制当前画布渲染的 HTML |
| 默认复制类型 | HTML | 点击复制按钮主按钮时使用的模板类型 |

修改后立即保存到数据库（`meta` 表）：

- `template.copy.enabled`
- `template.copy.defaultType`

## 复制按钮

报表编辑器的复制按钮是 split button：

- 点击主按钮：复制「默认复制类型」的模板内容。
- 点击下拉箭头：选择任意模板类型（HTML / Markdown / 自定义类型）复制。
- 关闭「复制使用模板」后主按钮变为「复制画布」，不再出现类型下拉。

不再使用 Shift 等快捷键切换格式。

## 模板数据

模板保存在 `templates` 表：

```js
{
  id: 1762312345678001,
  name: '系统 HTML 模板',
  type: 'html',          // html / markdown / 自定义类型
  isDefault: true,
  isSystem: true,
  template: '<!DOCTYPE html>...',
  createdAt: 1762312345678,
  updatedAt: 1762312345678
}
```

系统模板不能删除；自定义模板可以复制、设为默认和删除。

## 预览

右侧预览会使用当前模板草稿和所选报表实时渲染：

- `html` 类型在隔离 iframe 中预览。
- `markdown` 使用 Vditor 预览。
- 自定义类型按纯文本预览，方便检查 Handlebars 输出。
