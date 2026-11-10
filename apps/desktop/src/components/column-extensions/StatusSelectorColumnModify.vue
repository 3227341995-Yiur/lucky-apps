<script setup lang="ts">
import { nextTick, ref } from 'vue'

defineOptions({ name: 'StatusSelectorColumnModify' })

const emit = defineEmits(['change'])

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const inputVisible = ref(false)
const inputValue = ref('')
const inputRef = ref(null)

function ensureOptions() {
  if (!props.column.attrs) props.column.attrs = {}
  if (!Array.isArray(props.column.attrs.options)) props.column.attrs.options = []
  return props.column.attrs.options
}

function showInput() {
  inputVisible.value = true
  nextTick(() => inputRef.value?.focus?.())
}

function addOption() {
  const value = inputValue.value.trim()
  if (value) {
    const options = ensureOptions()
    if (!options.includes(value)) options.push(value)
  }
  inputVisible.value = false
  inputValue.value = ''
  emit('change')
}

function removeOption(index) {
  ensureOptions().splice(index, 1)
  emit('change')
}
</script>

<template>
  <div class="option-editor">
    <div class="option-list">
      <el-tag
        v-for="(option, index) in column.attrs?.options || []"
        :key="`${option}-${index}`"
        :closable="!disabled"
        :disable-transitions="false"
        @close="removeOption(index)"
      >
        {{ option }}
      </el-tag>
      <el-input
        v-if="inputVisible"
        ref="inputRef"
        v-model="inputValue"
        size="small"
        class="option-input"
        placeholder="选项名称"
        @keyup.enter="addOption"
        @blur="addOption"
      />
      <el-button v-else-if="!disabled" size="small" plain @click="showInput">
        <el-icon><Plus /></el-icon>
        <span>添加选项</span>
      </el-button>
    </div>
    <p class="option-hint">下拉框会按这里的顺序显示，回车添加。</p>
  </div>
</template>

<style scoped>
.option-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.option-input {
  width: 140px;
}

.option-hint {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}
</style>
