<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useWeekReport } from 'plugin-api'
import ImportExportPage from './io/ImportExportPage.vue'
import TemplateDesignerPage from './template/TemplateDesignerPage.vue'
import DesignerPage from './designer/DesignerPage.vue'
import { dialogState } from './dialogs'

defineOptions({ name: 'ReportsOverlays' })

const api = useWeekReport()
let off = null

onMounted(() => {
  // 宿主 ui.openImportExport / openDesigner / openTemplates 通过事件打开对应弹窗
  off = api.events.on('reports:open-dialog', (name) => {
    if (name in dialogState) dialogState[name] = true
  })
})

onBeforeUnmount(() => off?.())

function closeDialog(name: 'io' | 'template' | 'designer') {
  dialogState[name] = false
}
</script>

<template>
  <AppDialog
    v-model="dialogState.io"
    title="导入 / 导出"
    subtitle="导出单份或全部周报，也可以备份和恢复完整数据"
    icon="Sort"
    width="880px"
    fill-height
    @close="closeDialog('io')"
  >
    <ImportExportPage embedded />
  </AppDialog>

  <AppDialog
    v-model="dialogState.template"
    title="模板设计器"
    subtitle="Handlebars 模板 · 选择周报实时预览"
    icon="EditPen"
    width="96vw"
    fill-height
    :close-on-press-escape="false"
    @close="closeDialog('template')"
  >
    <TemplateDesignerPage embedded />
  </AppDialog>

  <AppDialog
    v-model="dialogState.designer"
    title="周报画布设计器"
    subtitle="自由画布 · 支持拖拽组件、样式与交互"
    icon="SetUp"
    width="96vw"
    fill-height
    :close-on-press-escape="false"
    @close="closeDialog('designer')"
  >
    <DesignerPage embedded />
  </AppDialog>
</template>
