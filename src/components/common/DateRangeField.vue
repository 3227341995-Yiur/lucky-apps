<script setup>
import { computed, ref, watch } from 'vue'
import { Calendar, ArrowRight, ArrowDown } from '@element-plus/icons-vue'
import { formatDate, getWeekRange } from '@/utils/date'

defineOptions({ name: 'DateRangeField' })

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '选择日期范围'
  },
  allowClear: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const visible = ref(false)
const start = ref('')
const end = ref('')

function sync(value) {
  start.value = Array.isArray(value) ? value[0] || '' : ''
  end.value = Array.isArray(value) ? value[1] || '' : ''
}

watch(() => props.modelValue, sync, { immediate: true, deep: true })

const label = computed(() => {
  if (!start.value && !end.value) return props.placeholder
  return `${start.value || '开始'} → ${end.value || '结束'}`
})

function commit(nextStart = start.value, nextEnd = end.value) {
  if (!nextStart || !nextEnd) return
  const range = [nextStart, nextEnd]
  emit('update:modelValue', range)
  emit('change', range)
}

function onStart(value) {
  start.value = value || ''
  if (start.value && end.value && start.value > end.value) end.value = start.value
  commit()
}

function onEnd(value) {
  end.value = value || ''
  if (start.value && end.value && end.value < start.value) start.value = end.value
  commit()
}

function useWeek(offset = 0) {
  const base = new Date()
  base.setDate(base.getDate() + offset * 7)
  const [weekStart, weekEnd] = getWeekRange(base)
  start.value = weekStart
  end.value = weekEnd
  commit()
  visible.value = false
}

function clear() {
  start.value = ''
  end.value = ''
  emit('update:modelValue', [])
  emit('change', [])
  visible.value = false
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    trigger="click"
    placement="bottom-start"
    :width="320"
    popper-class="wr-range-popover"
    :show-arrow="false"
  >
    <template #reference>
      <button type="button" class="date-trigger" :class="{ empty: !start && !end }">
        <el-icon class="date-icon" :size="13"><Calendar /></el-icon>
        <span class="date-value">{{ start || '开始日期' }}</span>
        <el-icon class="date-arrow" :size="10"><ArrowRight /></el-icon>
        <span class="date-value">{{ end || '结束日期' }}</span>
        <el-icon class="date-chevron" :size="10"><ArrowDown /></el-icon>
      </button>
    </template>

    <div class="range-panel">
      <div class="range-presets">
        <button type="button" @click="useWeek(0)">本周</button>
        <button type="button" @click="useWeek(-1)">上周</button>
        <button type="button" @click="useWeek(-2)">两周前</button>
      </div>

      <label class="range-field">
        <span>开始</span>
        <el-date-picker
          :model-value="start"
          type="date"
          size="small"
          value-format="YYYY-MM-DD"
          placeholder="开始日期"
          @update:model-value="onStart"
        />
      </label>

      <label class="range-field">
        <span>结束</span>
        <el-date-picker
          :model-value="end"
          type="date"
          size="small"
          value-format="YYYY-MM-DD"
          placeholder="结束日期"
          @update:model-value="onEnd"
        />
      </label>

      <div class="range-footer">
        <button v-if="allowClear" type="button" class="range-clear" @click="clear">清除</button>
        <button type="button" class="range-done" @click="visible = false">完成</button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.date-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  height: 26px;
  padding: 0 5px;
  margin-left: -5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-family: var(--wr-mono);
  font-size: 11.5px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.date-trigger:hover {
  background: var(--el-fill-color-light);
}

.date-trigger.empty {
  color: var(--el-text-color-placeholder);
}

.date-icon {
  flex: none;
  color: var(--el-text-color-placeholder);
}

.date-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-arrow {
  flex: none;
  color: var(--el-text-color-placeholder);
}

.date-chevron {
  flex: none;
  margin-left: 2px;
  color: var(--el-text-color-placeholder);
}

.range-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.range-presets {
  display: flex;
  gap: 4px;
}

.range-presets button {
  padding: 3px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.range-presets button:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.range-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.range-field > span {
  width: 28px;
  flex: none;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.range-field :deep(.el-date-editor) {
  flex: 1;
  width: 100%;
}

.range-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.range-clear {
  margin-right: auto;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.range-clear:hover {
  color: var(--el-color-danger);
}

.range-done {
  padding: 4px 12px;
  border: 0;
  border-radius: 4px;
  background: var(--el-color-primary);
  color: #fff;
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.range-done:hover {
  background: var(--el-color-primary-dark-2);
}
</style>

<style>
.wr-range-popover.el-popover {
  padding: 12px;
  border-radius: 8px;
  border-color: var(--el-border-color-light);
  box-shadow: var(--wr-shadow-md);
}
</style>
