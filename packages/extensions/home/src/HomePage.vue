<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch , inject } from 'vue'
import { formatDate, formatDateTime, getWeekRange, isDateInRange } from './utils/date'

defineOptions({ name: 'HomePage' })

const ctx = inject('cordis')

const now = new Date()
const weekRange = getWeekRange(now)
const todayLabel = `${formatDate(now)} 星期${['日', '一', '二', '三', '四', '五', '六'][now.getDay()]}`
const hour = now.getHours()
const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

function isoWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7)
}

const weekNumber = isoWeek(now)

const reports = ref([])
const stats = ref({ reports: 0, workItems: 0, trash: 0, templates: 0 })
const weekDetail = ref(null)

const weekReport = computed(() => reports.value.find(report => isDateInRange(now, report.dateRange)) || null)

const weekSections = computed(() => weekDetail.value?.sections || weekReport.value?.sections || [])
const weekItemCount = computed(() =>
  weekSections.value.reduce((total, section) => total + (section.items?.length || 0), 0),
)

const metrics = computed(() => [
  { key: 'reports', label: '周报', value: stats.value.reports },
  { key: 'items', label: '工作项', value: stats.value.workItems },
  { key: 'trash', label: '回收站', value: stats.value.trash },
  { key: 'templates', label: '模板', value: stats.value.templates },
])

const quickActions = [
  { key: 'create', label: '新建周报', hint: '按本周日期开始', icon: 'Plus' },
  { key: 'io', label: '导入 / 备份', hint: '迁移或备份数据', icon: 'Sort' },
  { key: 'designer', label: '画布设计', hint: '自由排版与样式', icon: 'MagicStick' },
  { key: 'settings', label: '设置与扩展', hint: '主题、插件、资源', icon: 'Setting' },
]

async function reload() {
  try {
    const [list, nextStats] = await Promise.all([
      ctx.get('weekReport').reports.list({ limit: 300, offset: 0 }),
      ctx.get('weekReport').reports.stats(),
    ])
    reports.value = list || []
    stats.value = { ...stats.value, ...(nextStats || {}) }
  } catch (error) {
    ctx.get('ui').toast?.(`加载首页失败：${error?.message || error}`, 'error')
  }
}

watch(weekReport, async (report) => {
  weekDetail.value = null
  if (!report) return
  try {
    weekDetail.value = await ctx.get('weekReport').reports.get(report.id)
  } catch {
    weekDetail.value = null
  }
}, { immediate: true })

async function createReport() {
  try {
    const range = getWeekRange(new Date())
    const report = await ctx.get('weekReport').reports.create({
      title: `周报 ${range[0].slice(5)} ~ ${range[1].slice(5)}`,
      dateRange: range,
    })
    await ctx.get('weekReport').ui.selectReport(report.id)
  } catch (error) {
    ctx.get('ui').toast?.(`新建周报失败：${error?.message || error}`, 'error')
  }
}

function openReport(id) {
  ctx.get('weekReport').ui.selectReport(id)
}

function onQuick(action) {
  if (action === 'create') createReport()
  else if (action === 'io') ctx.get('navigation').open('data-io')
  else if (action === 'designer') ctx.get('weekReport').ui.openDesigner()
  else if (action === 'settings') ctx.get('ui').openSettings()
}

function rangeText(dateRange) {
  if (Array.isArray(dateRange) && dateRange.length === 2) return dateRange.join(' ~ ')
  return dateRange || '未设置日期'
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN')
}

const recentReports = computed(() => reports.value.slice(0, 8))

let off = null

onMounted(() => {
  reload()
  off = ctx.on('report:changed', reload)
})

onBeforeUnmount(() => off?.())
</script>

<template>
  <el-scrollbar class="wr-page home-page">
    <div class="wr-page-inner home-inner wr-fade-in">
      <header class="home-head">
        <div class="home-eyebrow">
          <span class="week-index">{{ now.getFullYear() }} · W{{ String(weekNumber).padStart(2, '0') }}</span>
          <span class="eyebrow-rule" />
          <span class="week-date">{{ todayLabel }}</span>
        </div>

        <div class="home-headline">
          <h1>{{ greeting }}<span class="headline-soft">，把这一周写下来。</span></h1>
          <div class="headline-actions">
            <el-button v-if="weekReport" type="primary" @click="openReport(weekReport.id)">
              打开本周周报
            </el-button>
            <el-button v-else type="primary" @click="createReport">新建本周周报</el-button>
            <el-button text @click="ctx.get('weekReport').ui.openDesigner()">
              <el-icon><MagicStick /></el-icon>
              <span>画布设计</span>
            </el-button>
          </div>
        </div>

        <div class="home-meta">
          <span class="meta-range">本周 {{ weekRange[0] }} — {{ weekRange[1] }}</span>
          <span class="meta-dot" />
          <span class="meta-state" :class="{ 'is-ready': weekReport }">
            <i />{{ weekReport ? '周报已创建' : '尚未创建周报' }}
          </span>
          <span class="meta-spacer" />
          <span class="meta-code">{{ formatNumber(stats.reports) }} reports · {{ formatNumber(stats.workItems) }} items</span>
        </div>
      </header>

      <section class="home-grid">
        <article class="week-panel">
          <div class="panel-label">本周周报</div>

          <template v-if="weekReport">
            <h2 class="week-title">{{ weekReport.title }}</h2>
            <div class="week-meta">
              <span>{{ rangeText(weekReport.dateRange) }}</span>
              <span class="meta-sep">/</span>
              <span>更新于 {{ formatDateTime(weekReport.updated_at) }}</span>
            </div>
            <div v-if="weekSections.length" class="week-figures">
              <div><strong>{{ weekSections.length }}</strong><span>区块</span></div>
              <div><strong>{{ weekItemCount }}</strong><span>条目</span></div>
            </div>
            <div v-if="weekSections.length" class="week-section-list">
              <div v-for="section in weekSections" :key="section.type" class="week-section-row">
                <span>{{ section.title }}</span>
                <strong>{{ section.items?.length || 0 }}</strong>
              </div>
            </div>
            <p v-else class="week-note">打开周报查看区块与条目明细。</p>
            <div class="week-actions">
              <el-button type="primary" plain @click="openReport(weekReport.id)">
                继续编辑<el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>

          <div v-else class="week-empty">
            <span class="week-empty-mark"><el-icon :size="20"><DocumentAdd /></el-icon></span>
            <h2>这一周还没有周报</h2>
            <p>创建后会自动带入本周日期与默认画布，随时可以调整排版。</p>
            <el-button type="primary" @click="createReport">创建本周周报</el-button>
          </div>
        </article>

        <aside class="home-side">
          <div class="panel-label">快捷入口</div>
          <div class="quick-list">
            <button
              v-for="action in quickActions"
              :key="action.key"
              type="button"
              class="quick-row"
              @click="onQuick(action.key)"
            >
              <span class="quick-icon">
                <el-icon :size="15"><component :is="action.icon" /></el-icon>
              </span>
              <span class="quick-copy">
                <strong>{{ action.label }}</strong>
                <small>{{ action.hint }}</small>
              </span>
              <el-icon class="quick-arrow" :size="13"><ArrowRight /></el-icon>
            </button>
          </div>

          <div class="side-rule" />

          <div class="panel-label">工作区</div>
          <div class="metric-list">
            <div v-for="metric in metrics" :key="metric.key" class="metric-row">
              <span>{{ metric.label }}</span>
              <strong>{{ formatNumber(metric.value) }}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section class="recent-panel">
        <header class="recent-head">
          <div>
            <div class="panel-label">最近周报</div>
            <p class="recent-sub">按更新时间排序</p>
          </div>
          <span class="recent-count">{{ reports.length }}</span>
        </header>

        <div v-if="recentReports.length === 0" class="recent-empty">
          <span class="recent-empty-mark"><el-icon :size="18"><Document /></el-icon></span>
          <p>还没有历史周报，创建第一份后会显示在这里。</p>
        </div>

        <div v-else class="recent-list">
          <button
            v-for="(report, index) in recentReports"
            :key="report.id"
            type="button"
            class="recent-row"
            @click="openReport(report.id)"
          >
            <span class="recent-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="recent-date">{{ rangeText(report.dateRange) }}</span>
            <span class="recent-title">{{ report.title || '未命名周报' }}</span>
            <span v-if="weekReport && weekReport.id === report.id" class="recent-current">本周</span>
            <span class="recent-updated">{{ formatDateTime(report.updated_at) }}</span>
            <el-icon class="recent-arrow" :size="12"><ArrowRight /></el-icon>
          </button>
        </div>
      </section>

      <footer class="home-foot">
        <span>LUCKY APPS</span>
        <span>LOCAL WORKSPACE · API v2</span>
      </footer>
    </div>
  </el-scrollbar>
</template>

<style scoped>
.home-page {
  background: var(--wr-bg);
  overflow: hidden;
}

.home-inner {
  max-width: 1080px;
}

.home-head {
  margin-bottom: 26px;
}

.home-eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-family: var(--wr-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--el-text-color-secondary);
}

.week-index {
  color: var(--el-color-primary);
  font-weight: 600;
}

.eyebrow-rule {
  width: 28px;
  height: 1px;
  background: var(--el-border-color);
}

.week-date {
  font-family: var(--el-font-family);
  letter-spacing: 0;
}

.home-headline {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.home-headline h1 {
  margin: 0;
  font-size: clamp(28px, 3vw, 38px);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.16;
  color: var(--el-text-color-primary);
}

.headline-soft {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.headline-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding-bottom: 3px;
}

.headline-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.home-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid var(--wr-border);
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.meta-range {
  font-family: var(--wr-mono);
  font-size: 10.5px;
}

.meta-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--el-border-color-dark);
}

.meta-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.meta-state i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--el-color-warning);
}

.meta-state.is-ready i {
  background: var(--el-color-success);
}

.meta-spacer {
  flex: 1;
}

.meta-code {
  font-family: var(--wr-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  color: var(--el-text-color-placeholder);
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 1fr);
  gap: 18px;
  align-items: stretch;
}

.week-panel,
.home-side,
.recent-panel {
  background: var(--wr-surface);
  border: 1px solid var(--wr-border);
  border-radius: var(--wr-radius-lg);
}

.week-panel {
  display: flex;
  flex-direction: column;
  min-height: 264px;
  padding: 20px 22px;
}

.panel-label {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.week-title {
  margin: 16px 0 0;
  font-size: 21px;
  line-height: 1.35;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.week-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.meta-sep {
  color: var(--el-border-color-dark);
}

.week-figures {
  display: flex;
  gap: 28px;
  margin-top: 22px;
  padding-top: 14px;
  border-top: 1px dashed var(--el-border-color);
}

.week-figures > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.week-figures strong {
  font-family: var(--wr-mono);
  font-size: 24px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.week-figures span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.week-section-list {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
}

.week-section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.week-section-row:last-child {
  border-bottom: none;
}

.week-section-row strong {
  font-family: var(--wr-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.week-note {
  margin: 22px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.week-actions {
  margin-top: auto;
  padding-top: 18px;
}

.week-actions :deep(.el-button) {
  gap: 4px;
}

.week-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 7px;
  padding: 16px 0 4px;
}

.week-empty-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.week-empty h2 {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.week-empty p {
  margin: 0 0 8px;
  max-width: 380px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.home-side {
  padding: 20px 18px;
}

.quick-list {
  display: flex;
  flex-direction: column;
  margin-top: 9px;
}

.quick-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.quick-row:hover {
  background: var(--el-fill-color-lighter);
}

.quick-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 5px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.quick-row:hover .quick-icon {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.quick-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.quick-copy strong {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.quick-copy small {
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.quick-arrow {
  color: var(--el-text-color-placeholder);
}

.side-rule {
  height: 1px;
  margin: 13px 0;
  background: var(--el-border-color-lighter);
}

.metric-list {
  display: flex;
  flex-direction: column;
  margin-top: 7px;
}

.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 6px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.metric-row strong {
  font-family: var(--wr-mono);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.recent-panel {
  margin-top: 18px;
  padding: 18px 22px 10px;
}

.recent-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.recent-sub {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.recent-count {
  font-family: var(--wr-mono);
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.recent-list {
  margin-top: 10px;
}

.recent-row {
  display: grid;
  grid-template-columns: 28px 164px minmax(0, 1fr) auto 132px 14px;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 10px 6px;
  border: 0;
  border-top: 1px solid var(--el-border-color-lighter);
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.recent-row:hover {
  background: var(--el-fill-color-lighter);
}

.recent-index {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
}

.recent-date {
  font-family: var(--wr-mono);
  font-size: 10px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-title {
  font-size: 12.5px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-current {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 9.5px;
}

.recent-updated {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
  text-align: right;
}

.recent-arrow {
  color: var(--el-text-color-placeholder);
}

.recent-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 26px 6px 20px;
  color: var(--el-text-color-secondary);
}

.recent-empty-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.recent-empty p {
  margin: 0;
  font-size: 12px;
}

.home-foot {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 22px;
  padding-top: 10px;
  border-top: 1px solid var(--wr-border);
  font-family: var(--wr-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--el-text-color-placeholder);
}

@media (max-width: 920px) {
  .home-headline {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }

  .home-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .recent-row {
    grid-template-columns: 24px 130px minmax(0, 1fr) 14px;
  }

  .recent-updated,
  .recent-current {
    display: none;
  }
}
</style>
