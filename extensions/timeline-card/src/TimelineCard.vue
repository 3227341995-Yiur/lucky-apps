<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '本周节点' },
  items: {
    type: Array,
    default: () => [
      { time: '周一', title: '需求评审', desc: '确认本周范围', type: 'primary' },
      { time: '周三', title: '开发完成', desc: '提交联调版本', type: 'success' },
      { time: '周五', title: '验收上线', desc: '完成回归测试', type: 'warning' }
    ]
  }
})

const rows = computed(() => (Array.isArray(props.items) ? props.items : []))
</script>

<template>
  <div class="timeline-card">
    <header class="tl-head">{{ title }}</header>
    <div class="tl-list">
      <div v-for="item in rows" :key="`${item.time}-${item.title}`" class="tl-item" :class="`is-${item.type || 'primary'}`">
        <span class="tl-dot" />
        <div class="tl-body">
          <div class="tl-line">
            <strong>{{ item.title }}</strong>
            <small>{{ item.time }}</small>
          </div>
          <p>{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.timeline-card {
  height: 100%;
  padding: 13px 15px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  overflow: hidden;

  .tl-head {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .tl-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tl-item {
    position: relative;
    display: flex;
    gap: 9px;
    padding-left: 2px;

    .tl-dot {
      width: 7px;
      height: 7px;
      margin-top: 4px;
      flex: none;
      border-radius: 50%;
      background: var(--el-color-primary);
    }

    .tl-body {
      flex: 1;
      min-width: 0;
      padding-bottom: 7px;
      border-bottom: 1px dashed var(--el-border-color-lighter);
    }

    .tl-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      strong {
        font-size: 11.5px;
        color: var(--el-text-color-primary);
      }

      small {
        font-family: var(--wr-mono, monospace);
        font-size: 9px;
        color: var(--el-text-color-placeholder);
      }
    }

    p {
      margin: 2px 0 0;
      font-size: 10.5px;
      color: var(--el-text-color-secondary);
    }

    &.is-success .tl-dot { background: var(--el-color-success); }
    &.is-warning .tl-dot { background: var(--el-color-warning); }
  }
}
</style>
