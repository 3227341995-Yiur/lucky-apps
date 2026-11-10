<script setup lang="ts">
import { computed } from 'vue'
import { ElProgress } from 'element-plus'

const props = defineProps({
  title: { type: String, default: '项目进度' },
  items: {
    type: Array,
    default: () => [
      { label: '需求梳理', value: 100, status: 'success' },
      { label: '开发联调', value: 68, status: 'primary' },
      { label: '测试验收', value: 30, status: 'warning' }
    ]
  }
})

const rows = computed(() => (Array.isArray(props.items) ? props.items : []))
</script>

<template>
  <div class="progress-board">
    <header class="pb-head">
      <span>{{ title }}</span>
      <small>{{ rows.length }} 项</small>
    </header>
    <div class="pb-list">
      <div v-for="item in rows" :key="item.label" class="pb-row">
        <div class="pb-line">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}%</strong>
        </div>
        <ElProgress
          :percentage="Number(item.value) || 0"
          :status="item.status || undefined"
          :stroke-width="6"
          :show-text="false"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-board {
  height: 100%;
  padding: 13px 15px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pb-head small {
  font-family: var(--wr-mono, monospace);
  font-size: 9px;
  color: var(--el-text-color-placeholder);
}

.pb-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.pb-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.pb-line strong {
  font-family: var(--wr-mono, monospace);
  font-size: 10px;
  color: var(--el-text-color-primary);
}
</style>
