import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTrayMenu } from '../apps/desktop/src/cordis/trayModel.ts'

test('tray menu sorts, filters, separates sections and strips handlers', () => {
  const model = buildTrayMenu([
    { id: 'quit', label: '退出', order: 900, section: 'quit', danger: true, onSelect: () => 'x' },
    { id: 'hidden', label: '隐藏', hidden: true },
    { id: 'conditional', label: '条件', when: () => false },
    { id: 'plugin', label: '插件入口', order: 30, section: 'app', className: 'custom', style: { color: 'red' } },
    { id: 'show', label: '显示', order: 10, section: 'app' },
  ], [{ id: 'plugin-css', css: '.custom { color: red }' }], 'Lucky Apps')

  assert.equal(model.title, 'Lucky Apps')
  assert.deepEqual(model.items.map(item => item.id), [
    'show',
    'plugin',
    'separator:app:quit',
    'quit',
  ])
  assert.equal(model.items[2].separator, true)
  assert.equal(model.items[1].className, 'custom')
  assert.deepEqual(model.items[1].style, { color: 'red' })
  assert.equal('onSelect' in model.items[1], false)
  assert.deepEqual(model.styles, [{ id: 'plugin-css', css: '.custom { color: red }' }])
})

test('tray menu keeps visible children for submenus', () => {
  const model = buildTrayMenu([
    {
      id: 'theme',
      label: '主题',
      onSelect: () => 'parent',
      children: [
        { id: 'theme:hidden', label: '隐藏', when: () => false },
        { id: 'theme:sakura', label: '樱花粉', iconSvg: '<svg/>', onSelect: () => 'child' },
      ],
    },
  ])

  assert.deepEqual(model.items.map(item => item.id), ['theme'])
  const children = model.items[0].children || []
  assert.deepEqual(children.map(item => item.id), ['theme:sakura'])
  assert.equal(children[0].iconSvg, '<svg/>')
  assert.equal('onSelect' in children[0], false)
})
