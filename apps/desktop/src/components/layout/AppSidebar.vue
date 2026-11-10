<script setup lang="ts">
import { computed } from 'vue'
import { listNavItems, listSidebarPanels } from '@/plugins/registry'
import { branding } from '@/composables/useBranding'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

defineOptions({ name: 'AppSidebar' })

defineProps({
  activePluginPage: { type: String, default: null },
})

const emit = defineEmits(['settings', 'open-plugin-page'])

const pluginNavItems = computed(() => listNavItems())
// 周报插件等通过 ctx.sidebar.registerPanel 提供左侧面板（新建入口 + 周报列表）
const sidebarPanels = computed(() => listSidebarPanels())
</script>

<template>
  <aside class="wr-nav">
    <nav class="nav-rail" aria-label="主导航">
      <div class="rail-brand" :title="branding.name">
        <img v-if="branding.icon" :src="branding.icon" alt="" />
        <span v-else>LA</span>
      </div>

      <div class="rail-items">
        <el-tooltip
          v-for="item in pluginNavItems"
          :key="item.id"
          :content="item.label"
          placement="right"
          :show-after="500"
        >
          <button
            type="button"
            class="rail-item"
            :title="item.label"
            :aria-label="item.label"
            :class="{ active: activePluginPage === item.id }"
            @click="emit('open-plugin-page', item)"
          >
            <component :is="item.iconComponent" v-if="item.iconComponent" />
            <span v-else-if="item.iconSvg" class="rail-custom-icon" v-html="item.iconSvg"></span>
            <el-icon v-else :size="18"><component :is="item.icon || 'Grid'" /></el-icon>
          </button>
        </el-tooltip>
      </div>

      <div class="rail-bottom">
        <ThemeToggle />
        <el-tooltip content="设置与扩展" placement="right" :show-after="500">
          <button type="button" class="rail-item" title="设置" aria-label="设置" @click="emit('settings')">
            <el-icon :size="17"><Setting /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </nav>

    <div v-if="sidebarPanels.length" class="nav-panel plugin-panel">
      <component
        v-for="panel in sidebarPanels"
        :is="panel.component"
        :key="panel.id"
      />
    </div>
  </aside>
</template>

<style scoped>
.wr-nav {
  display: flex;
  height: 100%;
  flex-shrink: 0;
}

.nav-rail {
  width: 52px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0 8px;
  background: var(--wr-sidebar-bg);
  border-right: 1px solid var(--wr-border);
}

.rail-custom-icon {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
}

.rail-custom-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.rail-brand img {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  object-fit: cover;
}

.rail-brand {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-bottom: 10px;
  border-radius: 6px;
  background: var(--el-color-primary);
  color: #fff;
  font-family: var(--wr-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: -0.04em;
  user-select: none;
}

.rail-create {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-bottom: 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 7px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.rail-create:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.rail-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rail-item {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.rail-item:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.rail-item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.rail-item.active::before {
  content: '';
  position: absolute;
  left: -9px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--el-color-primary);
}

.rail-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 8px;
  border-top: 1px solid var(--wr-border);
}

.rail-bottom :deep(.theme-toggle) {
  color: var(--el-text-color-secondary);
}

.rail-bottom :deep(.theme-toggle:hover) {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.nav-panel {
  width: 268px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 10px 8px;
  background: var(--el-bg-color);
  border-right: 1px solid var(--wr-border);
}

.plugin-panel > * {
  flex: 1;
  min-height: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 46px;
  flex: none;
  padding: 0 10px 0 16px;
  border-bottom: 1px solid var(--wr-border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 7px;
}

.panel-title > span:first-child {
  font-size: 13px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.panel-count {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 1px;
}

.panel-actions button {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.panel-actions button:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.panel-search {
  flex: none;
  padding: 6px 10px 8px;
}

.panel-list {
  flex: 1;
  min-height: 0;
}

.panel-list-inner {
  padding: 0 7px 8px;
}

.report-group {
  margin-bottom: 6px;
}

.group-label {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px 5px;
  background: var(--el-bg-color);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--el-text-color-secondary);
}

.group-label span:last-child {
  font-family: var(--wr-mono);
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.report-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 6px 6px 6px 7px;
  margin-bottom: 2px;
  border-left: 2px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.report-row:hover {
  background: var(--el-fill-color-light);
}

.report-row.active {
  background: var(--wr-accent-soft);
  border-left-color: var(--el-color-primary);
}

html.dark .report-row.active {
  background: var(--el-color-primary-light-9);
}

.report-week {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-family: var(--wr-mono);
  font-size: 9px;
  letter-spacing: -0.02em;
}

.report-row.active .report-week {
  background: var(--el-bg-color);
  color: var(--el-color-primary);
}

.report-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.report-title {
  font-size: 12px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-range {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.report-delete {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-placeholder);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.report-row:hover .report-delete,
.report-row.active .report-delete {
  opacity: 1;
}

.report-delete:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.panel-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.panel-hint.muted {
  opacity: 0.6;
}

.panel-more {
  display: block;
  width: 100%;
  padding: 8px;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.panel-more:hover {
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 28px 14px;
  color: var(--el-text-color-secondary);
}

.panel-empty p {
  margin: 0;
  font-size: 11.5px;
}

.panel-empty button {
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  flex: none;
  padding: 0 12px;
  border-top: 1px solid var(--wr-border);
  font-family: var(--wr-mono);
  font-size: 8.5px;
  color: var(--el-text-color-placeholder);
}

.foot-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.foot-state i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--el-color-success);
}
</style>
