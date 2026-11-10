<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWeekReport } from 'plugin-api'

defineOptions({ name: 'TrashView' })

const api = useWeekReport()
const items = ref([])
const trashLoading = ref(false)
let off = null

const isEmpty = computed(() => items.value.length === 0)

function formatDateRange(range) {
  return Array.isArray(range) && range.length === 2 ? range.join(' ~ ') : String(range || '')
}

function formatDateTime(value) {
  const parsed = window.moment?.(value)
  return parsed?.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : String(value || '')
}

function getIsoWeek(value) {
  const parsed = window.moment?.(value)
  return parsed?.isValid() ? parsed.isoWeek() : null
}

function weekOf(report) {
  const start = Array.isArray(report.dateRange) ? report.dateRange[0] : ''
  if (!start) return '—'
  const week = getIsoWeek(start)
  return week ? `W${String(week).padStart(2, '0')}` : '—'
}

async function loadTrash() {
  trashLoading.value = true
  try {
    items.value = await api.reports.trashed({ limit: 200, offset: 0 })
  } catch (error) {
    ElMessage.error(error?.message || '加载回收站失败')
  } finally {
    trashLoading.value = false
  }
}

onMounted(() => {
  loadTrash()
  off = api.events.on('report:changed', loadTrash)
})

onBeforeUnmount(() => off?.())

async function handleRestore(report) {
  try {
    await api.reports.restore(report.id)
    ElMessage.success(`已恢复「${report.title}」`)
    await api.ui.selectReport(report.id)
  } catch (error) {
    ElMessage.error(error?.message || '恢复失败')
  }
}

async function handlePurge(report) {
  try {
    await ElMessageBox.confirm(
      `确定彻底删除「${report.title}」吗？此操作不可恢复。`,
      '彻底删除',
      { confirmButtonText: '彻底删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await api.reports.purge(report.id)
    ElMessage.success('已彻底删除')
    await loadTrash()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

async function handleEmpty() {
  try {
    await ElMessageBox.confirm(
      '清空后所有已删除的周报将被永久移除，此操作不可恢复。确定继续吗？',
      '清空回收站',
      { confirmButtonText: '清空回收站', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const count = await api.reports.emptyTrash()
    ElMessage.success(`已清空回收站，共删除 ${count} 份周报`)
    await loadTrash()
  } catch (error) {
    ElMessage.error(error?.message || '清空失败')
  }
}
</script>

<template>
  <el-scrollbar class="wr-page trash-view">
    <div class="wr-page-inner trash-inner">
      <header class="trash-header">
        <div class="header-main">
          <div class="wr-eyebrow">Trash</div>
          <div class="title-row">
            <h1 class="wr-page-title">回收站</h1>
            <span class="wr-chip">{{ items.length }} 份</span>
          </div>
          <p class="wr-page-subtitle">删除的周报会保留在这里，可随时恢复；彻底删除后不可恢复。</p>
        </div>

        <div class="header-actions">
          <el-button text @click="api.navigation.open('reports')">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回周报</span>
          </el-button>
          <el-button
            type="danger"
            plain
            :disabled="isEmpty"
            @click="handleEmpty"
          >
            <el-icon><Delete /></el-icon>
            <span>清空回收站</span>
          </el-button>
        </div>
      </header>

      <div v-loading="trashLoading" element-loading-text="加载中…" class="trash-body">
        <div v-if="!trashLoading && isEmpty" class="trash-empty-state">
          <span class="empty-icon"><el-icon :size="26"><Delete /></el-icon></span>
          <h3>回收站是空的</h3>
          <p>删除的周报会出现在这里，可以随时恢复。</p>
        </div>

        <div v-else class="trash-list">
          <article v-for="report in items" :key="report.id" class="trash-card">
            <span class="trash-week">{{ weekOf(report) }}</span>

            <div class="row-main">
              <h3 class="row-title">{{ report.title }}</h3>
              <div class="row-meta">
                <span class="meta-item">
                  <el-icon><Calendar /></el-icon>
                  {{ formatDateRange(report.dateRange) }}
                </span>
                <span class="meta-item">
                  <el-icon><Clock /></el-icon>
                  删除于 {{ formatDateTime(report.deleted_at) }}
                </span>
              </div>
            </div>

            <div class="row-actions">
              <el-button type="primary" plain size="small" @click="handleRestore(report)">
                <el-icon><RefreshLeft /></el-icon>
                <span>恢复</span>
              </el-button>
              <el-button type="danger" text size="small" @click="handlePurge(report)">
                <el-icon><Delete /></el-icon>
                <span>彻底删除</span>
              </el-button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped>
.trash-view {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.trash-inner {
  max-width: 1080px;
}

.trash-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.header-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.back-button {
  margin-left: -8px;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
}

.trash-view :deep(.el-button + .el-button) {
  margin-left: 0;
}

.back-button:hover {
  color: var(--el-color-primary);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.trash-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px 6px;
}

.trash-toolbar-title {
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.trash-toolbar-hint {
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.trash-body {
  min-height: 280px;
}

.trash-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  border: 1px dashed var(--el-border-color);
  border-radius: 16px;
  background: var(--el-fill-color-lighter);
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.trash-empty-state h3 {
  margin: 0 0 5px;
  font-size: 15px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.trash-empty-state p {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.trash-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trash-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, var(--el-color-primary-light-9), transparent 40%),
    var(--el-bg-color);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.trash-card:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 12px 26px -20px rgba(15, 23, 42, 0.4);
  transform: translateY(-1px);
}

.trash-week {
  display: grid;
  place-items: center;
  width: 40px;
  height: 36px;
  flex: none;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-family: var(--wr-mono);
  font-size: 11px;
  font-weight: 600;
}

.trash-card:hover .trash-week {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 720px) {
  .trash-header {
    flex-direction: column;
    align-items: stretch;
  }

  .trash-card {
    flex-wrap: wrap;
  }

  .row-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .row-title {
    white-space: normal;
  }
}
</style>
