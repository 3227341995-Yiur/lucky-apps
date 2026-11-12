/**
 * 自由画布布局模型自检
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDefaultLayout,
  extractLayout,
  layoutBottom,
  normalizeLayoutConfig,
  renderLayoutHtml,
} from '../packages/extensions/reports/src/designer/config/reportLayout.ts'
import { DEFAULT_REPORT_CONFIG } from '../packages/extensions/reports/src/designer/config/defaultReportConfig.ts'

const sections = [
  {
    type: 'completed',
    title: '本周完成',
    columns: [{ prop: 'title', label: '标题', width: 320 }],
    items: [{ id: 1, title: '完成事项' }],
  },
]

test('旧版 sections 数组自动升级为自由画布', () => {
  const layout = normalizeLayoutConfig(DEFAULT_REPORT_CONFIG)
  assert.equal(layout.page.width, 794)
  assert.ok(layout.elements.some(element => element.type === 'title'))
  assert.ok(layout.elements.some(element => element.type === 'date'))
  assert.equal(layout.elements.filter(element => element.type === 'section').length, DEFAULT_REPORT_CONFIG.length)
  assert.equal(layout.sections.length, DEFAULT_REPORT_CONFIG.length)
})

test('Element Plus 元素可被归一化并保留 props/text', () => {
  const layout = normalizeLayoutConfig({
    page: { width: 794, height: 1123, padding: 48 },
    sections,
    elements: [
      {
        type: 'el',
        component: 'el-button',
        props: { type: 'primary' },
        text: '按钮',
        x: 40,
        y: 80,
        w: 120,
        h: 32,
        style: { background: 'transparent' },
      },
    ],
  })
  const button = layout.elements[0]
  assert.equal(button.component, 'el-button')
  assert.equal(button.props.type, 'primary')
  assert.equal(button.text, '按钮')
})

test('默认画布使用系统主题变量并可提取纯 layout', () => {
  const layout = createDefaultLayout(sections)
  assert.equal(layout.page.background, 'var(--el-bg-color)')
  assert.ok(layout.elements.length >= 3)
  const pure = extractLayout(layout)
  assert.equal(pure.sections, undefined)
  assert.ok(Array.isArray(pure.elements))
  assert.ok(layoutBottom(layout) > 0)
})

test('布局 HTML 导出包含标题、表格和主题变量', () => {
  const layout = createDefaultLayout(sections)
  const html = renderLayoutHtml(
    { title: '测试周报', dateRange: ['2026-11-02', '2026-11-08'], sections },
    layout,
    sections,
  )
  assert.match(html, /测试周报/)
  assert.match(html, /本周完成/)
  assert.match(html, /完成事项/)
  assert.match(html, /--el-bg-color/)
})
