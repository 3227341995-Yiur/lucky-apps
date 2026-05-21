<script setup>
import { defineModel, defineProps, computed, capitalize, ref } from 'vue'
import { components, columnSlots } from '@/components'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

const column = defineModel({
  type: Object,
  default: () => ({})
})

const componentName = computed(() => {
  return (column.value.component || '').split('-')
      .map(word => capitalize(word))
      .join('')
})

const isHovered = ref(false)
</script>

<template>
  <div
      class="column-card"
      :class="{ 'card-hover': isHovered, 'card-disabled': disabled }"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
  >
    <div class="card-header">
      <div class="header-content">
        <el-input
            v-model="column.label"
            placeholder="列标题"
            size="small"
            :disabled="disabled"
            class="title-input"
        />
        <div class="header-actions">
          <slot name="header"></slot>
        </div>
      </div>
    </div>

    <div class="card-body">
      <el-form
          label-width="100px"
          :disabled="disabled"
          class="column-form"
      >
        <el-form-item label="组件类型" class="form-item">
          <el-select
              v-model="column.component"
              placeholder="请选择组件（清空默认el-input）"
              clearable
              class="component-select"
          >
            <el-option
                v-for="(index, comp) in components"
                :key="index"
                :label="comp"
                :value="comp"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="属性名" class="form-item">
          <el-input
              v-model="column.prop"
              placeholder="数据字段名"
              class="prop-input"
          />
        </el-form-item>

        <el-form-item label="宽度" class="form-item">
          <el-input
              v-model="column.width"
              placeholder="输入宽度"
              type="number"
              class="width-input"
          />
        </el-form-item>

        <el-form-item label="固定列" class="form-item">
          <el-switch v-model="column.fixed" class="fixed-switch" />
        </el-form-item>

        <el-form-item label="默认值" class="form-item">
          <!-- 替换为代码编辑器 -->
          <code-editor
              v-model="column.defaultValue"
              language="javascript"
              class="code-editor"
              :disabled="disabled"
          />
        </el-form-item>

        <template v-if="columnSlots[componentName]">
          <component :is="componentName + 'ColumnModifySlot'" v-bind="{ ...props, ...$attrs }" />
        </template>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.column-card {
  min-width: 500px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateY(0);
  border: 1px solid transparent;
  position: relative;
}

.column-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #409EFF, #66b1ff);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.column-card:hover::before {
  opacity: 1;
}

.card-hover {
  box-shadow: 0 12px 30px rgba(64, 158, 255, 0.18);
  border-color: rgba(64, 158, 255, 0.2);
}

.card-disabled {
  opacity: 0.7;
  pointer-events: none;
}

.card-header {
  padding: 16px 20px 0;
  position: relative;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px dashed #e6e8eb;
}

.title-input {
  flex: 1;
}

.title-input :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  font-size: 16px;
  font-weight: 600;
  padding: 4px 0;
  border-radius: 0;
  border-bottom: 1px solid transparent;
  transition: border-color 0.3s ease;
}

.title-input :deep(.el-input__wrapper:hover),
.title-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: none !important;
  border-bottom: 1px solid #409EFF;
}

.header-actions {
  margin-left: 12px;
}

.card-body {
  padding: 20px;
}

.column-form {
  padding: 0;
}

.form-item {
  margin-bottom: 18px;
  padding: 10px 0;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.form-item:hover {
  background-color: rgba(245, 247, 250, 0.6);
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-item :deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
  padding-right: 20px;
}

.component-select, .prop-input, .width-input {
  width: 100%;
}

.component-select :deep(.el-input__wrapper),
.prop-input :deep(.el-input__wrapper),
.width-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.component-select :deep(.el-input__wrapper:hover),
.prop-input :deep(.el-input__wrapper:hover),
.width-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #409EFF inset;
}

.fixed-switch {
  margin-top: 4px;
}

.code-editor {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  height: 150px;
  overflow: hidden;
  transition: border-color 0.3s ease;
}

.code-editor:hover {
  border-color: #c0c4cc;
}

.code-editor :deep(.cm-editor) {
  width: 100%;
  border-radius: 8px;
}

/* 动画效果 */
.column-card {
  animation: fadeIn 0.4s ease-out;
}

:deep(.el-tag), :deep(.el-tag+button) {
  margin-right: 10px;
  margin-bottom: 5px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>