<script setup lang="ts">
import { computed, reactive, ref, watch , inject } from 'vue'
import { Delete, CopyDocument, Plus, Setting } from '@element-plus/icons-vue'
import CodeEditor from './CodeEditor.vue'
import { PAGE_PRESETS } from '../config/reportLayout.ts'
import { getAllElComponents, getElWidget } from '../utils/elementPlusWidgets.ts'

defineOptions({ name: 'LayoutInspector' })

const ctx = inject('cordis')

const props = defineProps({
  layout: { type: Object, required: true },
  element: { type: Object, default: null },
  section: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update-element',
  'update-section',
  'update-page',
  'delete-element',
  'duplicate-element',
  'move-layer',
  'align-element',
])

const componentOptions = computed(() => ctx.get('components').listColumns())
const elComponents = computed(() => getAllElComponents())
const elPropsText = ref('{}')
const elPropsError = ref('')

const TYPE_LABELS = {
  title: '标题',
  date: '日期范围',
  section: '数据表格',
  text: '文本',
  divider: '分割线',
  el: 'Element 组件',
  component: '外部组件',
}

const style = computed(() => props.element?.style || {})
const page = computed(() => props.layout.page)

function updateElement(patch) {
  if (!props.element) return
  emit('update-element', patch)
}

const interactionTargets = computed(() => (
  props.layout.elements.filter(item => item.id !== props.element?.id)
))

function targetLabel(target) {
  const label = TYPE_LABELS[target.type] || target.type
  const detail = target.text || target.sectionType || target.component || target.id
  return `${label} · ${detail}`
}

function makeAction(type = 'show') {
  return {
    type,
    targetId: interactionTargets.value[0]?.id || '',
    variable: '',
    value: '',
  }
}

function addInteraction() {
  if (!props.element) return
  updateElement({
    interactions: [
      ...(props.element.interactions || []),
      {
        id: `ix_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trigger: 'click',
        condition: null,
        actions: [makeAction('show')],
        elseActions: [],
      },
    ],
  })
}

function updateInteraction(index, patch) {
  if (!props.element) return
  const list = [...(props.element.interactions || [])]
  list[index] = { ...list[index], ...patch }
  updateElement({ interactions: list })
}

function removeInteraction(index) {
  if (!props.element) return
  const list = [...(props.element.interactions || [])]
  list.splice(index, 1)
  updateElement({ interactions: list })
}

function addCondition(index) {
  updateInteraction(index, {
    condition: { source: 'variable', variable: '', targetId: '', operator: 'equals', value: '' },
  })
}

function removeCondition(index) {
  updateInteraction(index, { condition: null })
}

function addAction(index, isElse = false) {
  if (!props.element) return
  const list = [...(props.element.interactions || [])]
  const key = isElse ? 'elseActions' : 'actions'
  list[index] = { ...list[index], [key]: [...(list[index][key] || []), makeAction('show')] }
  updateElement({ interactions: list })
}

function updateAction(index, actionIndex, patch, isElse = false) {
  if (!props.element) return
  const list = [...(props.element.interactions || [])]
  const key = isElse ? 'elseActions' : 'actions'
  const actions = [...(list[index][key] || [])]
  actions[actionIndex] = { ...actions[actionIndex], ...patch }
  list[index] = { ...list[index], [key]: actions }
  updateElement({ interactions: list })
}

function removeAction(index, actionIndex, isElse = false) {
  if (!props.element) return
  const list = [...(props.element.interactions || [])]
  const key = isElse ? 'elseActions' : 'actions'
  const actions = [...(list[index][key] || [])]
  actions.splice(actionIndex, 1)
  list[index] = { ...list[index], [key]: actions }
  updateElement({ interactions: list })
}

function setStyle(key, value) {
  if (!props.element) return
  emit('update-element', { style: { ...props.element.style, [key]: value } })
}

function updateSection(patch) {
  if (!props.section) return
  emit('update-section', { ...props.section, ...patch })
}

function updateColumn(index, patch) {
  if (!props.section) return
  const columns = props.section.columns.map((column, i) => (
    i === index ? { ...column, ...patch } : column
  ))
  updateSection({ columns })
}

function addColumn() {
  if (!props.section) return
  const used = new Set(props.section.columns.map(column => column.prop))
  let index = props.section.columns.length + 1
  let prop = `column${index}`
  while (used.has(prop)) prop = `column${++index}`
  const columns = [
    ...props.section.columns,
    { prop, label: `新列${index}`, component: '', fixed: false, attrs: {} },
  ]
  updateSection({ columns })
}

function parseWidth(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  return digits ? Math.min(2000, Math.max(1, Number(digits))) : undefined
}

const optionDrafts = reactive({})

watch(() => props.section?.type, () => {
  Object.keys(optionDrafts).forEach(key => delete optionDrafts[key])
})

// 默认值统一用 JS 表达式编辑，旧类型在这里转换成等价代码
function columnCode(column) {
  if (!column) return ''
  if (column.defaultValueType === 'code') return String(column.defaultValue ?? '')
  if (column.defaultValueType === 'today') return "moment().format('YYYY-MM-DD')"
  if (column.defaultValueType === 'now') return 'Date.now()'
  const value = column.defaultValue
  if (value === undefined || value === null || value === '') return ''
  return JSON.stringify(value)
}

function setColumnCode(index, value) {
  updateColumn(index, { defaultValue: value, defaultValueType: 'code' })
}

function addOption(index) {
  const column = props.section?.columns[index]
  const value = String(optionDrafts[index] ?? '').trim()
  if (!column || !value) return
  const options = Array.isArray(column.attrs?.options) ? [...column.attrs.options] : []
  if (!options.includes(value)) options.push(value)
  updateColumn(index, { attrs: { ...(column.attrs || {}), options } })
  optionDrafts[index] = ''
}

function removeOption(index, optionIndex) {
  const column = props.section?.columns[index]
  const options = Array.isArray(column?.attrs?.options) ? [...column.attrs.options] : []
  options.splice(optionIndex, 1)
  updateColumn(index, { attrs: { ...(column?.attrs || {}), options } })
}

function removeColumn(index) {
  if (!props.section) return
  if (props.section.columns.length <= 1) return
  updateSection({ columns: props.section.columns.filter((_, i) => i !== index) })
}

function setPage(patch) {
  emit('update-page', patch)
}

function applyPreset(preset) {
  setPage({ width: preset.width, height: preset.height })
}

const canEditTypography = computed(() => (
  ['title', 'date', 'text'].includes(props.element?.type)
))

function changeElComponent(name) {
  const definition = getElWidget(name)
  emit('update-element', {
    component: name,
    props: definition.props ? { ...definition.props } : {},
    text: definition.text || '',
  })
}

function syncElProps() {
  elPropsText.value = JSON.stringify(props.element?.props || {}, null, 2)
  elPropsError.value = ''
}

watch(() => `${props.element?.id}:${props.element?.component}`, () => {
  if (props.element?.type === 'el' || props.element?.type === 'component') syncElProps()
}, { immediate: true })

function commitElProps(text) {
  try {
    const value = JSON.parse(text || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('必须是 JSON 对象')
    }
    emit('update-element', { props: value })
    elPropsError.value = ''
  } catch (error) {
    elPropsError.value = `props 不是合法 JSON：${error.message}`
  }
}
</script>

<template>
  <aside class="layout-inspector">
    <el-scrollbar class="inspector-scroll">
    <div class="inspector-inner">
    <!-- 页面设置 -->
    <template v-if="!element">
      <header class="inspector-head">
        <span class="inspector-eyebrow">PAGE</span>
        <h3>页面设置</h3>
        <p>选择画布中的元素可编辑位置、尺寸和样式。</p>
      </header>

      <section class="group">
        <div class="group-title">页面尺寸</div>
        <div class="preset-grid">
          <button
            v-for="(preset, key) in PAGE_PRESETS"
            :key="key"
            type="button"
            class="preset-button"
            :class="{ active: page.width === preset.width && page.height === preset.height }"
            @click="applyPreset(preset)"
          >
            <strong>{{ preset.label }}</strong>
            <span>{{ preset.width }} × {{ preset.height }}</span>
          </button>
        </div>
        <div class="field-grid">
          <label>
            <span>宽</span>
            <el-input-number :model-value="page.width" :min="320" :max="2000" :step="10" controls-position="right" @update:model-value="v => setPage({ width: v })" />
          </label>
          <label>
            <span>高</span>
            <el-input-number :model-value="page.height" :min="400" :max="5000" :step="10" controls-position="right" @update:model-value="v => setPage({ height: v })" />
          </label>
          <label>
            <span>内边距</span>
            <el-input-number :model-value="page.padding" :min="0" :max="200" :step="4" controls-position="right" @update:model-value="v => setPage({ padding: v })" />
          </label>
          <label>
            <span>背景</span>
            <el-color-picker :model-value="page.background" size="small" @change="v => v && setPage({ background: v })" />
          </label>
        </div>
      </section>

      <div class="inspector-empty">
        <el-icon :size="20"><Setting /></el-icon>
        <p>拖动左侧组件到画布，点击元素后可在此改样式。</p>
      </div>
    </template>

    <!-- 元素设置 -->
    <template v-else>
      <header class="inspector-head">
        <span class="inspector-eyebrow">{{ element.type.toUpperCase() }}</span>
        <h3>{{ TYPE_LABELS[element.type] || element.type }}</h3>
        <p>自由定位 · 8px 网格吸附</p>
      </header>

      <section class="group">
        <div class="group-title">位置与尺寸</div>
        <div class="field-grid">
          <label><span>X</span><el-input-number :model-value="element.x" :step="8" controls-position="right" @update:model-value="v => updateElement({ x: v })" /></label>
          <label><span>Y</span><el-input-number :model-value="element.y" :step="8" controls-position="right" @update:model-value="v => updateElement({ y: v })" /></label>
          <label><span>宽</span><el-input-number :model-value="element.w" :min="24" :step="8" controls-position="right" @update:model-value="v => updateElement({ w: v })" /></label>
          <label><span>高</span><el-input-number :model-value="element.h" :min="2" :step="8" controls-position="right" @update:model-value="v => updateElement({ h: v })" /></label>
        </div>
      </section>

      <section v-if="element.type === 'el'" class="group">
        <div class="group-title">Element Plus 组件</div>
        <label class="field">
          <span>组件</span>
          <el-select
            :model-value="element.component"
            filterable
            size="small"
            @update:model-value="changeElComponent"
          >
            <el-option v-for="name in elComponents" :key="name" :label="name" :value="name" />
          </el-select>
        </label>
        <label class="field">
          <span>内容 / 默认插槽</span>
          <el-input
            :model-value="element.text"
            size="small"
            placeholder="组件文本"
            @update:model-value="v => updateElement({ text: v })"
          />
        </label>
        <label class="field">
          <span>props JSON</span>
          <el-input
            v-model="elPropsText"
            type="textarea"
            :rows="5"
            resize="vertical"
            placeholder='{ "type": "primary" }'
            @change="commitElProps"
          />
        </label>
        <small v-if="elPropsError" class="field-error">{{ elPropsError }}</small>
        <p class="group-hint">可配置任意 Element Plus 组件属性，如 options、data、percentage。</p>
      </section>

      <section v-if="element.type === 'text'" class="group">
        <div class="group-title">文本内容</div>
        <el-input
          type="textarea"
          :rows="4"
          :model-value="element.text"
          placeholder="输入文本内容"
          @update:model-value="v => updateElement({ text: v })"
        />
      </section>

      <section v-else-if="element.type === 'section' && section" class="group">
        <div class="group-title">数据表格</div>
        <label class="field">
          <span>区块标题</span>
          <el-input :model-value="section.title" size="small" @update:model-value="v => updateSection({ title: v })" />
        </label>
        <label class="field inline">
          <span>展开 Markdown 明细</span>
          <el-switch :model-value="section.hasExpandColumn" size="small" @update:model-value="v => updateSection({ hasExpandColumn: v })" />
        </label>
        <label class="field">
          <span>新建周报默认行数</span>
          <el-input-number
            :model-value="section.defaultRows || 0"
            :min="0"
            :max="100"
            size="small"
            controls-position="right"
            @update:model-value="v => updateSection({ defaultRows: v ?? 0 })"
          />
        </label>

        <div class="columns-head">
          <span>列（{{ section.columns.length }}）</span>
          <button type="button" class="text-action" @click="addColumn">
            <el-icon :size="11"><Plus /></el-icon>添加
          </button>
        </div>

        <div class="column-list">
          <div v-for="(column, index) in section.columns" :key="column.prop + index" class="column-item">
            <div class="column-line">
              <el-input
                :model-value="column.label"
                size="small"
                placeholder="列名"
                @update:model-value="v => updateColumn(index, { label: v })"
              />
              <button type="button" class="icon-action danger" title="删除列" @click="removeColumn(index)">
                <el-icon :size="11"><Delete /></el-icon>
              </button>
            </div>
            <div class="column-line">
              <el-input
                :model-value="column.prop"
                size="small"
                placeholder="prop"
                class="mono-input"
                @update:model-value="v => updateColumn(index, { prop: v })"
              />
              <el-input
                :model-value="column.width ?? ''"
                size="small"
                inputmode="numeric"
                placeholder="自适应"
                class="width-field"
                @update:model-value="v => updateColumn(index, { width: parseWidth(v) })"
              />
            </div>
            <el-select
              :model-value="column.component || ''"
              size="small"
              placeholder="默认文本输入"
              class="component-field"
              @update:model-value="v => updateColumn(index, { component: v })"
            >
              <el-option label="默认文本输入" value="" />
              <el-option
                v-for="option in componentOptions"
                :key="option.value"
                :label="option.value"
                :value="option.value"
              />
            </el-select>

            <div class="column-code">
              <code-editor
                :model-value="columnCode(column)"
                language="javascript"
                @update:model-value="v => setColumnCode(index, v)"
              />
            </div>

            <div v-if="['status-selector', 'select', 'multi-select'].includes(column.component)" class="column-options">
              <el-tag
                v-for="(option, optionIndex) in column.attrs?.options || []"
                :key="`${option}-${optionIndex}`"
                size="small"
                closable
                @close="removeOption(index, optionIndex)"
              >
                {{ option }}
              </el-tag>
              <el-input
                v-model="optionDrafts[index]"
                size="small"
                class="option-add"
                placeholder="+ 新选项"
                @keyup.enter="addOption(index)"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="element.type === 'title' || element.type === 'date'" class="group">
        <div class="group-title">数据绑定</div>
        <p class="group-hint">
          留空时绑定周报默认{{ element.type === 'title' ? '标题' : '日期范围' }}；填写 JS 表达式可自定义取值。
        </p>
        <label class="field">
          <span>内容表达式（JS）</span>
          <div class="expression-editor">
            <code-editor
              :model-value="element.expression || ''"
              language="javascript"
              @update:model-value="v => updateElement({ expression: v })"
            />
          </div>
        </label>
        <p class="group-hint">
          {{ element.type === 'title'
            ? "例如 report.title、'2026 年度周报'"
            : "例如 report.dateRange.join(' ~ ')、moment(report.dateRange[0]).format('MM月DD日')" }}
        </p>
      </section>

      <section v-if="canEditTypography" class="group">
        <div class="group-title">文字样式</div>
        <div class="field-grid">
          <label>
            <span>字号</span>
            <el-input-number :model-value="style.fontSize" :min="8" :max="96" controls-position="right" @update:model-value="v => setStyle('fontSize', v)" />
          </label>
          <label>
            <span>字重</span>
            <el-select :model-value="style.fontWeight || 400" size="small" @update:model-value="v => setStyle('fontWeight', v)">
              <el-option label="Regular 400" :value="400" />
              <el-option label="Medium 500" :value="500" />
              <el-option label="Semibold 600" :value="600" />
              <el-option label="Bold 700" :value="700" />
            </el-select>
          </label>
        </div>
        <div class="field-row">
          <label class="color-field">
            <span>颜色</span>
            <el-color-picker :model-value="style.color" size="small" @change="v => v && setStyle('color', v)" />
          </label>
          <label class="align-field">
            <span>对齐</span>
            <el-radio-group :model-value="style.textAlign || 'left'" size="small" @update:model-value="v => setStyle('textAlign', v)">
              <el-radio-button value="left">左</el-radio-button>
              <el-radio-button value="center">中</el-radio-button>
              <el-radio-button value="right">右</el-radio-button>
            </el-radio-group>
          </label>
        </div>
        <div class="field-grid">
          <label>
            <span>行高</span>
            <el-input-number :model-value="style.lineHeight" :min="0.8" :max="4" :step="0.1" controls-position="right" @update:model-value="v => setStyle('lineHeight', v)" />
          </label>
          <label>
            <span>字距</span>
            <el-input-number :model-value="style.letterSpacing" :min="-2" :max="12" :step="0.5" controls-position="right" @update:model-value="v => setStyle('letterSpacing', v)" />
          </label>
        </div>
      </section>

      <section v-if="element.type === 'component'" class="group">
        <div class="group-title">外部组件</div>
        <p class="group-hint">{{ element.component || '未选择组件' }}</p>
        <label class="field">
          <span>props（JSON）</span>
          <el-input
            v-model="elPropsText"
            type="textarea"
            :rows="4"
            resize="vertical"
            placeholder='{ "title": "示例" }'
            @change="commitElProps"
          />
        </label>
        <small v-if="elPropsError" class="field-error">{{ elPropsError }}</small>
      </section>

      <section v-if="element.type === 'section'" class="group">
        <div class="group-title">表格样式</div>
        <div class="field-grid">
          <label>
            <span>标题字号</span>
            <el-input-number :model-value="style.titleSize" :min="8" :max="40" controls-position="right" @update:model-value="v => setStyle('titleSize', v)" />
          </label>
          <label>
            <span>表头背景</span>
            <el-color-picker :model-value="style.headerBg" size="small" @change="v => v && setStyle('headerBg', v)" />
          </label>
          <label>
            <span>正文字号</span>
            <el-input-number :model-value="style.fontSize" :min="8" :max="24" controls-position="right" @update:model-value="v => setStyle('fontSize', v)" />
          </label>
          <label>
            <span>表头文字</span>
            <el-color-picker :model-value="style.headerColor" size="small" @change="v => v && setStyle('headerColor', v)" />
          </label>
          <label>
            <span>标题颜色</span>
            <el-color-picker :model-value="style.titleColor" size="small" @change="v => v && setStyle('titleColor', v)" />
          </label>
          <label>
            <span>正文颜色</span>
            <el-color-picker :model-value="style.bodyColor" size="small" @change="v => v && setStyle('bodyColor', v)" />
          </label>
        </div>
      </section>

      <section v-if="element.type === 'divider'" class="group">
        <div class="group-title">分割线</div>
        <div class="field-grid">
          <label>
            <span>颜色</span>
            <el-color-picker :model-value="style.color" size="small" @change="v => v && setStyle('color', v)" />
          </label>
          <label>
            <span>粗细</span>
            <el-input-number :model-value="style.thickness" :min="1" :max="12" controls-position="right" @update:model-value="v => setStyle('thickness', v)" />
          </label>
        </div>
      </section>

      <section class="group">
        <div class="group-title">容器样式</div>
        <div class="field-grid">
          <label>
            <span>背景</span>
            <el-color-picker
              :model-value="style.background === 'transparent' ? null : style.background"
              show-alpha
              size="small"
              @change="v => setStyle('background', v || 'transparent')"
            />
          </label>
          <label>
            <span>内边距</span>
            <el-input-number :model-value="style.padding" :min="0" :max="80" controls-position="right" @update:model-value="v => setStyle('padding', v)" />
          </label>
          <label>
            <span>边框</span>
            <el-input-number :model-value="style.borderWidth" :min="0" :max="12" controls-position="right" @update:model-value="v => setStyle('borderWidth', v)" />
          </label>
          <label>
            <span>圆角</span>
            <el-input-number :model-value="style.borderRadius" :min="0" :max="60" controls-position="right" @update:model-value="v => setStyle('borderRadius', v)" />
          </label>
          <label>
            <span>边框色</span>
            <el-color-picker :model-value="style.borderColor" size="small" @change="v => v && setStyle('borderColor', v)" />
          </label>
          <label>
            <span>不透明度</span>
            <el-input-number :model-value="style.opacity" :min="0" :max="1" :step="0.05" controls-position="right" @update:model-value="v => setStyle('opacity', v)" />
          </label>
        </div>
      </section>

      <section class="group">
        <div class="group-title">对齐页面</div>
        <div class="align-grid">
          <button type="button" @click="emit('align-element', 'left')">左</button>
          <button type="button" @click="emit('align-element', 'hcenter')">水平居中</button>
          <button type="button" @click="emit('align-element', 'right')">右</button>
          <button type="button" @click="emit('align-element', 'top')">上</button>
          <button type="button" @click="emit('align-element', 'vcenter')">垂直居中</button>
          <button type="button" @click="emit('align-element', 'bottom')">下</button>
        </div>
      </section>

      <section class="group">
        <div class="group-title">交互</div>
        <p class="group-hint">预览中执行：触发器 + 条件 + 多动作，支持变量和脚本。</p>
        <div v-for="(interaction, index) in element.interactions || []" :key="interaction.id || index" class="interaction-item">
          <div class="interaction-row">
            <el-select
              :model-value="interaction.trigger"
              size="small"
              class="interaction-trigger"
              @update:model-value="v => updateInteraction(index, { trigger: v })"
            >
              <el-option label="点击时" value="click" />
              <el-option label="双击时" value="dblclick" />
              <el-option label="悬停时" value="hover" />
              <el-option label="输入时" value="input" />
              <el-option label="加载时" value="load" />
            </el-select>
            <button type="button" class="interaction-remove" title="删除交互" @click="removeInteraction(index)">
              <el-icon :size="11"><Delete /></el-icon>
            </button>
          </div>

          <div v-if="interaction.condition" class="interaction-condition">
            <div class="interaction-row">
              <el-select
                :model-value="interaction.condition.source"
                size="small"
                class="interaction-source"
                @update:model-value="v => updateInteraction(index, { condition: { ...interaction.condition, source: v } })"
              >
                <el-option label="变量" value="variable" />
                <el-option label="目标值" value="target" />
              </el-select>
              <el-select
                :model-value="interaction.condition.operator"
                size="small"
                class="interaction-operator"
                @update:model-value="v => updateInteraction(index, { condition: { ...interaction.condition, operator: v } })"
              >
                <el-option label="等于" value="equals" />
                <el-option label="不等于" value="notEquals" />
                <el-option label="包含" value="contains" />
                <el-option label="大于" value="gt" />
                <el-option label="小于" value="lt" />
                <el-option label="为真" value="truthy" />
                <el-option label="为假" value="falsy" />
              </el-select>
              <button type="button" class="interaction-remove" title="删除条件" @click="removeCondition(index)">
                <el-icon :size="11"><Delete /></el-icon>
              </button>
            </div>
            <el-input
              v-if="interaction.condition.source === 'variable'"
              :model-value="interaction.condition.variable"
              size="small"
              placeholder="变量名"
              @update:model-value="v => updateInteraction(index, { condition: { ...interaction.condition, variable: v } })"
            />
            <el-select
              v-else
              :model-value="interaction.condition.targetId"
              size="small"
              class="interaction-target"
              placeholder="目标组件"
              @update:model-value="v => updateInteraction(index, { condition: { ...interaction.condition, targetId: v } })"
            >
              <el-option v-for="target in interactionTargets" :key="target.id" :label="targetLabel(target)" :value="target.id" />
            </el-select>
            <el-input
              :model-value="interaction.condition.value"
              size="small"
              placeholder="比较值，支持变量插值"
              @update:model-value="v => updateInteraction(index, { condition: { ...interaction.condition, value: v } })"
            />
          </div>
          <button v-else type="button" class="interaction-mini" @click="addCondition(index)">+ 条件</button>

          <div v-for="(action, actionIndex) in interaction.actions" :key="`a-${actionIndex}`" class="interaction-action">
            <div class="interaction-row">
              <el-select
                :model-value="action.type"
                size="small"
                class="interaction-action-type"
                @update:model-value="v => updateAction(index, actionIndex, { type: v })"
              >
                <el-option label="显示" value="show" />
                <el-option label="隐藏" value="hide" />
                <el-option label="切换显示" value="toggle" />
                <el-option label="设置文本" value="setText" />
                <el-option label="设置值" value="setValue" />
                <el-option label="设置变量" value="setVariable" />
                <el-option label="滚动到" value="scrollTo" />
                <el-option label="执行脚本" value="runScript" />
              </el-select>
              <button type="button" class="interaction-remove" title="删除动作" @click="removeAction(index, actionIndex)">
                <el-icon :size="11"><Delete /></el-icon>
              </button>
            </div>
            <el-select
              v-if="['show', 'hide', 'toggle', 'setText', 'setValue', 'scrollTo'].includes(action.type)"
              :model-value="action.targetId"
              size="small"
              class="interaction-target"
              placeholder="目标组件"
              @update:model-value="v => updateAction(index, actionIndex, { targetId: v })"
            >
              <el-option v-for="target in interactionTargets" :key="target.id" :label="targetLabel(target)" :value="target.id" />
            </el-select>
            <el-input
              v-if="action.type === 'setVariable'"
              :model-value="action.variable"
              size="small"
              placeholder="变量名"
              @update:model-value="v => updateAction(index, actionIndex, { variable: v })"
            />
            <el-input
              v-if="['setText', 'setValue', 'setVariable'].includes(action.type)"
              :model-value="action.value"
              size="small"
              placeholder="值，支持变量插值"
              @update:model-value="v => updateAction(index, actionIndex, { value: v })"
            />
            <el-input
              v-if="action.type === 'runScript'"
              :model-value="action.value"
              type="textarea"
              :rows="3"
              resize="vertical"
              placeholder="variables.ready = true"
              @update:model-value="v => updateAction(index, actionIndex, { value: v })"
            />
          </div>

          <div class="interaction-actions">
            <button type="button" @click="addAction(index)">+ 动作</button>
            <button type="button" @click="addAction(index, true)">+ 否则动作</button>
          </div>

          <div v-for="(action, actionIndex) in interaction.elseActions" :key="`e-${actionIndex}`" class="interaction-action is-else">
            <div class="interaction-row">
              <el-select
                :model-value="action.type"
                size="small"
                class="interaction-action-type"
                @update:model-value="v => updateAction(index, actionIndex, { type: v }, true)"
              >
                <el-option label="显示" value="show" />
                <el-option label="隐藏" value="hide" />
                <el-option label="切换显示" value="toggle" />
                <el-option label="设置文本" value="setText" />
                <el-option label="设置值" value="setValue" />
                <el-option label="设置变量" value="setVariable" />
                <el-option label="滚动到" value="scrollTo" />
                <el-option label="执行脚本" value="runScript" />
              </el-select>
              <button type="button" class="interaction-remove" title="删除否则动作" @click="removeAction(index, actionIndex, true)">
                <el-icon :size="11"><Delete /></el-icon>
              </button>
            </div>
            <el-select
              v-if="['show', 'hide', 'toggle', 'setText', 'setValue', 'scrollTo'].includes(action.type)"
              :model-value="action.targetId"
              size="small"
              class="interaction-target"
              placeholder="目标组件"
              @update:model-value="v => updateAction(index, actionIndex, { targetId: v }, true)"
            >
              <el-option v-for="target in interactionTargets" :key="target.id" :label="targetLabel(target)" :value="target.id" />
            </el-select>
            <el-input
              v-if="action.type === 'setVariable'"
              :model-value="action.variable"
              size="small"
              placeholder="变量名"
              @update:model-value="v => updateAction(index, actionIndex, { variable: v }, true)"
            />
            <el-input
              v-if="['setText', 'setValue', 'setVariable'].includes(action.type)"
              :model-value="action.value"
              size="small"
              placeholder="值，支持变量插值"
              @update:model-value="v => updateAction(index, actionIndex, { value: v }, true)"
            />
            <el-input
              v-if="action.type === 'runScript'"
              :model-value="action.value"
              type="textarea"
              :rows="3"
              resize="vertical"
              placeholder="variables.ready = true"
              @update:model-value="v => updateAction(index, actionIndex, { value: v }, true)"
            />
          </div>
        </div>
        <el-button size="small" plain class="interaction-add" @click="addInteraction">
          <el-icon><Plus /></el-icon><span>添加交互</span>
        </el-button>
      </section>

      <section class="group actions">
        <button type="button" class="action-button" @click="emit('duplicate-element', element)">
          <el-icon :size="12"><CopyDocument /></el-icon>复制
        </button>
        <button type="button" class="action-button" @click="emit('move-layer', element, 'front')">置顶</button>
        <button type="button" class="action-button" @click="emit('move-layer', element, 'back')">置底</button>
        <button type="button" class="action-button danger" @click="emit('delete-element', element)">
          <el-icon :size="12"><Delete /></el-icon>删除
        </button>
      </section>
    </template>
    </div>
    </el-scrollbar>
  </aside>
</template>

<style scoped>
.layout-inspector {
  width: 304px;
  flex: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid var(--wr-border);
  background: var(--el-bg-color);
}

.inspector-scroll {
  flex: 1;
  min-height: 0;
}

.inspector-inner {
  padding: 14px 14px 28px;
}

.inspector-head {
  padding-bottom: 11px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.inspector-eyebrow {
  font-family: var(--wr-mono);
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--el-color-primary);
}

.inspector-head h3 {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.inspector-head p {
  margin: 3px 0 0;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.group {
  margin-bottom: 14px;
}

.group-title {
  margin-bottom: 7px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.group-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.field-grid label,
.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.field-grid label > span,
.field > span,
.color-field > span,
.align-field > span {
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.field-grid :deep(.el-input-number) {
  width: 100%;
}

.field-grid :deep(.el-select) {
  width: 100%;
}

.field {
  margin-bottom: 8px;
}

.field.inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.field-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin: 7px 0;
}

.color-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.align-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.align-field :deep(.el-radio-group) {
  display: flex;
}

.align-field :deep(.el-radio-button) {
  flex: 1;
}

.preset-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.preset-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
}

.preset-button:hover,
.preset-button.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.preset-button strong {
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.preset-button span {
  font-family: var(--wr-mono);
  font-size: 9px;
  color: var(--el-text-color-secondary);
}

.columns-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 9px 0 5px;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.text-action {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.column-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.column-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 7px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
  background: var(--el-fill-color-lighter);
}

.column-line {
  display: flex;
  align-items: center;
  gap: 4px;
}

.column-line :deep(.el-input) {
  flex: 1;
}

.width-field {
  width: 82px !important;
  flex: none;
}

.column-code {
  height: 120px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.column-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.option-add {
  width: 96px !important;
  flex: none;
}

.mono-input :deep(.el-input__inner) {
  font-family: var(--wr-mono);
  font-size: 11px;
}

.component-field {
  width: 100%;
}

.icon-action {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: none;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
}

.icon-action.danger:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.align-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.align-grid button {
  padding: 5px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}
.align-grid button:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.interaction-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 7px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.interaction-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.interaction-trigger {
  width: 78px;
  flex: none;
}

.interaction-action {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 5px;
  background: var(--el-bg-color);
}

.interaction-action.is-else {
  border-color: var(--el-color-warning-light-5);
}

.interaction-action-type {
  flex: 1;
  min-width: 0;
}

.interaction-condition {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
  background: var(--el-bg-color);
}

.interaction-source {
  width: 72px;
  flex: none;
}

.interaction-operator {
  flex: 1;
  min-width: 0;
}

.interaction-target {
  width: 100%;
}

.interaction-mini {
  align-self: flex-start;
  height: 20px;
  padding: 0 7px;
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
}

.interaction-mini:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.interaction-actions {
  display: flex;
  gap: 4px;
}

.interaction-actions button {
  flex: 1;
  height: 22px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.interaction-actions button:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.interaction-remove {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
}

.interaction-remove:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.interaction-add {
  width: 100%;
  margin-top: 6px;
}

.actions {
  display: flex;
  gap: 5px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.action-button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 5px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.action-button:hover {
  background: var(--el-fill-color-lighter);
}

.action-button.danger:hover {
  color: var(--el-color-danger);
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}

.inspector-empty {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding: 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
}

.inspector-empty p {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.6;
}
.field-error {
  display: block;
  margin-top: 3px;
  font-size: 10.5px;
  color: var(--el-color-danger);
}
.expression-editor {
  height: 92px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
}

</style>
