<script setup lang="ts">
import ImportExportDialog from './io/ImportExportDialog.vue'
import TemplateDesignerDialog from './template/TemplateDesignerDialog.vue'
import ReportStructureDesigner from './designer/ReportStructureDesigner.vue'
import { dialogState } from './dialogs'

defineOptions({ name: 'ReportsOverlays' })
</script>

<template>
  <!-- 三个都是原周报系统的弹窗组件（内部自带统一 AppDialog） -->
  <ImportExportDialog v-model="dialogState.io" />
  <TemplateDesignerDialog v-model="dialogState.template" />
  <ReportStructureDesigner v-model="dialogState.designer" />
</template>
