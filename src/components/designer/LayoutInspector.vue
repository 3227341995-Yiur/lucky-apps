<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Delete, CopyDocument, Plus, Setting } from '@element-plus/icons-vue'
import CodeEditor from '@/components/CodeEditor.vue'
import { listColumnComponents } from '@/plugins/registry'
import { PAGE_PRESETS } from '@/config/reportLayout'
import { getAllElComponents, getElWidget } from '@/utils/elementPlusWidgets'

defineOptions({ name: 'LayoutInspector' })

const props = defineProps({
  layout: { type: Object, required: true },
  element: { type: Object, default: null },
  section: { type: Object, default: null },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits([
  'update-element',
  'update-section',
  'update-page',
  'delete-element',
  'duplicate-element',
  'move-layer',
  'align-element'
])

const componentOptions = computed(() => listColumnComponents())
const elComponents = computed(() => getAllElComponents())
const elPropsText = ref('{}')
const elPropsError = ref('')

const TYPE_LABELS = {
  title: '标题',
  date: '日期范围',
  section: '数据表格',
  text: '文本',
  divider: '分割线',
  el: 'Element 组件'
}

const style = computed(() => props.element?.style || {})
const page = computed(() => props.layout.page)

function updateElement(patch) {
  if (!props.element) return
  emit('update-element', patch)
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
    { prop, label: `新列${index}`, component: '', fixed: false, attrs: {} }
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
    text: definition.text || ''
  })
}

function syncElProps() {
  elPropsText.value = JSON.stringify(props.element?.props || {}, null, 2)
  elPropsError.value = ''
}

watch(() => `${props.element?.id}:${props.element?.component}`, () => {
  if (props.element?.type === 'el') syncElProps()
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
          {{ element.type === 'title' ? '绑定当前周报标题，在周报编辑页修改。' : '绑定当前周报日期范围，在周报编辑页修改。' }}
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
</style>
