<script setup>
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

defineOptions({ name: 'ThemeToggle' })

const { themeMode, labels, cycleTheme } = useTheme()

const icon = computed(() => {
  if (themeMode.value === 'light') return 'Sunny'
  if (themeMode.value === 'dark') return 'Moon'
  return 'Monitor'
})

const tip = computed(() => `主题：${labels[themeMode.value]}（点击切换）`)
</script>

<template>
  <el-tooltip :content="tip" placement="right">
    <el-button class="theme-toggle" circle text @click="cycleTheme">
      <el-icon :size="18"><component :is="icon" /></el-icon>
    </el-button>
  </el-tooltip>
</template>

<style scoped>
.theme-toggle {
  color: var(--el-text-color-secondary);
}
.theme-toggle:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}
</style>
