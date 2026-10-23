<template>
  <ContentWrap>
    <div class="monitor-header">
      <div class="title-wrap">
        <Icon icon="ep:monitor" :size="20" />
        <span class="title">处理监控</span>
        <el-tag v-if="data" size="small" :type="data.workerCount > 0 ? 'success' : 'danger'">
          {{ data.workerCount }} 个 Worker 在线
        </el-tag>
      </div>
      <div class="actions">
        <span class="refresh-hint">每 5 秒自动刷新</span>
        <el-button :loading="loading" @click="load">
          <Icon icon="ep:refresh" class="mr-1" />刷新
        </el-button>
      </div>
    </div>

    <el-alert
      v-for="alert in data?.alerts || []"
      :key="alert.code"
      :title="alert.message"
      :type="alert.level === 'CRITICAL' ? 'error' : alert.level === 'WARN' ? 'warning' : 'info'"
      :closable="false"
      show-icon
      class="mb-2"
    />

    <el-row :gutter="16" class="mb-4">
      <el-col v-for="card in cards" :key="card.label" :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-sub">{{ card.sub }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="card-header">
          <span>Worker 实例</span>
          <span class="subtle">注册表：kb:worker:registry</span>
        </div>
      </template>
      <el-table v-loading="loading" :data="data?.workers || []" size="small">
        <el-table-column prop="workerId" label="Worker ID" min-width="180" show-overflow-tooltip />
        <el-table-column label="地址" min-width="170">
          <template #default="{ row }">{{ row.host }}:{{ row.port }}</template>
        </el-table-column>
        <el-table-column label="来源" width="90">
          <template #default="{ row }">
            <el-tag
              v-if="row.source"
              size="small"
              :type="row.source === 'HTTP' ? 'success' : 'warning'"
            >
              {{ row.source }}
            </el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="执行中 / 并发" width="160">
          <template #header>
            <el-tooltip content="当前执行中任务数 / Worker 并发上限；百分比为负载率" placement="top">
              <span class="load-header">执行中 / 并发</span>
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <div class="load-cell">
              <span class="load-text">{{ row.inflight ?? 0 }} / {{ row.concurrency ?? '—' }}</span>
              <el-tag
                v-if="row.concurrency"
                size="small"
                :type="loadTagType(row.inflight, row.concurrency)"
              >
                {{ percent(row.inflight, row.concurrency) }}%
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="完成/失败" width="130">
          <template #default="{ row }">
            <span class="ok-text">{{ row.completed || 0 }}</span>
            /
            <span class="err-text">{{ row.failed || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平均耗时" width="110">
          <template #default="{ row }">{{ formatSeconds(row.avgTaskSeconds) }}</template>
        </el-table-column>
        <el-table-column label="Embedding" width="120">
          <template #default="{ row }">
            {{ row.embeddingRequests || 0 }} /
            <span class="err-text">{{ row.embeddingErrors || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近心跳" width="170">
          <template #default="{ row }">
            {{ row.lastHeartbeat ? formatDate(row.lastHeartbeat) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.error || '—' }}</template>
        </el-table-column>
      </el-table>
      <el-empty
        v-if="!loading && (data?.workers?.length || 0) === 0"
        description="暂无 Worker 注册，请确认 python-vector 已启动"
        :image-size="60"
      />
    </el-card>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>队列</template>
          <div class="metric-row">
            <span>队列名</span>
            <b>{{ data?.queue?.name || '—' }}</b>
          </div>
          <div class="metric-row">
            <span>积压消息</span>
            <b :class="{ 'err-text': (data?.queue?.depth || 0) > 0 }">
              {{ data?.queue?.depth ?? '—' }}
            </b>
          </div>
          <div class="metric-row">
            <span>消费者</span>
            <b>{{ data?.queue?.consumers ?? '—' }}</b>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>任务状态</template>
          <div class="status-tags">
            <el-tag type="info">排队中 {{ data?.tasks?.pending ?? 0 }}</el-tag>
            <el-tag type="primary">处理中 {{ data?.tasks?.processing ?? 0 }}</el-tag>
            <el-tag type="success">完成 {{ data?.tasks?.completed ?? 0 }}</el-tag>
            <el-tag type="danger">失败 {{ data?.tasks?.failed ?? 0 }}</el-tag>
            <el-tag type="warning">超时 {{ data?.tasks?.timeout ?? 0 }}</el-tag>
          </div>
          <div class="metric-row mt-3">
            <span>近 24h 平均耗时</span>
            <b>{{ formatSeconds(data?.tasks?.avgDurationSeconds) }}</b>
          </div>
          <div class="metric-row">
            <span>近 24h 超时率</span>
            <b>{{ (data?.tasks?.timeoutRate24h ?? 0).toFixed(1) }}%</b>
          </div>
          <div class="metric-row">
            <span>最早排队等待</span>
            <b>{{ data?.tasks?.oldestPendingMinutes ?? 0 }} 分钟</b>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { MonitorApi, type MonitorOverview } from '@/api/kb/monitor'
import { formatDate } from '@/utils/formatTime'

defineOptions({ name: 'KbMonitor' })

const loading = ref(false)
const data = ref<MonitorOverview>()
let timer: ReturnType<typeof setInterval> | undefined

const cards = computed(() => [
  {
    label: '在线 Worker',
    value: data.value?.onlineWorkerCount ?? 0,
    sub: `共 ${data.value?.workerCount ?? 0} 个实例`
  },
  {
    label: '队列积压',
    value: data.value?.queue?.depth ?? 0,
    sub: data.value?.queue?.name || 'kb.ingest.tasks'
  },
  {
    label: '处理中',
    value: data.value?.tasks?.processing ?? 0,
    sub: `排队中 ${data.value?.tasks?.pending ?? 0}`
  },
  {
    label: '失败任务',
    value: data.value?.tasks?.failed ?? 0,
    sub: `超时 ${data.value?.tasks?.timeout ?? 0} / 提交失败 ${data.value?.tasks?.submitFailed ?? 0}`
  }
])

async function load() {
  loading.value = true
  try {
    data.value = await MonitorApi.getOverview()
  } finally {
    loading.value = false
  }
}

function percent(current?: number, total?: number) {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round(((current || 0) / total) * 100))
}

/** 负载率标签：<60% 正常，60~85% 偏高，>=85% 接近打满 */
function loadTagType(current?: number, total?: number): 'success' | 'warning' | 'danger' {
  const usage = percent(current, total)
  if (usage >= 85) return 'danger'
  if (usage >= 60) return 'warning'
  return 'success'
}

function formatSeconds(seconds?: number) {
  if (!seconds || seconds <= 0) return '0s'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m${rest}s`
}

onMounted(() => {
  load()
  timer = setInterval(load, 5000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.refresh-hint {
  margin-right: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-card {
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin: 6px 0;
  font-size: 24px;
  font-weight: 700;
}

.stat-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.load-header {
  cursor: help;
}

.load-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.load-text {
  font-variant-numeric: tabular-nums;
}

.subtle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.metric-row:last-child {
  border-bottom: none;
}

.status-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ok-text {
  color: var(--el-color-success);
}

.err-text {
  color: var(--el-color-danger);
}

.mb-2 {
  margin-bottom: 8px;
}

.mb-4 {
  margin-bottom: 16px;
}

.mt-3 {
  margin-top: 12px;
}

.mr-1 {
  margin-right: 4px;
}
</style>
