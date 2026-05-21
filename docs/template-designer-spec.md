# 模板设计器规范 (Template Designer Spec)

## 1. 设计目标

- Ctrl+P 打开导出模板列表
- 点击编辑打开模板设计器弹窗
- 模板使用 Handlebars 语法作为占位符
- 每种类型(HTML/Markdown)各有一个默认模板
- 系统模板不可删除

## 2. 数据模型

### 2.1 周报数据结构（传入渲染引擎）

```javascript
{
  title: "工作周报 - 2026-05-11 ~ 2026-05-17",
  dateRange: "2026-05-11 ~ 2026-05-17",
  sections: [
    {
      title: "本周完成",
      type: "completed",
      icon: "fas fa-check-circle",
      hasExpandColumn: false,
      columns: [
        { prop: "title", label: "标题" },
        { prop: "status", label: "状态" }
      ],
      items: [
        { id: 1747804800000, title: "任务A", status: "已完成" },
        { id: 1747804800001, title: "任务B", status: "开发中" }
      ]
    }
  ]
}
```

### 2.2 模板数据库表

```sql
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'html',
  isDefault INTEGER DEFAULT 0,
  isSystem INTEGER DEFAULT 0,
  template TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### 2.3 Handlebars 渲染数据

模板接收的 data 结构：
```javascript
{
  title: String,
  dateRange: String,
  sections: [
    {
      title: String,
      columns: [{ label: String, prop: String }],
      items: [
        { [prop]: value }
      ]
    }
  ]
}
```

## 3. Handlebars 语法

### 3.1 基础语法

| 语法 | 说明 |
|------|------|
| `{{title}}` | 插入文本 |
| `{{#each sections}}...{{/each}}` | 循环 |
| `{{#if condition}}...{{/if}}` | 条件 |
| `{{lookup obj key}}` | 获取对象属性 |
| `{{lookup (getItem arr index) key}}` | 获取数组元素属性 |

### 3.2 内置 Helper

| Helper | 语法 | 说明 |
|--------|------|------|
| lookup | `{{lookup obj key}}` | 获取对象属性 |
| getItem | `{{getItem items index}}` | 获取 items 数组第 index 个元素 |
| add | `{{add a b}}` | 加法运算 |
| dateFormat | `{{dateFormat date}}` | 日期格式化 |

## 4. 默认模板示例

### 4.1 HTML 模板

```handlebars
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 1000px; margin: 0 auto; }
    h1 { color: #333; border-bottom: 2px solid #409EFF; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f7fa; font-weight: bold; }
    .section { margin-bottom: 30px; }
    .section-title { border-bottom: 2px solid #409EFF; padding-bottom: 5px; margin-bottom: 15px; }
  </style>
</head>
<body>
  <h1>{{title}}</h1>
  <p><strong>日期范围：</strong> {{dateRange}}</p>
  {{#each sections}}
  <div class="section">
    <h2 class="section-title">{{title}}</h2>
    <table>
      <thead>
        <tr>
          <th width="40">序号</th>
          {{#each columns}}
          <th>{{label}}</th>
          {{/each}}
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>{{add @index 1}}</td>
          {{#each ../columns}}
          <td>{{lookup (getItem ../items @index) prop}}</td>
          {{/each}}
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/each}}
</body>
</html>
```

### 4.2 Markdown 模板

```handlebars
# {{title}}

**日期范围：** {{dateRange}}

{{#each sections}}
## {{title}}

{{#if items.length}}
| 序号 | {{#each columns}}{{label}} | {{/each}} |
| --- | {{#each columns}}--- | {{/each}} |
{{#each items}}
| {{add @index 1}} | {{#each ../columns}}{{lookup (getItem ../items @index) prop}} | {{/each}} |
{{/each}}

{{else}}
暂无数据
{{/if}}
{{/each}}
```

## 5. 界面组件

### 5.1 ExportTemplateList

- 使用 BaseDialog
- 标题：导出模板
- 内容：模板卡片网格
  - 显示：名称、类型、是否默认
  - 操作：编辑、设为默认、删除（非系统模板）
- 底部：新增模板按钮

### 5.2 TemplateDesigner

- 使用 BaseDialog
- 顶部：模板名称、类型选择
- 中部：CodeEditor（Handlebars 模板内容）
- 底部：预览、保存按钮

### 5.3 PreviewModal

- 选择周报下拉框
- 开始预览按钮
- 新窗口打开渲染结果

## 6. 功能流程

### 6.1 Ctrl+P 打开模板列表

```
用户按 Ctrl+P
  → openTemplateDesigner()
  → $modal.open(ExportTemplateList)
  → 显示模板列表
```

### 6.2 编辑模板

```
用户点击模板"编辑"按钮
  → handleEdit(template)
  → emit('edit', template)
  → App.vue 收到 edit 事件
  → $modal.open(TemplateDesigner, { attrs: { templateId } })
  → TemplateDesigner 加载并显示模板
```

### 6.3 复制周报

```
用户点击"复制内容"
  → copyContent(e)
  → getDefaultTemplate(type) 获取默认模板
  → renderReport(reportData, template.template)
  → 复制到剪贴板
```

## 7. 模板服务 API

```javascript
// 获取所有模板
getAllTemplates()

// 根据ID获取模板
getTemplateById(id)

// 获取某类型的默认模板
getDefaultTemplate(type)  // type: 'html' | 'markdown'

// 保存模板
saveTemplate(template)

// 创建新模板
createTemplate(name, type, template)

// 删除模板
deleteTemplate(id)

// 设置默认模板
setDefaultTemplate(id, type)

// 确保默认模板存在（每种类型一个）
ensureDefaultTemplate()
```

## 8. 文件结构

```
src/
├── components/
│   └── TemplateDesigner/
│       ├── index.vue              # 模板设计器主弹窗
│       ├── ExportTemplateList.vue  # 模板列表弹窗
│       ├── ComponentPanel.vue      # 左侧组件面板
│       ├── DesignerCanvas.vue     # 中间画布
│       ├── PropertiesPanel.vue     # 右侧属性面板
│       └── composables/
│           └── useDesignerState.js  # 状态管理
├── services/
│   └── templateService.js          # 模板 CRUD
└── utils/
    └── templateRenderer.js         # Handlebars 渲染引擎
```

## 9. 状态管理

```javascript
// useDesignerState.js
state = {
  templates: [],           // 所有模板
  activeTemplateId: null,   // 当前活动模板ID
  currentTemplate: null,    // 当前编辑的模板数据（deep clone）
  selectedElement: null,     // 选中的元素
  isLoading: false,
  error: null
}
```

## 10. 验收标准

1. Ctrl+P 打开模板列表
2. 点击编辑能打开模板设计器
3. 模板设计器能编辑和保存模板
4. 预览能看到渲染结果
5. 复制内容能正确渲染周报数据
6. 每种类型各有一个默认模板
7. 系统模板不可删除