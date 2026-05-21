<script setup>
import { ref, computed, inject } from 'vue'
import { injectDesignerState } from './composables/useDesignerState'

const { state, selectElement, addSection, removeSection, updateSection, addColumn, removeColumn } = injectDesignerState()

const isDragOver = ref(false)

// 检查元素是否选中
const isSelected = (type, sectionIndex, columnIndex = null) => {
  if (!state.selectedElement) return false
  if (state.selectedElement.type !== type) return false
  if (state.selectedElement.sectionIndex !== sectionIndex) return false
  if (columnIndex !== null && state.selectedElement.columnIndex !== columnIndex) return false
  return true
}

// 处理 dragover
const onDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  isDragOver.value = true
}

// 处理 dragleave
const onDragLeave = () => {
  isDragOver.value = false
}

// 处理 drop
const onDrop = (e) => {
  e.preventDefault()
  isDragOver.value = false

  const dataStr = e.dataTransfer.getData('application/json')
  if (!dataStr) return

  try {
    const data = JSON.parse(dataStr)
    if (data.type === 'new-section') {
      addSection(data.data)
    }
  } catch (err) {
    console.error('解析拖拽数据失败:', err)
  }
}

// 处理 section 点击
const onSectionClick = (sectionIndex, e) => {
  e.stopPropagation()
  selectElement({ type: 'section', sectionIndex })
}

// 处理 column 点击
const onColumnClick = (sectionIndex, columnIndex, e) => {
  e.stopPropagation()
  selectElement({ type: 'column', sectionIndex, columnIndex })
}

// 处理标题修改
const onTitleChange = (sectionIndex, e) => {
  const newTitle = e.target.innerText.trim()
  updateSection(sectionIndex, { title: newTitle })
}

// 处理标题失焦
const onTitleBlur = (sectionIndex, e) => {
  // 标题更新已在 change 事件处理
}

// 删除 section
const onRemoveSection = (sectionIndex, e) => {
  e.stopPropagation()
  removeSection(sectionIndex)
}

// 添加 column
const onAddColumn = (sectionIndex) => {
  addColumn(sectionIndex)
}

// 删除 column
const onRemoveColumn = (sectionIndex, columnIndex, e) => {
  e.stopPropagation()
  removeColumn(sectionIndex, columnIndex)
}
</script>

<template>
  <div class="canvas-area">
    <div class="canvas-toolbar">
      <div class="canvas-toolbar-left">
        <el-button type="primary" @click="addSection({ type: 'completed', title: '本周完成', icon: 'fas fa-check-circle' })">
          <i class="fas fa-plus"></i> 添加区块
        </el-button>
      </div>
      <div class="canvas-toolbar-right">
        <span class="section-count">{{ state.currentTemplate?.length || 0 }} 个区块</span>
      </div>
    </div>

    <div class="canvas-content">
      <!-- 空画布状态 -->
      <div
        v-if="!state.currentTemplate || state.currentTemplate.length === 0"
        class="canvas-empty"
        :class="{ 'drag-over': isDragOver }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <i class="fas fa-puzzle-piece"></i>
        <p>从左侧拖拽区块到此处</p>
        <p class="hint">或点击上方按钮添加区块</p>
      </div>

      <!-- 区块列表 -->
      <div
        v-for="(section, sectionIndex) in state.currentTemplate"
        :key="sectionIndex"
        class="canvas-section"
        :class="{ selected: isSelected('section', sectionIndex) }"
        @click="onSectionClick(sectionIndex, $event)"
      >
        <div class="canvas-section-header">
          <div class="section-header-left">
            <i :class="section.icon"></i>
            <span
              class="section-title-input"
              contenteditable="true"
              @blur="onTitleBlur(sectionIndex, $event)"
              @input="onTitleChange(sectionIndex, $event)"
              @click.stop
            >{{ section.title }}</span>
            <el-tag v-if="section.hasExpandColumn" size="small" type="info">可展开</el-tag>
          </div>
          <div class="section-header-actions">
            <el-button
              size="small"
              circle
              type="danger"
              @click="onRemoveSection(sectionIndex, $event)"
            >
              <i class="fas fa-trash"></i>
            </el-button>
          </div>
        </div>

        <div class="canvas-columns">
          <div
            v-for="(col, colIndex) in section.columns"
            :key="colIndex"
            class="canvas-column"
            :class="{ selected: isSelected('column', sectionIndex, colIndex) }"
            @click="onColumnClick(sectionIndex, colIndex, $event)"
          >
            <div class="column-label">{{ col.label }}</div>
            <div class="column-props">
              <span class="prop-tag">{{ col.prop }}</span>
              <span v-if="col.component" class="component-tag">{{ col.component }}</span>
            </div>
            <el-button
              v-if="!col.fixed"
              size="small"
              circle
              type="danger"
              class="column-delete-btn"
              @click="onRemoveColumn(sectionIndex, colIndex, $event)"
            >
              <i class="fas fa-times"></i>
            </el-button>
          </div>

          <!-- 添加列按钮 -->
          <div class="column-drop-zone" @click="onAddColumn(sectionIndex)">
            <i class="fas fa-plus"></i>
          </div>
        </div>
      </div>

      <!-- 拖放目标区（当有内容时） -->
      <div
        v-if="state.currentTemplate && state.currentTemplate.length > 0"
        class="canvas-drop-hint"
        :class="{ 'drag-over': isDragOver }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <i class="fas fa-plus"></i>
        <span>拖拽到此处添加区块</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-area {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  background: var(--editor-bg, #f8f9fa);
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.canvas-toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.canvas-toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-count {
  font-size: 13px;
  color: #909399;
}

.canvas-content {
  min-height: 200px;
}

.canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  border: 2px dashed #dcdfe6;
  border-radius: 12px;
  background: white;
  color: #909399;
  transition: all 0.3s ease;
  cursor: pointer;
}

.canvas-empty:hover {
  border-color: var(--primary-color, #409EFF);
}

.canvas-empty.drag-over {
  border-color: var(--primary-color, #409EFF);
  background: rgba(64, 158, 255, 0.05);
}

.canvas-empty i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #dcdfe6;
}

.canvas-empty p {
  font-size: 16px;
  margin: 0;
}

.canvas-empty .hint {
  font-size: 13px;
  color: #c0c4cc;
  margin-top: 8px;
}

.canvas-drop-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  margin-top: 16px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  color: #909399;
  font-size: 14px;
  transition: all 0.3s ease;
}

.canvas-drop-hint:hover,
.canvas-drop-hint.drag-over {
  border-color: var(--primary-color, #409EFF);
  color: var(--primary-color, #409EFF);
  background: rgba(64, 158, 255, 0.05);
}

/* 区块样式 */
.canvas-section {
  background: white;
  border: 2px solid transparent;
  border-radius: 10px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
  overflow: hidden;
}

.canvas-section:hover {
  border-color: rgba(64, 158, 255, 0.3);
}

.canvas-section.selected {
  border-color: var(--primary-color, #409EFF);
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.15);
}

.canvas-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%);
  border-bottom: 1px solid var(--border-color, #e6e8eb);
  cursor: pointer;
}

.canvas-section-header:hover {
  background: linear-gradient(135deg, #e6effe 0%, #f5f7fa 100%);
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-header-left i {
  font-size: 18px;
  color: var(--primary-color, #409EFF);
}

.section-title-input {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border: none;
  background: transparent;
  padding: 4px 8px;
  border-radius: 4px;
  outline: none;
  min-width: 120px;
}

.section-title-input:focus {
  background: white;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
}

.section-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.canvas-section:hover .section-header-actions {
  opacity: 1;
}

/* 列样式 */
.canvas-columns {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  min-height: 80px;
}

.canvas-column {
  position: relative;
  min-width: 120px;
  max-width: 200px;
  padding: 12px;
  background: var(--sidebar-bg, #f5f7fa);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.canvas-column:hover {
  background: #e6effe;
  border-color: rgba(64, 158, 255, 0.3);
}

.canvas-column.selected {
  background: #d9ecff;
  border-color: var(--primary-color, #409EFF);
}

.column-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.column-props {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.prop-tag {
  font-size: 11px;
  padding: 2px 6px;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  color: #606266;
}

.component-tag {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--primary-color, #409EFF);
  border-radius: 4px;
  color: white;
}

.column-delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.canvas-column:hover .column-delete-btn {
  opacity: 1;
}

/* 添加列按钮 */
.column-drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  height: 60px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s ease;
}

.column-drop-zone:hover {
  border-color: var(--primary-color, #409EFF);
  background: rgba(64, 158, 255, 0.05);
  color: var(--primary-color, #409EFF);
}
</style>