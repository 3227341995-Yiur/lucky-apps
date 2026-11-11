<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useWeekReport } from '@lucky-apps/plugin-api'
import ImportExportDialog from './io/ImportExportDialog.vue'
import TemplateDesignerDialog from './template/TemplateDesignerDialog.vue'
import ReportStructureDesigner from './designer/ReportStructureDesigner.vue'
import { dialogState } from './dialogs'

defineOptions({ name: 'ReportsOverlays' })

const api = useWeekReport()
let off = null

onMounted(() => {
  // 宿主 ui.openImportExport / openDesigner / openTemplates 通过事件打开原版弹窗
  off = api.events.on('reports:open-dialog', (name) => {
    if (name in dialogState) dialogState[name] = true
  })
})

onBeforeUnmount(() => off?.())
</script>

<template>
  <!-- 三个都是原周报系统的弹窗组件（内部自带统一 AppDialog） -->
  <ImportExportDialog v-model="dialogState.io" />
  <TemplateDesignerDialog v-model="dialogState.template" />
  <ReportStructureDesigner v-model="dialogState.designer" />
</template>
