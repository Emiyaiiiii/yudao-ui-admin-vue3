<template>
  <ContentWrap>
    <el-form :inline="true" :model="queryParams" class="search-form">
      <el-form-item label="任务ID">
        <el-input
          v-model="queryParams.taskId"
          placeholder="支持模糊查询"
          clearable
          style="width: 220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="文档ID">
        <el-input
          v-model="queryParams.docId"
          placeholder="文档ID"
          clearable
          style="width: 140px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="queryParams.status"
          placeholder="全部"
          clearable
          style="width: 130px"
        >
          <el-option
            v-for="(item, key) in vectorStatusConfig"
            :key="key"
            :label="item.label"
            :value="Number(key)"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleQuery">
          <Icon icon="ep:search" class="mr-1" />查询
        </el-button>
        <el-button @click="resetQuery">
          <Icon icon="ep:refresh" class="mr-1" />重置
        </el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" size="small" border>
      <el-table-column prop="taskId" label="任务ID" min-width="220" show-overflow-tooltip />
      <el-table-column prop="docId" label="文档ID" width="90" />
      <el-table-column prop="kbId" label="知识库ID" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusMeta(row.status).type" size="small">
            {{ statusMeta(row.status).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" width="80">
        <template #default="{ row }">
          {{ row.status === 2 ? 100 : row.progress || 0 }}%
        </template>
      </el-table-column>
      <el-table-column prop="currentStep" label="当前步骤" min-width="150" show-overflow-tooltip />
      <el-table-column label="尝试" width="80">
        <template #default="{ row }">{{ row.attempt ?? 0 }}/{{ row.maxAttempts ?? 3 }}</template>
      </el-table-column>
      <el-table-column label="失败原因" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.errorMsg" class="error-text">{{ row.errorMsg }}</span>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="入队时间" width="165">
        <template #default="{ row }">
          {{ row.queuedAt ? formatDate(row.queuedAt) : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.taskId)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="queryParams.pageNo"
      v-model:page-size="queryParams.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      class="pagination"
      @current-change="load"
      @size-change="handleSizeChange"
    />

    <el-dialog v-model="detailVisible" title="任务详情" width="920px" destroy-on-close>
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="任务ID">{{ detail.taskId }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusMeta(detail.status).type" size="small">
              {{ statusMeta(detail.status).label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="文档ID">{{ detail.docId }}</el-descriptions-item>
          <el-descriptions-item label="知识库ID">{{ detail.kbId }}</el-descriptions-item>
          <el-descriptions-item label="文件类型">{{ detail.fileType || '—' }}</el-descriptions-item>
          <el-descriptions-item label="尝试次数">
            {{ detail.attempt ?? 0 }}/{{ detail.maxAttempts ?? 3 }}
          </el-descriptions-item>
          <el-descriptions-item label="入队时间">
            {{ detail.queuedAt ? formatDate(detail.queuedAt) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">
            {{ detail.startedAt ? formatDate(detail.startedAt) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="最近心跳">
            {{ detail.heartbeatAt ? formatDate(detail.heartbeatAt) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="分块数">{{ detail.chunkCount ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="文件地址" :span="2">
            <span class="break-all">{{ detail.fileUrl || '—' }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">任务下发参数</el-divider>
        <pre class="code-block">{{ prettyJson(dispatchPayload) }}</pre>

        <el-divider content-position="left">失败原因</el-divider>
        <pre v-if="detail.errorMsg" class="error-block">{{ detail.errorMsg }}</pre>
        <el-empty v-else description="无错误信息" :image-size="40" />

        <el-divider content-position="left">阶段时间线</el-divider>
        <el-table v-if="stages.length" :data="stages" size="small" border>
          <el-table-column prop="stage" label="阶段" width="170" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="耗时" width="90">
            <template #default="{ row }">
              {{ row.duration_s != null ? row.duration_s + 's' : '—' }}
            </template>
          </el-table-column>
          <el-table-column label="指标" min-width="300">
            <template #default="{ row }">
              <pre class="inline-json">{{ prettyJson(row.metrics) }}</pre>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无阶段记录" :image-size="40" />
      </template>
    </el-dialog>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { VectorTaskApi, vectorStatusConfig, type VectorTask } from '@/api/kb/vectorTask'
import { formatDate } from '@/utils/formatTime'

defineOptions({ name: 'KbVectorTask' })

const loading = ref(false)
const list = ref<VectorTask[]>([])
const total = ref(0)

const queryParams = reactive({
  pageNo: 1,
  pageSize: 20,
  taskId: '',
  docId: '',
  status: undefined as number | undefined
})

function statusMeta(status: number) {
  return vectorStatusConfig[status] || { label: `未知(${status})`, type: 'info' as const }
}

async function load() {
  loading.value = true
  try {
    const data = await VectorTaskApi.getTaskPage({
      pageNo: queryParams.pageNo,
      pageSize: queryParams.pageSize,
      taskId: queryParams.taskId || undefined,
      docId: queryParams.docId ? Number(queryParams.docId) : undefined,
      status: queryParams.status === undefined || (queryParams.status as any) === ''
        ? undefined
        : Number(queryParams.status)
    })
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  queryParams.pageNo = 1
  load()
}

function resetQuery() {
  queryParams.taskId = ''
  queryParams.docId = ''
  queryParams.status = undefined
  queryParams.pageNo = 1
  load()
}

function handleSizeChange() {
  queryParams.pageNo = 1
  load()
}

const detailVisible = ref(false)
const detail = ref<VectorTask>()

async function openDetail(taskId: string) {
  detail.value = undefined
  detailVisible.value = true
  detail.value = await VectorTaskApi.getTask(taskId)
}

const parsedParams = computed(() => {
  if (!detail.value?.params) return {}
  try {
    return JSON.parse(detail.value.params)
  } catch {
    return detail.value.params
  }
})

/** 按任务记录还原下发给 Python 的主要参数（tenant/user/title 未落库） */
const dispatchPayload = computed(() => ({
  task_id: detail.value?.taskId,
  doc_id: detail.value?.docId,
  kb_id: detail.value?.kbId,
  file_url: detail.value?.fileUrl,
  file_type: detail.value?.fileType,
  chunking_config: parsedParams.value
}))

const stages = computed<any[]>(() => {
  if (!detail.value?.stages) return []
  try {
    const parsed = JSON.parse(detail.value.stages)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})

function prettyJson(value: any) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

onMounted(load)
</script>

<style scoped>
.search-form {
  margin-bottom: 12px;
}

.pagination {
  margin-top: 12px;
  justify-content: flex-end;
}

.code-block,
.error-block,
.inline-json {
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-block {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.inline-json {
  padding: 4px 6px;
  background: transparent;
  white-space: pre-wrap;
}

.error-text {
  color: var(--el-color-danger);
}

.break-all {
  word-break: break-all;
}

.mr-1 {
  margin-right: 4px;
}
</style>
