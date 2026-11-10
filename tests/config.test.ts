/**
 * 纯逻辑自检：默认结构归一化 / 默认值解析 / 日期区间
 * 运行：npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_REPORT_CONFIG,
  normalizeReportConfig,
  resolveDefaultValue,
  createSectionsFromConfig,
} from '../apps/desktop/src/config/defaultReportConfig.ts'
import { formatDate, getWeekRange, isDateInRange } from '../apps/desktop/src/utils/date.ts'

test('空配置回退到系统默认结构', () => {
  const config = normalizeReportConfig([])
  assert.equal(config.length, DEFAULT_REPORT_CONFIG.length)
  assert.ok(config.every(section => Array.isArray(section.columns) && section.columns.length > 0))
})

test('归一化会补齐字段并保证列 prop 唯一', () => {
  const config = normalizeReportConfig([
    {
      title: '测试',
      columns: [
        { prop: 'x', label: 'A' },
        { prop: 'x', label: 'B' },
        { label: 'C' },
      ],
    },
  ])
  const props = config[0].columns.map(column => column.prop)
  assert.equal(new Set(props).size, props.length)
  assert.equal(config[0].title, '测试')
  assert.equal(config[0].icon, 'fas fa-list')
  assert.ok(config[0].columns.every(column => typeof column.attrs === 'object'))
})

test('默认值兼容旧 moment 写法且不执行任意代码', () => {
  const today = formatDate()
  assert.equal(resolveDefaultValue({ defaultValue: "moment().format('YYYY-MM-DD')" }), today)
  assert.equal(resolveDefaultValue({ defaultValue: '开发中' }), '开发中')
  assert.equal(resolveDefaultValue({ defaultValueType: 'today' }), today)
  assert.equal(resolveDefaultValue({ defaultValueType: 'now' }) > 0, true)
  assert.equal(resolveDefaultValue({ defaultValue: 'process.exit(1)' }), 'process.exit(1)')
})

test('code 类型默认值执行 JS 表达式', () => {
  assert.equal(resolveDefaultValue({ defaultValueType: 'code', defaultValue: '1 + 1' }), 2)
  assert.equal(resolveDefaultValue({ defaultValueType: 'code', defaultValue: "'A' + 'B'" }), 'AB')
  assert.equal(resolveDefaultValue({ defaultValueType: 'code', defaultValue: 'throw new Error("x")' }), '')
})

test('多选列默认值会归一化为数组', () => {
  const column = { component: 'multi-select', defaultValue: 'A, B', defaultValueType: 'literal' }
  assert.deepEqual(resolveDefaultValue(column), ['A', 'B'])
  assert.deepEqual(resolveDefaultValue({ ...column, defaultValue: '["A","B"]' }), ['A', 'B'])
  assert.deepEqual(resolveDefaultValue({ ...column, defaultValue: ['A'] }), ['A'])
})

test('默认结构生成 sections 时默认空表格，按 defaultRows 生成行', () => {
  const sections = createSectionsFromConfig([])
  assert.equal(sections.length, DEFAULT_REPORT_CONFIG.length)
  for (const section of sections) {
    assert.equal(section.items.length, 0)
    assert.equal(section.defaultRows, 0)
  }

  const withRows = createSectionsFromConfig([
    { ...DEFAULT_REPORT_CONFIG[0], defaultRows: 2 },
  ])
  assert.equal(withRows[0].items.length, 2)
  assert.ok(withRows[0].items.every(item => item.id))
  assert.equal(withRows[0].items[0].status, '开发中')
})

test('周范围与日期区间', () => {
  const [start, end] = getWeekRange(new Date(2024, 0, 3))
  assert.equal(start, '2024-01-01')
  assert.equal(end, '2024-01-07')
  assert.equal(isDateInRange('2024-01-03', [start, end]), true)
  assert.equal(isDateInRange('2024-01-08', [start, end]), false)
})
