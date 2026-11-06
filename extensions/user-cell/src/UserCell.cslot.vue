<script setup>
import { nextTick, ref } from 'vue'
import { ElInput, ElTag, ElButton } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const column = defineModel()
const inputVisible = ref(false)
const inputValue = ref('')
const inputRef = ref(null)

function options() {
  if (!column.value.attrs) column.value.attrs = {}
  if (!Array.isArray(column.value.attrs.options)) column.value.attrs.options = []
  return column.value.attrs.options
}

function showInput() {
  inputVisible.value = true
  nextTick(() => inputRef.value?.focus?.())
}

function addOption() {
  const value = inputValue.value.trim()
  if (value && !options().includes(value)) options().push(value)
  inputVisible.value = false
  inputValue.value = ''
}
</script>

<template>
  <div class="user-slot">
    <div class="option-list">
      <ElTag v-for="(option, index) in options()" :key="option" closable @close="options().splice(index, 1)">
        {{ option }}
      </ElTag>
      <ElInput
        v-if="inputVisible"
        ref="inputRef"
        v-model="inputValue"
        size="small"
        class="option-input"
        placeholder="成员名称"
        @keyup.enter="addOption"
        @blur="addOption"
      />
      <ElButton v-else size="small" plain @click="showInput">
        <el-icon><Plus /></el-icon><span>添加成员</span>
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.option-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.option-input {
  width: 140px;
}
</style>
