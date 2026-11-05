<script setup>
import { Plus, Setting, Delete } from '@element-plus/icons-vue'
import MarkdownEditor from '@/components/editors/MarkdownEditor.vue'
import { createRow } from '@/config/defaultReportConfig'
import { extensionVersion } from '@/plugins/registry'

defineOptions({ name: 'ReportSection' })

const props = defineProps({
  section: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['change', 'configure'])

function addItem() {
  const item = createRow(props.section.columns)
  if (props.section.hasExpandColumn) item.content = ''
  props.section.items.push(item)
  emit('change')
}

function removeItem(index) {
  props.section.items.splice(index, 1)
  emit('change')
}

function onCellChange() {
  emit('change')
}
</script>

<template>
  <div class="report-section">
    <header class="rs-head">
      <div class="rs-title-wrap">
        <i v-if="section.icon" :class="section.icon" />
        <h3>{{ section.title }}</h3>
        <span class="rs-count">{{ section.items.length }}</span>
      </div>
      <div class="rs-actions">
        <button type="button" class="rs-add-inline" @click="addItem">
          <el-icon :size="10"><Plus /></el-icon>
          添加记录
        </button>
        <button type="button" class="rs-gear" title="编辑列设置" @click="emit('configure', section)">
          <el-icon :size="13"><Setting /></el-icon>
        </button>
      </div>
    </header>

    <el-table
      v-if="section.columns.length"
      :data="section.items"
      row-key="id"
      size="small"
      class="rs-table"
    >
      <el-table-column
        v-if="section.hasExpandColumn"
        type="expand"
        width="26"
      >
        <template #default="{ row }">
          <div class="rs-detail">
            <markdown-editor v-model="row.content" :height="300" embedded @update:model-value="onCellChange" />
          </div>
        </template>
      </el-table-column>

      <el-table-column
        v-for="column in section.columns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :width="column.width || undefined"
      >
        <template #default="{ row }">
          <component
            v-if="column.component"
            :is="column.component"
            :key="`${column.component}-${extensionVersion}`"
            v-model="row[column.prop]"
            v-bind="column.attrs"
            @update:model-value="onCellChange"
          />
          <el-input
            v-else
            v-model="row[column.prop]"
            size="small"
            class="rs-input"
            placeholder="—"
            @input="onCellChange"
          />
        </template>
      </el-table-column>

      <el-table-column width="34" align="right">
        <template #default="{ $index }">
          <button type="button" class="rs-delete" title="删除该行" @click="removeItem($index)">
            <el-icon :size="12"><Delete /></el-icon>
          </button>
        </template>
      </el-table-column>

      <template #empty>
        <div class="rs-empty">暂无记录</div>
      </template>
    </el-table>

    <div v-else class="rs-empty">暂无列，点击右上角设置添加列</div>
  </div>
</template>

<style scoped>
.report-section {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  height: auto;
  color: var(--el-text-color-regular);
}

.rs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex: none;
  padding-bottom: 7px;
  margin-bottom: 2px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.rs-title-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.rs-title-wrap i {
  color: var(--el-color-primary);
  font-size: 12px;
}

.rs-title-wrap h3 {
  margin: 0;
  font-size: var(--report-section-title-size, 14px);
  font-weight: 650;
  color: var(--report-section-title-color, var(--el-text-color-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rs-count {
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-family: var(--wr-mono);
  font-size: 9px;
  line-height: 16px;
  text-align: center;
}

.rs-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.rs-add-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 22px;
  padding: 0 5px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.rs-add-inline:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.rs-gear {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--el-text-color-placeholder);
  opacity: 0.55;
  cursor: pointer;
  transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.report-section:hover .rs-gear {
  opacity: 1;
}

.rs-gear:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.rs-table {
  width: 100%;
  background: transparent;
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: var(--report-section-header-bg, var(--el-fill-color-light));
  --el-table-border-color: var(--el-border-color-lighter);
  --el-table-row-hover-bg-color: var(--el-fill-color-light);
  font-size: var(--report-section-font-size, 12px);
}

.rs-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.rs-table :deep(th.el-table__cell) {
  height: 28px;
  padding: 3px 0;
  background: var(--report-section-header-bg, var(--el-fill-color-light));
  color: var(--report-section-header-color, var(--el-text-color-secondary));
  font-size: 10.5px;
  font-weight: 600;
}

.rs-table :deep(td.el-table__cell) {
  padding: 3px 0;
  border-bottom-color: var(--el-border-color-lighter);
  color: var(--report-section-body-color, var(--el-text-color-primary));
}

.rs-table :deep(.el-input__wrapper),
.rs-table :deep(.el-select__wrapper) {
  min-height: 22px;
  padding: 0;
  border-radius: 3px;
  background: transparent;
  box-shadow: none;
}

.rs-table :deep(.el-input__inner),
.rs-table :deep(.el-select__placeholder) {
  font-size: inherit;
}

.rs-input :deep(.el-input__wrapper) {
  padding: 0 4px;
}

.rs-input :deep(.el-input__wrapper:hover),
.rs-table :deep(.el-select__wrapper:hover) {
  background: var(--el-fill-color-lighter);
  box-shadow: none;
}

/* 单元格进入编辑态时用底色提示，不再画输入框边框 */
.rs-table :deep(.el-input__wrapper.is-focus),
.rs-table :deep(.el-select__wrapper.is-focused) {
  background: var(--el-color-primary-light-9) !important;
  box-shadow: none !important;
}

.rs-table :deep(.el-input__wrapper.is-focus .el-input__inner) {
  color: var(--el-text-color-primary);
}

.rs-delete {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--el-text-color-placeholder);
  opacity: 0;
  cursor: pointer;
}

.rs-table :deep(.el-table__row:hover) .rs-delete {
  opacity: 1;
}

.rs-delete:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.rs-detail {
  padding: 2px 12px 10px;
  background: var(--el-fill-color-lighter);
}

.rs-empty {
  padding: 16px 8px;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
  text-align: center;
}
</style>
