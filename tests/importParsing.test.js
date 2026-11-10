/**
 * 导入解析自检：单份 / 数组 / 备份、旧数据容错
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKUP_FORMAT,
  parseImportData
} from '../apps/desktop/src/services/importParsing.js'

const report = {
  title: '测试周报',
  dateRange: ['2026-11-02', '2026-11-08'],
  sections: [{ type: 'completed', items: [] }]
}

test('单份周报 JSON', () => {
  const parsed = parseImportData(report)
  assert.equal(parsed.kind, 'reports')
  assert.equal(parsed.data.length, 1)
  assert.equal(parsed.summary.reports, 1)
})

test('周报数组 JSON', () => {
  const parsed = parseImportData([report, { ...report, title: '第二份' }])
  assert.equal(parsed.data.length, 2)
  assert.equal(parsed.data[1].title, '第二份')
})

test('备份识别与模板/配置摘要', () => {
  const parsed = parseImportData({
    format: BACKUP_FORMAT,
    reports: [{ ...report, deleted_at: 123, layout: { page: { width: 794 }, elements: [] } }],
    templates: [
      { name: '自定义', template: 'x', type: 'html' },
      { name: '系统', template: 'y', isSystem: true }
    ],
    config: [{ type: 'completed', title: '本周完成', columns: [] }]
  })
  assert.equal(parsed.kind, 'backup')
  assert.equal(parsed.summary.reports, 1)
  assert.equal(parsed.summary.templates, 1)
  assert.equal(parsed.summary.hasConfig, true)
  assert.equal(parsed.data.reports[0].deleted_at, 123)
  assert.equal(parsed.data.reports[0].layout.page.width, 794)
})

test('缺少必需字段时抛出中文错误', () => {
  assert.throws(() => parseImportData({ ...report, title: '' }), /缺少标题/)
  assert.throws(() => parseImportData({ ...report, dateRange: [] }), /日期范围/)
  assert.throws(() => parseImportData({ ...report, sections: undefined }), /缺少区块数据/)
  assert.throws(() => parseImportData({ format: BACKUP_FORMAT }), /缺少周报数据/)
})

test('空数组与非法输入', () => {
  assert.throws(() => parseImportData([]), /没有可导入的周报/)
  assert.throws(() => parseImportData(null), /无法识别/)
  assert.throws(() => parseImportData('text'), /无法识别/)
})
