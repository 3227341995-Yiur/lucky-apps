<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, ArrowDown } from '@element-plus/icons-vue'
import AppDialog from '@/components/common/AppDialog.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import { cloneConfig } from '@/config/defaultReportConfig'
import { listColumnComponents, hasColumnSlot, extensionVersion } from '@/plugins/registry'
import { toPascalCase } from '@/plugins/naming'

defineOptions({ name: 'ColumnSettingsDialog' })

const visible = defineModel({ type: Boolean, default: false })

const props = defineProps({
  section: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['save'])

const draft = ref(null)
const selectedIndex = ref(0)
const attrsError = ref('')
const showAttrs = ref(false)

const componentOptions = computed(() => listColumnComponents())
const columns = computed(() => draft.value?.columns || [])
const selectedColumn = computed(() => columns.value[selectedIndex.value] || null)

// 宽度留空 = 由表格自动分配，不再强制回填默认值
const columnWidth = computed({
  get: () => selectedColumn.value?.width ?? '',
  set: value => {
    if (!selectedColumn.value) return
    const digits = String(value ?? '').replace(/[^\d]/g, '')
    selectedColumn.value.width = digits ? Math.min(2000, Math.max(1, Number(digits))) : undefined
  }
})

// 默认值统一按 JS 表达式编辑；旧的 literal/today/now 数据在这里转换成等价代码
const defaultCode = computed({
  get: () => {
    const column = selectedColumn.value
    if (!column) return ''
    if (column.defaultValueType === 'code') return String(column.defaultValue ?? '')
    if (column.defaultValueType === 'today') return "moment().format('YYYY-MM-DD')"
    if (column.defaultValueType === 'now') return 'Date.now()'
    const value = column.defaultValue
    if (value === undefined || value === null || value === '') return ''
    return JSON.stringify(value)
  },
  set: value => {
    if (!selectedColumn.value) return
    selectedColumn.value.defaultValue = value
    selectedColumn.value.defaultValueType = 'code'
  }
})

const propIssue = computed(() => {
  if (!selectedColumn.value) return ''
  const prop = String(selectedColumn.value.prop || '').trim()
  if (!prop) return '属性名不能为空'
  const duplicated = columns.value.some((column, index) => (
    index !== selectedIndex.value && String(column.prop || '').trim() === prop
  ))
  return duplicated ? '属性名重复' : ''
})

const slotName = computed(() => {
  void extensionVersion.value
  const component = selectedColumn.value?.component
  if (!component || !hasColumnSlot(component)) return null
  return `${toPascalCase(component)}ColumnModifySlot`
})

watch(visible, open => {
  if (!open || !props.section) return
  draft.value = cloneConfig(props.section)
  draft.value.columns = draft.value.columns.map(column => {
    const attrs = column.attrs && typeof column.attrs === 'object' ? { ...column.attrs } : {}
    return {
      ...column,
      attrs,
      attrsText: JSON.stringify(attrs, null, 2)
    }
  })
  selectedIndex.value = 0
  attrsError.value = ''
  showAttrs.value = false
})

watch(selectedIndex, () => {
  showAttrs.value = false
  attrsError.value = ''
})

function addColumn() {
  if (!draft.value) return
  const used = new Set(draft.value.columns.map(column => column.prop))
  let index = draft.value.columns.length + 1
  let prop = `column${index}`
  while (used.has(prop)) prop = `column${++index}`
  draft.value.columns.push({
    prop,
    label: `新列${index}`,
    fixed: false,
    component: '',
    attrs: {}
  })
  selectedIndex.value = draft.value.columns.length - 1
}

function removeColumn(index) {
  if (!draft.value || draft.value.columns.length <= 1) {
    ElMessage.warning('每个区块至少保留一列')
    return
  }
  draft.value.columns.splice(index, 1)
  if (selectedIndex.value >= draft.value.columns.length) {
    selectedIndex.value = draft.value.columns.length - 1
  }
}

function moveColumn(index, delta) {
  if (!draft.value) return
  const target = index + delta
  if (target < 0 || target >= draft.value.columns.length) return
  const [column] = draft.value.columns.splice(index, 1)
  draft.value.columns.splice(target, 0, column)
  selectedIndex.value = target
}

function parseAttrs(column) {
  if (!column || (column.component && hasColumnSlot(column.component))) return true
  if (column.attrsText === undefined) return true
  try {
    const value = JSON.parse(column.attrsText || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('必须是 JSON 对象')
    }
    column.attrs = value
    return true
  } catch (error) {
    attrsError.value = `attrs 不是合法 JSON：${error.message}`
    return false
  }
}

function handleSave() {
  if (!draft.value) return
  if (!String(draft.value.title || '').trim()) {
    ElMessage.warning('请输入区块标题')
    return
  }
  const propsSet = new Set()
  for (const column of draft.value.columns) {
    const prop = String(column.prop || '').trim()
    if (!prop) {
      ElMessage.warning('列的属性名不能为空')
      return
    }
    if (propsSet.has(prop)) {
      ElMessage.warning(`属性名「${prop}」重复`)
      return
    }
    propsSet.add(prop)
    if (!parseAttrs(column)) return
    delete column.attrsText
  }
  emit('save', cloneConfig(draft.value))
  visible.value = false
}

// 同步 attrs 文本（外部插槽列由插槽组件自行编辑，不显示 JSON）
watch(selectedColumn, column => {
  if (column && !(column.component && hasColumnSlot(column.component))) {
    column.attrsText = JSON.stringify(column.attrs || {}, null, 2)
  }
})
</script>

<template>
  <AppDialog
    v-model="visible"
    title="列设置"
    :subtitle="draft ? `${draft.title} · ${draft.columns.length} 列` : ''"
    icon="Grid"
    width="900px"
    show-footer
  >
    <div v-if="draft" class="columns-body">
      <aside class="columns-nav">
        <header class="columns-nav-head">
          <span>列 <small>{{ draft.columns.length }}</small></span>
          <button type="button" title="添加列" @click="addColumn">
            <el-icon :size="13"><Plus /></el-icon>
          </button>
        </header>
        <el-scrollbar class="columns-nav-scroll">
          <div class="columns-nav-inner">
            <button
              v-for="(column, index) in draft.columns"
              :key="index"
              type="button"
              class="columns-nav-item"
              :class="{ active: selectedIndex === index }"
              @click="selectedIndex = index"
            >
              <span class="columns-nav-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="columns-nav-copy">
                <strong>{{ column.label || '未命名列' }}</strong>
                <code>{{ column.prop }}</code>
              </span>
            </button>
          </div>
        </el-scrollbar>
      </aside>

      <el-scrollbar class="columns-editor">
        <div class="columns-editor-inner">
          <header class="section-settings">
            <label class="field">
              <span>区块标题</span>
              <el-input v-model="draft.title" size="small" placeholder="区块标题" />
            </label>
            <span class="type-badge">{{ draft.type }}</span>
            <label class="field expand-field">
              <span>展开 Markdown 明细</span>
              <el-switch v-model="draft.hasExpandColumn" size="small" />
            </label>
          </header>

          <template v-if="selectedColumn">
            <div class="column-toolbar">
              <div class="column-toolbar-title">
                <strong>{{ selectedColumn.label || '未命名列' }}</strong>
                <code>{{ selectedColumn.prop }}</code>
              </div>
              <div class="column-toolbar-actions">
                <button type="button" :disabled="selectedIndex === 0" @click="moveColumn(selectedIndex, -1)">上移</button>
                <button type="button" :disabled="selectedIndex === draft.columns.length - 1" @click="moveColumn(selectedIndex, 1)">下移</button>
                <button type="button" class="danger" :disabled="draft.columns.length <= 1" @click="removeColumn(selectedIndex)">删除</button>
              </div>
            </div>

            <div class="property-grid">
              <label class="field">
                <span>列名</span>
                <el-input v-model="selectedColumn.label" size="small" placeholder="列名" />
              </label>
              <label class="field">
                <span>属性名</span>
                <el-input
                  v-model="selectedColumn.prop"
                  size="small"
                  placeholder="prop"
                  class="mono-input"
                  :class="{ 'has-error': propIssue }"
                />
                <small v-if="propIssue" class="field-error">{{ propIssue }}</small>
              </label>
              <label class="field">
                <span>宽度</span>
                <el-input
                  v-model="columnWidth"
                  size="small"
                  inputmode="numeric"
                  placeholder="留空自动分配"
                />
              </label>
              <label class="field switch-field">
                <span>固定列</span>
                <el-switch v-model="selectedColumn.fixed" size="small" />
              </label>
            </div>

            <div class="property-block">
              <div class="block-title">编辑器组件</div>
              <el-select
                v-model="selectedColumn.component"
                size="small"
                clearable
                placeholder="默认文本输入"
                class="full-width"
              >
                <el-option label="默认文本输入" value="" />
                <el-option
                  v-for="option in componentOptions"
                  :key="option.value"
                  :label="`${option.value}${option.source === 'builtin' ? '（内置）' : '（扩展）'}`"
                  :value="option.value"
                />
              </el-select>
              <p class="block-hint">
                内置：status-selector / date-selector / number-input / textarea / select / multi-select / switch；扩展组件来自 resources/comps。
              </p>
            </div>

            <div class="property-block">
              <div class="block-title">默认值（JS 表达式）</div>
              <div class="default-code">
                <code-editor
                  v-model="defaultCode"
                  language="javascript"
                />
              </div>
              <p class="block-hint">
                新建行时执行，例如 <code>"开发中"</code>、<code>moment().format('YYYY-MM-DD')</code>、<code>Date.now()</code>。
              </p>
            </div>

            <div v-if="slotName" class="property-block">
              <div class="block-title">{{ selectedColumn.component }} 列配置</div>
              <component
                :is="slotName"
                :key="`${slotName}-${selectedIndex}-${extensionVersion}`"
                v-model="selectedColumn"
                :model-value="selectedColumn"
                :column="selectedColumn"
              />
            </div>

            <div v-else class="property-block">
              <button type="button" class="advanced-toggle" @click="showAttrs = !showAttrs">
                <span>高级 attrs</span>
                <el-icon :class="{ 'is-open': showAttrs }"><ArrowDown /></el-icon>
              </button>
              <template v-if="showAttrs">
                <el-input
                  v-model="selectedColumn.attrsText"
                  type="textarea"
                  :rows="5"
                  resize="vertical"
                  placeholder='{ "options": ["开发中", "已完成"] }'
                  class="attrs-input"
                />
                <small v-if="attrsError" class="field-error">{{ attrsError }}</small>
                <p class="block-hint">JSON 对象，保存时校验；留空视为 {}。</p>
              </template>
            </div>
          </template>
        </div>
      </el-scrollbar>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSave">保存列设置</el-button>
    </template>
  </AppDialog>
</template>

<style scoped>
.columns-body {
  display: flex;
  height: min(600px, calc(100vh - 180px));
  min-height: 420px;
}

.columns-nav {
  width: 240px;
  flex: none;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.columns-nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.columns-nav-head small {
  margin-left: 4px;
  font-family: var(--wr-mono);
  font-size: 9px;
  color: var(--el-text-color-placeholder);
}

.columns-nav-head button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.columns-nav-head button:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.columns-nav-scroll {
  flex: 1;
  min-height: 0;
}

.columns-nav-inner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
}

.columns-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.columns-nav-item:hover {
  border-color: var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.columns-nav-item.active {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}

.columns-nav-item.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--el-color-primary);
}

.columns-nav-index {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 5px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-family: var(--wr-mono);
  font-size: 9px;
}

.columns-nav-item.active .columns-nav-index {
  background: var(--el-color-primary);
  color: #fff;
}

.columns-nav-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.columns-nav-copy strong {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.columns-nav-copy code {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.columns-editor {
  flex: 1;
  min-height: 0;
}

.columns-editor-inner {
  display: flex;
  flex-direction: column;
  padding: 16px 22px 24px;
}

.section-settings {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-settings .field {
  width: 220px;
}

.type-badge {
  align-self: center;
  margin-top: 14px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-family: var(--wr-mono);
  font-size: 10px;
}

.expand-field {
  margin-left: auto;
  align-items: flex-start;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.field > span {
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.field .el-input,
.field .el-input-number {
  width: 100%;
}

.column-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0 10px;
}

.column-toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.column-toolbar-title strong {
  font-size: 14px;
  font-weight: 650;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.column-toolbar-title code {
  font-family: var(--wr-mono);
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.column-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.column-toolbar-actions button {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.column-toolbar-actions button:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.column-toolbar-actions button.danger:hover:not(:disabled) {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.column-toolbar-actions button:disabled {
  opacity: 0.35;
  cursor: default;
}

.property-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 2px 0 16px;
}

.switch-field {
  align-items: flex-start;
}

.mono-input :deep(.el-input__inner) {
  font-family: var(--wr-mono);
  font-size: 11.5px;
}

.has-error :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset !important;
}

.field-error {
  font-size: 10.5px;
  color: var(--el-color-danger);
}

.property-block {
  padding: 14px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.block-title {
  margin-bottom: 7px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.block-hint {
  margin: 6px 0 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

.block-hint code {
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--el-fill-color);
  font-family: var(--wr-mono);
  font-size: 10px;
}

.full-width {
  width: 100%;
}

.default-code {
  height: 132px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.advanced-toggle .el-icon {
  transition: transform 0.15s ease;
}

.advanced-toggle .el-icon.is-open {
  transform: rotate(180deg);
}

.advanced-toggle + * {
  margin-top: 10px;
}

.attrs-input :deep(.el-textarea__inner) {
  font-family: var(--wr-mono);
  font-size: 11px;
  line-height: 1.6;
}
</style>
