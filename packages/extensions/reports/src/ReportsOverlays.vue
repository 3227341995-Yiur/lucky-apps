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
</script>

<template>
  <el-dialog
    v-model="dialogState.io"
    class="reports-dialog"
    title="导入导出"
    width="min(980px, 94vw)"
    append-to-body
    align-center
    destroy-on-close
  >
    <ImportExportPage embedded />
  </el-dialog>

  <el-dialog
    v-model="dialogState.template"
    class="reports-dialog is-wide"
    title="模板设计"
    width="min(1320px, 96vw)"
    append-to-body
    align-center
    destroy-on-close
  >
    <TemplateDesignerPage embedded />
  </el-dialog>

  <el-dialog
    v-model="dialogState.designer"
    class="reports-dialog is-wide"
    title="周报设计"
    width="min(1420px, 97vw)"
    append-to-body
    align-center
    destroy-on-close
  >
    <DesignerPage embedded />
  </el-dialog>
</template>

<style>
.reports-dialog .el-dialog__body {
  height: 74vh;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.reports-dialog.is-wide .el-dialog__body {
  height: 82vh;
}
</style>
