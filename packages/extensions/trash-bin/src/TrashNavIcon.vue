<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { useWeekReport as useHost } from '@lucky-apps/plugin-api'

defineOptions({ name: 'TrashNavIcon' })

const api = useHost()
const count = ref(0)
let off = null

async function refresh() {
  try {
    const stats = await api.reports.stats()
    count.value = Math.max(0, Number(stats?.trash) || 0)
  } catch {}
}

onMounted(() => {
  refresh()
  off = api.events.on('report:changed', refresh)
})

onBeforeUnmount(() => off?.())
</script>

<template>
  <span class="trash-nav-icon">
    <el-icon :size="18"><Delete /></el-icon>
    <span v-if="count > 0" class="trash-nav-badge">{{ count > 99 ? '99+' : count }}</span>
  </span>
</template>

<style scoped>
.trash-nav-icon {
  position: relative;
  display: grid;
  place-items: center;
}

.trash-nav-badge {
  position: absolute;
  top: -6px;
  right: -7px;
  min-width: 13px;
  height: 13px;
  padding: 0 3px;
  border-radius: 7px;
  background: var(--el-color-danger);
  color: #fff;
  font-family: var(--wr-mono);
  font-size: 8px;
  line-height: 13px;
  text-align: center;
}
</style>
