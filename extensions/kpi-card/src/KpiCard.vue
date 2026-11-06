<script setup>
import { computed } from 'vue'
import { ElIcon } from 'element-plus'
import { TrendCharts, Bottom } from '@element-plus/icons-vue'

const props = defineProps({
  title: { type: String, default: '本周完成' },
  value: { type: [String, Number], default: 0 },
  unit: { type: String, default: '项' },
  trend: { type: [String, Number], default: 0 },
  tone: { type: String, default: 'primary' }
})

const trendUp = computed(() => Number(props.trend) >= 0)
</script>

<template>
  <div class="kpi-card" :class="`is-${tone}`">
    <div class="kpi-head">
      <span class="kpi-title">{{ title }}</span>
      <span class="kpi-icon"><ElIcon :size="15"><TrendCharts /></ElIcon></span>
    </div>
    <div class="kpi-value">
      <strong>{{ value }}</strong>
      <small>{{ unit }}</small>
    </div>
    <div class="kpi-trend" :class="{ down: !trendUp }">
      <ElIcon :size="11"><TrendCharts v-if="trendUp" /><Bottom v-else /></ElIcon>
      <span>{{ Math.abs(Number(trend) || 0) }}% 较上周</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.kpi-card {
  height: 100%;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  .kpi-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kpi-title {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .kpi-icon {
    color: var(--el-color-primary);
  }

  .kpi-value {
    display: flex;
    align-items: baseline;
    gap: 5px;

    strong {
      font-family: var(--wr-mono, monospace);
      font-size: 30px;
      line-height: 1;
      color: var(--el-text-color-primary);
    }

    small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .kpi-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--el-color-success);

    &.down {
      color: var(--el-color-danger);
    }
  }
}
</style>
