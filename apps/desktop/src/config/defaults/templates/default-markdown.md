# {{title}}

**日期范围：** {{dateRange}}

{{#each sections}}
## {{title}}

{{#if items.length}}
| 序号 | {{#each columns}}{{label}} | {{/each}} |
| --- | {{#each columns}}--- | {{/each}} |
{{#each items}}
| {{add @index 1}} | {{#each ../columns}}{{lookup .. prop}} | {{/each}} |
{{/each}}

{{else}}
暂无数据
{{/if}}
{{/each}}
