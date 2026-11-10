<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWeekReport } from 'plugin-api'
import { SECTION_PRESETS } from '../config/defaultReportConfig.ts'
import { WIDGETS } from '../config/reportLayout.ts'
import { getAllElComponents, getElComponentLabel, getElWidget } from '../utils/elementPlusWidgets.ts'
import ElementPlusGlyph from './ElementPlusGlyph.vue'

defineOptions({ name: 'LayoutPalette' })

const api = useWeekReport()
const emit = defineEmits(['drag-start'])

const elSearch = ref('')
const elWidgets = computed(() => {
  const keyword = elSearch.value.trim().toLowerCase()
  return getAllElComponents()
    .map(name => getElWidget(name))
    .filter((widget) => {
      if (!keyword) return true
      return widget.component.includes(keyword) || widget.label.toLowerCase().includes(keyword)
    })
})

const layoutWidgets = WIDGETS
  .filter(widget => widget.type !== 'section')
  .map(widget => ({ ...widget, kind: 'element' }))

const externalWidgets = computed(() => api.components.listCanvas()
  .filter(item => item.source !== 'builtin')
  .map(item => ({
    kind: 'component',
    type: 'component',
    component: item.name,
    label: item.name,
    description: item.description || '外部组件',
    icon: item.icon || 'fas fa-puzzle-piece',
    iconSvg: item.iconSvg || '',
    w: 240,
    h: 120,
  })))

const tableWidgets = [
  ...SECTION_PRESETS.map(preset => ({
    kind: 'section',
    type: 'section',
    label: preset.title,
    description: `${preset.columns.length} 列${preset.hasExpandColumn ? ' · 含明细' : ''}`,
    icon: preset.icon,
    preset,
    w: 698,
    h: 200,
  })),
  {
    kind: 'section',
    type: 'section',
    label: '空白表格',
    description: '自定义列结构',
    icon: 'fas fa-table',
    preset: null,
    w: 698,
    h: 200,
  },
]

function onPointerDown(event, widget) {
  if (event.button !== 0) return
  event.preventDefault()
  emit('drag-start', { widget, event })
}
</script>

<template>
  <aside class="layout-palette">
    <el-scrollbar class="palette-scroll">
    <div class="palette-inner">
    <section class="palette-group">
      <header class="palette-head">
        <span>布局组件</span>
        <small>拖到画布</small>
      </header>
      <div class="palette-list">
        <button
          v-for="widget in layoutWidgets"
          :key="widget.type"
          type="button"
          title="拖到画布放置"
          class="palette-item"
          @pointerdown="onPointerDown($event, widget)"
        >
          <span class="palette-thumb" :class="`thumb-${widget.type}`" aria-hidden="true">
            <i :class="widget.icon" />
          </span>
          <span class="palette-copy">
            <strong>{{ widget.label }}</strong>
            <small>{{ widget.description }}</small>
          </span>
        </button>
      </div>
    </section>

    <section class="palette-group">
      <header class="palette-head">
        <span>数据表格</span>
        <small>绑定区块数据</small>
      </header>
      <div class="palette-list">
        <button
          v-for="widget in tableWidgets"
          :key="widget.label"
          type="button"
          title="拖到画布放置"
          class="palette-item"
          @pointerdown="onPointerDown($event, widget)"
        >
          <span class="palette-thumb thumb-table" aria-hidden="true">
            <i :class="widget.icon" />
          </span>
          <span class="palette-copy">
            <strong>{{ widget.label }}</strong>
            <small>{{ widget.description }}</small>
          </span>
        </button>
      </div>
    </section>

    <section v-if="externalWidgets.length" class="palette-group">
      <header class="palette-head">
        <span>外部组件</span>
        <small>{{ externalWidgets.length }} 个</small>
      </header>
      <div class="palette-list">
        <button
          v-for="widget in externalWidgets"
          :key="widget.component"
          type="button"
          title="拖到画布放置"
          class="palette-item"
          @pointerdown="onPointerDown($event, widget)"
        >
          <span class="palette-thumb">
            <span v-if="widget.iconSvg" class="palette-svg" v-html="widget.iconSvg" />
            <el-icon v-else-if="widget.icon && !widget.icon.startsWith('fa')" :size="13">
              <component :is="widget.icon" />
            </el-icon>
            <i v-else :class="widget.icon" />
          </span>
          <span class="palette-copy">
            <strong>{{ widget.label }}</strong>
            <small>{{ widget.description }}</small>
          </span>
        </button>
      </div>
    </section>

    <section class="palette-group">
      <header class="palette-head">
        <span>Element Plus</span>
        <small>{{ elWidgets.length }} 个组件</small>
      </header>
      <el-input
        v-model="elSearch"
        size="small"
        clearable
        placeholder="搜索 el 组件…"
        class="palette-search"
      >
        <template #prefix><el-icon :size="11"><Search /></el-icon></template>
      </el-input>
      <div class="el-widget-list">
        <button
          v-for="widget in elWidgets"
          :key="widget.component"
          type="button"
          title="拖到画布放置"
          class="palette-item is-el"
          @pointerdown="onPointerDown($event, widget)"
        >
          <span class="palette-thumb thumb-el" aria-hidden="true">
            <ElementPlusGlyph :name="widget.component" />
          </span>
          <span class="palette-copy">
            <strong>{{ getElComponentLabel(widget.component) }}</strong>
            <small>{{ widget.component }}</small>
          </span>
        </button>
      </div>
    </section>

    <p class="palette-tip">
      拖到画布后跟随鼠标显示落点预览；放下即可移动、缩放和改样式。
    </p>
    </div>
    </el-scrollbar>
  </aside>
</template>

<style scoped>
.layout-palette {
  width: 226px;
  flex: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--wr-border);
  background: var(--el-bg-color);
}

.palette-scroll {
  flex: 1;
  min-height: 0;
}

.palette-inner {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 14px 12px 22px;
}

.palette-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.palette-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 2px;
}

.palette-head span {
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.palette-head small {
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
}

.palette-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.palette-item:hover {
  background: var(--el-fill-color-lighter);
  border-color: var(--el-border-color-lighter);
}

.palette-item:active {
  cursor: grabbing;
}

.palette-thumb {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 5px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.palette-item:hover .palette-thumb {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.palette-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.palette-copy strong {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-copy small {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-search {
  margin-bottom: 4px;
}

.el-widget-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-right: 2px;
}

.palette-item.is-el .palette-thumb {
  font-size: 11px;
}

.palette-svg {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
}

.palette-svg :deep(svg) {
  width: 15px;
  height: 15px;
  display: block;
}

.palette-tip {
  margin: auto 2px 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 10.5px;
  line-height: 1.65;
  color: var(--el-text-color-placeholder);
}
</style>
