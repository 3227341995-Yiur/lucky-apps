<script setup>
import { computed, ref, inject } from 'vue'
import { injectDesignerState } from './composables/useDesignerState'
import ColumnCard from '@/components/ColumnCard.vue'
import CodeEditor from '@/components/CodeEditor.vue'

const { state, updateSection, updateColumn, clearSelection } = injectDesignerState()

// 当前选中的元素类型
const selectedType = computed(() => {
  return state.selectedElement?.type || null
})

// Section 属性
const sectionForm = computed({
  get: () => state.selectedSection || {},
  set: (val) => {
    if (state.selectedElement?.type === 'section') {
      updateSection(state.selectedElement.sectionIndex, val)
    }
  }
})

// Column 属性
const columnForm = computed({
  get: () => state.selectedColumn || {},
  set: (val) => {
    if (state.selectedElement?.type === 'column') {
      updateColumn(state.selectedElement.sectionIndex, state.selectedElement.columnIndex, val)
    }
  }
})

// 图标选项
const iconOptions = [
  { value: 'fas fa-check-circle', label: '完成', icon: 'fas fa-check-circle' },
  { value: 'fas fa-headset', label: '支持', icon: 'fas fa-headset' },
  { value: 'fas fa-calendar-week', label: '计划', icon: 'fas fa-calendar-week' },
  { value: 'fas fa-tasks', label: '任务', icon: 'fas fa-tasks' },
  { value: 'fas fa-bug', label: 'Bug', icon: 'fas fa-bug' },
  { value: 'fas fa-chart-line', label: '统计', icon: 'fas fa-chart-line' }
]

// 更新 section 属性
const onSectionUpdate = (key, value) => {
  if (state.selectedElement?.type === 'section') {
    updateSection(state.selectedElement.sectionIndex, { [key]: value })
  }
}

// 更新 column 属性
const onColumnUpdate = (columnData) => {
  if (state.selectedElement?.type === 'column') {
    updateColumn(state.selectedElement.sectionIndex, state.selectedElement.columnIndex, columnData)
  }
}

// 更新 section 的模板
const onTemplateUpdate = (value) => {
  if (state.selectedElement?.type === 'section') {
    updateSection(state.selectedElement.sectionIndex, { template: value })
  }
}

// 更新 section 的样式
const onStyleUpdate = (value) => {
  if (state.selectedElement?.type === 'section') {
    updateSection(state.selectedElement.sectionIndex, { styles: value })
  }
}

// 更新 section 的值结构
const onValueSchemaUpdate = (value) => {
  if (state.selectedElement?.type === 'section') {
    updateSection(state.selectedElement.sectionIndex, { valueSchema: value })
  }
}

// 更新 section 的渲染条件
const onRenderConditionUpdate = (value) => {
  if (state.selectedElement?.type === 'section') {
    updateSection(state.selectedElement.sectionIndex, { renderCondition: value })
  }
}
</script>

<template>
  <div class="properties-panel">
    <div class="properties-header">
      <h3>
        <i class="fas fa-cog"></i>
        属性面板
      </h3>
    </div>

    <div class="properties-content">
      <div v-if="!selectedType" class="no-selection">
        <i class="fas fa-mouse-pointer"></i>
        <p>选择区块或列</p>
        <p class="hint">以编辑其属性</p>
      </div>

      <!-- Section 属性 -->
      <div v-else-if="selectedType === 'section'" class="property-section">
        <!-- 基础设置 -->
        <div class="property-group">
          <div class="property-group-title">
            <i class="fas fa-layer-group"></i>
            基础设置
          </div>
          <el-form label-position="top" size="small">
            <el-form-item label="标题">
              <el-input
                :model-value="sectionForm.title"
                @update:modelValue="onSectionUpdate('title', $event)"
                placeholder="输入区块标题"
              />
            </el-form-item>
            <el-form-item label="图标">
              <div class="icon-selector">
                <div
                  v-for="icon in iconOptions"
                  :key="icon.value"
                  class="icon-option"
                  :class="{ active: sectionForm.icon === icon.value }"
                  @click="onSectionUpdate('icon', icon.value)"
                >
                  <i :class="icon.icon"></i>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="可展开详情">
              <el-switch
                :model-value="sectionForm.hasExpandColumn"
                @update:modelValue="onSectionUpdate('hasExpandColumn', $event)"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- 值结构定义 -->
        <div class="property-group">
          <div class="property-group-title">
            <i class="fas fa-database"></i>
            值结构
          </div>
          <div class="code-editor-wrapper">
            <code-editor
              :model-value="JSON.stringify(sectionForm.valueSchema || {}, null, 2)"
              @update:modelValue="v => onValueSchemaUpdate(JSON.parse(v || '{}'))"
              language="json"
              :height="120"
            />
          </div>
          <p class="field-hint">定义item的数据结构，如：{"title": "", "status": ""}</p>
        </div>

        <!-- 模板语法 -->
        <div class="property-group">
          <div class="property-group-title">
            <i class="fas fa-code"></i>
            渲染模板 (Handlebars)
          </div>
          <div class="code-editor-wrapper">
            <code-editor
              :model-value="sectionForm.template || ''"
              @update:modelValue="onTemplateUpdate"
              language="html"
              :height="200"
            />
          </div>
          <p class="field-hint">
            使用 Handlebars 语法，如：
            <code>{{ '{{' }}#each items}}...{{ '{{' }}/each}}</code>
            <code>{{ '{{' }}title}}</code>
          </p>
        </div>

        <!-- 渲染条件 -->
        <div class="property-group">
          <div class="property-group-title">
            <i class="fas fa-filter"></i>
            渲染条件 (Handlebars 表达式)
          </div>
          <el-input
            :model-value="sectionForm.renderCondition || ''"
            @update:modelValue="onRenderConditionUpdate"
            placeholder="如: items.length > 0"
          />
          <p class="field-hint">
            使用 Handlebars 表达式，如：<code>{{ '{{' }}#if items.length}}...{{ '{{' }}/if}}</code>
          </p>
        </div>

        <!-- 自定义样式 -->
        <div class="property-group">
          <div class="property-group-title">
            <i class="fas fa-paint-brush"></i>
            自定义样式
          </div>
          <div class="code-editor-wrapper">
            <code-editor
              :model-value="sectionForm.styles || ''"
              @update:modelValue="onStyleUpdate"
              language="css"
              :height="150"
            />
          </div>
        </div>

        <!-- 列信息 -->
        <div class="property-group">
          <div class="property-group-title">
            <i class="fas fa-columns"></i>
            列信息
          </div>
          <div class="columns-info">
            <div
              v-for="(col, index) in sectionForm.columns"
              :key="index"
              class="column-info-item"
            >
              <span class="column-index">{{ index + 1 }}</span>
              <span class="column-label">{{ col.label }}</span>
              <span v-if="col.component" class="column-component">{{ col.component }}</span>
            </div>
          </div>
          <div class="columns-count">共 {{ sectionForm.columns?.length || 0 }} 列</div>
        </div>
      </div>

      <!-- Column 属性 -->
      <div v-else-if="selectedType === 'column'" class="property-section">
        <div class="property-group">
          <div class="property-group-title">
            <i class="fas fa-columns"></i>
            列属性
          </div>
          <column-card
            v-model="columnForm"
            :disabled="false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.properties-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.properties-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e6e8eb);
}

.properties-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.properties-header h3 i {
  color: var(--primary-color, #409EFF);
}

.properties-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #909399;
  text-align: center;
}

.no-selection i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #dcdfe6;
}

.no-selection p {
  margin: 0;
  font-size: 14px;
}

.no-selection .hint {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}

.property-section {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.property-group {
  margin-bottom: 24px;
}

.property-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color, #409EFF);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color, #e6e8eb);
  display: flex;
  align-items: center;
  gap: 6px;
}

.property-group-title i {
  font-size: 14px;
}

.icon-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.icon-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--sidebar-bg, #f5f7fa);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-option:hover {
  background: #e6effe;
  border-color: rgba(64, 158, 255, 0.3);
}

.icon-option.active {
  background: #d9ecff;
  border-color: var(--primary-color, #409EFF);
  color: var(--primary-color, #409EFF);
}

.icon-option i {
  font-size: 18px;
  color: #606266;
}

.icon-option.active i {
  color: var(--primary-color, #409EFF);
}

.code-editor-wrapper {
  border: 1px solid var(--border-color, #e6e8eb);
  border-radius: 8px;
  overflow: hidden;
}

.field-hint {
  font-size: 11px;
  color: #909399;
  margin-top: 6px;
  line-height: 1.4;
}

.field-hint code {
  background: #f5f7fa;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
}

.columns-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.column-info-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--sidebar-bg, #f5f7fa);
  border-radius: 6px;
}

.column-index {
  width: 20px;
  height: 20px;
  background: var(--primary-color, #409EFF);
  color: white;
  border-radius: 50%;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.column-label {
  flex: 1;
  font-size: 13px;
  color: #333;
  font-weight: 500;
}

.column-component {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--primary-color, #409EFF);
  color: white;
  border-radius: 4px;
}

.columns-count {
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}
</style>