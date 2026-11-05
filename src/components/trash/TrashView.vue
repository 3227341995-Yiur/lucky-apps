<script setup>
import { computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useReports } from '@/composables/useReports'
import { formatDateRange } from '@/utils/reportExport'
import { formatDateTime } from '@/utils/date'

defineOptions({ name: 'TrashView' })

const emit = defineEmits(['back'])

const reports = useReports()
const { state } = reports

const isEmpty = computed(() => state.trash.length === 0)

onMounted(() => {
  reports.loadTrash().catch(error => {
    ElMessage.error(error?.message || '加载回收站失败')
  })
})

// 恢复：store 会自动刷新列表、切回周报视图并打开该周报
async function handleRestore(report) {
  try {
    await reports.restoreReport(report.id)
    ElMessage.success(`已恢复「${report.title}」`)
  } catch (error) {
    ElMessage.error(error?.message || '恢复失败')
  }
}

async function handlePurge(report) {
  try {
    await ElMessageBox.confirm(
      `确定彻底删除「${report.title}」吗？此操作不可恢复。`,
      '彻底删除',
      { confirmButtonText: '彻底删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await reports.purgeReport(report.id)
    ElMessage.success('已彻底删除')
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

async function handleEmpty() {
  try {
    await ElMessageBox.confirm(
      '清空后所有已删除的周报将被永久移除，此操作不可恢复。确定继续吗？',
      '清空回收站',
      { confirmButtonText: '清空回收站', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    const count = await reports.emptyTrash()
    ElMessage.success(`已清空回收站，共删除 ${count} 份周报`)
  } catch (error) {
    ElMessage.error(error?.message || '清空失败')
  }
}
</script>

<template>
  <el-scrollbar class="wr-page trash-view">
    <div class="wr-page-inner">
      <header class="wr-page-header">
        <div class="header-main">
          <el-button class="back-button" text @click="emit('back')">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回周报</span>
          </el-button>
          <div class="wr-eyebrow">Trash</div>
          <div class="title-row">
            <h1 class="wr-page-title">回收站</h1>
            <span class="wr-chip">{{ state.trash.length }} 份</span>
          </div>
          <p class="wr-page-subtitle">已删除的周报会保留在这里，可随时恢复或彻底删除。</p>
        </div>

        <div class="header-actions">
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

      <div v-loading="state.trashLoading" element-loading-text="加载中…" class="trash-body wr-card">
        <el-empty
          v-if="!state.trashLoading && isEmpty"
          description="回收站是空的"
          class="trash-empty"
        >
          <p class="empty-tip">删除的周报会出现在这里，可以随时恢复。</p>
          <el-button type="primary" @click="emit('back')">返回周报</el-button>
        </el-empty>

        <div v-else class="trash-list">
          <article v-for="report in state.trash" :key="report.id" class="trash-row">
            <div class="row-icon">
              <el-icon :size="18"><Document /></el-icon>
            </div>

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

.header-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.back-button {
  margin-left: -8px;
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
}

.back-button:hover {
  color: var(--el-color-primary);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.trash-body {
  min-height: 280px;
  padding: 6px 0;
  overflow: hidden;
}

.trash-empty {
  padding: 48px 24px;
}

.empty-tip {
  margin: -6px 0 18px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.trash-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background-color 0.15s ease;
}

.trash-row:last-child {
  border-bottom: none;
}

.trash-row:hover {
  background: var(--el-fill-color-lighter);
}

.row-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--wr-radius-md);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  margin: 0;
  font-size: 15px;
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
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 12px;
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
  gap: 6px;
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .wr-page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .trash-row {
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
