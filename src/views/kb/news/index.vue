<template>
  <div class="news-page">
    <!-- 统计卡片 -->
    <div class="stats-bar">
      <div v-for="stat in statCards" :key="stat.key" class="stat-item">
        <div class="stat-icon" :style="{ background: stat.bg }">
          <Icon :icon="stat.icon" :size="22" :color="stat.color" />
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats[stat.key] ?? 0 }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <!-- 标签页 -->
    <ContentWrap>
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- ========== 新闻记录 ========== -->
        <el-tab-pane label="新闻记录" name="records">
          <div class="filter-bar">
            <el-row :gutter="12" align="middle">
              <el-col :span="6">
                <el-input v-model="recordFilters.search" placeholder="搜索标题/内容/ID" clearable
                  @keyup.enter="loadRecords" @clear="loadRecords">
                  <template #prefix><Icon icon="ep:search" /></template>
                </el-input>
              </el-col>
              <el-col :span="4">
                <el-select v-model="recordFilters.sourceId" placeholder="全部数据源" clearable @change="loadRecords">
                  <el-option v-for="s in sourceOptions" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
              </el-col>
              <el-col :span="4">
                <el-select v-model="recordFilters.status" placeholder="全部状态" clearable @change="loadRecords">
                  <el-option v-for="opt in NEWS_STATUS_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-col>
              <el-col :span="4">
                <el-select v-model="recordFilters.externalChannel" placeholder="全部频道" clearable filterable @change="loadRecords">
                  <el-option v-for="ch in channelOptions" :key="ch" :label="ch" :value="ch" />
                </el-select>
              </el-col>
              <el-col :span="6" class="text-right">
                <el-button @click="loadRecords"><Icon icon="ep:refresh" /> 刷新</el-button>
                <el-button type="warning" :disabled="selectedIds.length === 0" @click="handleBatchRetry">
                  重试
                </el-button>
                <el-button type="danger" :disabled="selectedIds.length === 0" @click="handleBatchDelete">
                  删除
                </el-button>
              </el-col>
            </el-row>
          </div>

          <el-table :data="records" v-loading="recordLoading" border stripe
            @selection-change="handleSelectionChange" style="width: 100%">
            <el-table-column type="selection" width="45" />
            <el-table-column label="标题" min-width="250" show-overflow-tooltip>
              <template #default="{ row }">
                <el-link type="primary" @click="openRecordDetail(row)">{{ row.externalTitle || '-' }}</el-link>
              </template>
            </el-table-column>
            <el-table-column prop="sourceName" label="数据源" width="120" show-overflow-tooltip />
            <el-table-column prop="externalChannel" label="频道" width="100" show-overflow-tooltip />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)" size="small">{{ row.statusDisplay }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="externalTime" label="发布时间" width="160" show-overflow-tooltip />
            <el-table-column prop="externalCrdept" label="部门" width="120" show-overflow-tooltip />
            <el-table-column prop="retryCount" label="重试" width="55" align="center" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" size="small" @click="openRecordDetail(row)">详情</el-button>
                <el-button text type="warning" size="small" @click="handleParse(row)">解析</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无新闻记录" />
            </template>
          </el-table>

          <div class="pagination-wrapper">
            <el-pagination v-model:current-page="recordPagination.pageNo"
              v-model:page-size="recordPagination.pageSize"
              :total="recordPagination.total" :page-sizes="[20, 50, 100, 200]"
              layout="total, sizes, prev, pager, next"
              @size-change="loadRecords" @current-change="loadRecords" />
          </div>
        </el-tab-pane>

        <!-- ========== 数据源管理 ========== -->
        <el-tab-pane label="数据源" name="sources">
          <div class="filter-bar">
            <el-row :gutter="12" align="middle">
              <el-col :span="6">
                <el-input v-model="sourceFilters.search" placeholder="搜索名称/主机/库名" clearable
                  @keyup.enter="loadSources" @clear="loadSources">
                  <template #prefix><Icon icon="ep:search" /></template>
                </el-input>
              </el-col>
              <el-col :span="4">
                <el-select v-model="sourceFilters.syncEnabled" placeholder="全部状态" clearable @change="loadSources">
                  <el-option label="启用" :value="1" />
                  <el-option label="禁用" :value="0" />
                </el-select>
              </el-col>
              <el-col :span="14" class="text-right">
                <el-button @click="loadSources"><Icon icon="ep:refresh" /> 刷新</el-button>
                <el-button type="primary" @click="openSourceDialog()"><Icon icon="ep:plus" /> 新建数据源</el-button>
              </el-col>
            </el-row>
          </div>

          <el-table :data="sources" v-loading="sourceLoading" border stripe>
            <el-table-column prop="name" label="数据源名称" min-width="140" show-overflow-tooltip />
            <el-table-column label="数据库" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.dbHost }}:{{ row.dbPort }}/{{ row.dbName }}
              </template>
            </el-table-column>
            <el-table-column prop="tableName" label="表名" width="120" show-overflow-tooltip />
            <el-table-column label="同步" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.syncEnabled ? 'success' : 'info'" size="small">
                  {{ row.syncEnabled ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="deptName" label="所属部门" width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ row.deptName || '—' }}</template>
            </el-table-column>
            <el-table-column label="记录统计" width="160">
              <template #default="{ row }">
                <span class="stat-mini">
                  共 {{ row.recordsCount ?? 0 }} 条
                  <span class="stat-sep">|</span>
                  <span class="text-warning">待 {{ row.pendingCount ?? 0 }}</span>
                  <span class="stat-sep">|</span>
                  <span class="text-success">成 {{ row.completedCount ?? 0 }}</span>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="最后同步" width="160">
              <template #default="{ row }">
                {{ row.lastSyncTime ? formatDate(row.lastSyncTime) : '—' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" size="small" @click="openSourceDialog(row)">编辑</el-button>
                <el-button text type="success" size="small" @click="handleTriggerSync(row)">同步</el-button>
                <el-button text type="info" size="small" @click="openSourceStatsDialog(row)">统计</el-button>
                <el-button text type="danger" size="small" @click="handleDeleteSource(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据源" />
            </template>
          </el-table>

          <div class="pagination-wrapper">
            <el-pagination v-model:current-page="sourcePagination.pageNo"
              v-model:page-size="sourcePagination.pageSize"
              :total="sourcePagination.total" :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @size-change="loadSources" @current-change="loadSources" />
          </div>
        </el-tab-pane>

        <!-- ========== 同步日志 ========== -->
        <el-tab-pane label="同步日志" name="logs">
          <div class="filter-bar">
            <el-row :gutter="12" align="middle">
              <el-col :span="5">
                <el-select v-model="logFilters.sourceId" placeholder="全部数据源" clearable @change="loadLogs">
                  <el-option v-for="s in sourceOptions" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
              </el-col>
              <el-col :span="4">
                <el-select v-model="logFilters.syncType" placeholder="同步类型" clearable @change="loadLogs">
                  <el-option v-for="opt in SYNC_TYPE_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-col>
              <el-col :span="4">
                <el-select v-model="logFilters.status" placeholder="状态" clearable @change="loadLogs">
                  <el-option v-for="opt in SYNC_STATUS_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-col>
              <el-col :span="11" class="text-right">
                <el-button @click="loadLogs"><Icon icon="ep:refresh" /> 刷新</el-button>
              </el-col>
            </el-row>
          </div>

          <el-table :data="logs" v-loading="logLoading" border stripe>
            <el-table-column prop="sourceName" label="数据源" width="140" show-overflow-tooltip />
            <el-table-column label="同步类型" width="100">
              <template #default="{ row }">{{ row.syncTypeDisplay }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="getSyncStatusTagType(row.status)" size="small">{{ row.statusDisplay }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="获取/新/更/跳/败" min-width="200">
              <template #default="{ row }">
                <span class="stat-mini">
                  获取 {{ row.totalFetched }}
                  <span class="stat-sep">|</span>
                  <span class="text-success">新 {{ row.newRecords }}</span>
                  <span class="stat-sep">|</span>
                  <span class="text-warning">更 {{ row.updatedRecords }}</span>
                  <span class="stat-sep">|</span>
                  <span>跳 {{ row.skippedRecords }}</span>
                  <span class="stat-sep">|</span>
                  <span class="text-danger">败 {{ row.failedRecords }}</span>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="开始时间" width="150">
              <template #default="{ row }">{{ row.startedAt ? formatDate(row.startedAt) : '—' }}</template>
            </el-table-column>
            <el-table-column label="完成时间" width="150">
              <template #default="{ row }">{{ row.completedAt ? formatDate(row.completedAt) : '—' }}</template>
            </el-table-column>
            <el-table-column prop="errorMessage" label="错误信息" min-width="180" show-overflow-tooltip />
            <template #empty>
              <el-empty description="暂无同步日志" />
            </template>
          </el-table>

          <div class="pagination-wrapper">
            <el-pagination v-model:current-page="logPagination.pageNo"
              v-model:page-size="logPagination.pageSize"
              :total="logPagination.total" :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @size-change="loadLogs" @current-change="loadLogs" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </ContentWrap>

    <!-- ========== 记录详情弹窗 ========== -->
    <el-dialog v-model="recordDetailVisible" title="新闻记录详情" width="800px" destroy-on-close>
      <el-descriptions v-if="currentRecord" :column="2" border>
        <el-descriptions-item label="标题" :span="2">{{ currentRecord.externalTitle }}</el-descriptions-item>
        <el-descriptions-item label="外部ID">{{ currentRecord.externalId }}</el-descriptions-item>
        <el-descriptions-item label="数据源">{{ currentRecord.sourceName }}</el-descriptions-item>
        <el-descriptions-item label="频道">{{ currentRecord.externalChannel || '—' }}</el-descriptions-item>
        <el-descriptions-item label="发布时间">{{ currentRecord.externalTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTagType(currentRecord.status)" size="small">{{ currentRecord.statusDisplay }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建部门">{{ currentRecord.externalCrdept || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建用户">{{ currentRecord.externalCruser || '—' }}</el-descriptions-item>
        <el-descriptions-item label="重试次数">{{ currentRecord.retryCount }}</el-descriptions-item>
        <el-descriptions-item label="原始URL" :span="2">
          <el-link v-if="currentRecord.externalUrl" :href="currentRecord.externalUrl" target="_blank" type="primary">
            {{ currentRecord.externalUrl }}
          </el-link>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="currentRecord.errorMessage" label="错误信息" :span="2">
          <span class="text-danger">{{ currentRecord.errorMessage }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="内容" :span="2">
          <div class="record-content">{{ currentRecord.externalContent || '（无内容）' }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- ========== 数据源编辑弹窗 ========== -->
    <el-dialog v-model="sourceDialogVisible"
      :title="sourceDialogMode === 'create' ? '新建数据源' : '编辑数据源'"
      width="700px" destroy-on-close>
      <el-form ref="sourceFormRef" :model="sourceFormData" :rules="sourceFormRules" label-width="110px">
        <el-divider content-position="left">基本信息</el-divider>
        <el-form-item label="数据源名称" prop="name">
          <el-input v-model="sourceFormData.name" placeholder="请输入数据源名称" />
        </el-form-item>
        <el-form-item label="启用同步" prop="syncEnabled">
          <el-switch v-model="sourceFormData.syncEnabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="所属部门" prop="dbDept">
          <el-tree-select
            v-model="sourceFormData.dbDept"
            :data="deptTree"
            :props="{ label: 'name', value: 'id' }"
            check-strictly
            default-expand-all
            clearable
            placeholder="请选择所属部门"
            style="width: 100%"
          />
        </el-form-item>
        <el-divider content-position="left">数据库配置</el-divider>
        <el-row :gutter="12">
          <el-col :span="14">
            <el-form-item label="数据库主机" prop="dbHost">
              <el-input v-model="sourceFormData.dbHost" placeholder="如 192.168.1.100" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="端口" prop="dbPort">
              <el-input-number v-model="sourceFormData.dbPort" :min="1" :max="65535" controls-position="right" class="w-full" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="数据库名" prop="dbName">
              <el-input v-model="sourceFormData.dbName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="表名" prop="tableName">
              <el-input v-model="sourceFormData.tableName" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="用户名" prop="dbUser">
              <el-input v-model="sourceFormData.dbUser" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="密码" prop="dbPassword">
              <el-input v-model="sourceFormData.dbPassword" type="password" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">字段映射</el-divider>
        <el-alert title="将外部表的列名映射到新闻记录字段。ID、标题、内容为必填。" type="info" :closable="false" style="margin-bottom: 12px" />
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="ID字段" prop="idField">
              <el-input v-model="sourceFormData.idField" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="标题字段" prop="titleField">
              <el-input v-model="sourceFormData.titleField" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="内容字段" prop="contentField">
              <el-input v-model="sourceFormData.contentField" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="频道字段">
              <el-input v-model="sourceFormData.channelField" placeholder="如 docchannel" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="时间字段">
              <el-input v-model="sourceFormData.timeField" placeholder="如 doctime" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="URL字段">
              <el-input v-model="sourceFormData.urlField" placeholder="如 docurl" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="部门字段">
              <el-input v-model="sourceFormData.crdeptField" placeholder="如 crdept" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="用户字段">
              <el-input v-model="sourceFormData.cruserField" placeholder="如 cruser" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="sourceDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="sourceSubmitting" @click="submitSourceForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- ========== 数据源统计弹窗 ========== -->
    <el-dialog v-model="sourceStatsVisible" title="数据源统计" width="600px" destroy-on-close>
      <div v-loading="sourceStatsLoading">
        <el-descriptions v-if="currentSourceStats" :column="3" border>
          <el-descriptions-item label="数据源">{{ currentSourceStatsSourceName }}</el-descriptions-item>
          <el-descriptions-item label="总记录数">{{ currentSourceStats.total ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="已完成">
            <span class="text-success">{{ currentSourceStats.completed ?? 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="待处理">
            <span class="text-warning">{{ currentSourceStats.pending ?? 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="失败">
            <span class="text-danger">{{ currentSourceStats.failed ?? 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="已跳过">{{ currentSourceStats.skipped ?? 0 }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">最近同步日志</el-divider>
        <el-table :data="sourceSyncLogs" size="small" border max-height="300">
          <el-table-column label="类型" width="80">
            <template #default="{ row }">{{ row.syncTypeDisplay }}</template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="getSyncStatusTagType(row.status)" size="small">{{ row.statusDisplay }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="统计" min-width="160">
            <template #default="{ row }">
              获取{{ row.totalFetched }} / 新{{ row.newRecords }} / 败{{ row.failedRecords }}
            </template>
          </el-table-column>
          <el-table-column label="开始时间" width="140">
            <template #default="{ row }">{{ row.startedAt ? formatDate(row.startedAt) : '—' }}</template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无同步日志" :image-size="60" />
          </template>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ContentWrap } from '@/components/ContentWrap'
import dayjs from 'dayjs'
import { handleTree } from '@/utils/tree'
import {
  NewsSourceApi, NewsRecordApi, NewsSyncLogApi,
  NEWS_STATUS_OPTIONS, SYNC_TYPE_OPTIONS, SYNC_STATUS_OPTIONS,
  type NewsSource, type NewsRecord, type NewsSyncLog, type NewsStats,
  type NewsSourcePageReq, type NewsRecordPageReq, type NewsSyncLogPageReq,
} from '@/api/kb/news'
import { getSimpleDeptList } from '@/api/system/dept'

// ========== 统计 ==========
const stats = ref<Partial<NewsStats>>({})
const statCards = [
  { key: 'total', label: '总记录', icon: 'ep:document', color: '#409eff', bg: '#ecf5ff' },
  { key: 'completed', label: '已完成', icon: 'ep:check', color: '#67c23a', bg: '#f0f9eb' },
  { key: 'pending', label: '待处理', icon: 'ep:timer', color: '#e6a23c', bg: '#fdf6ec' },
  { key: 'failed', label: '失败', icon: 'ep:warning', color: '#f56c6c', bg: '#fef0f0' },
]

async function loadStats() {
  try {
    const res = await NewsRecordApi.getStats()
    if (res) stats.value = res
  } catch { /* 错误由拦截器统一处理 */ }
}

// ========== Tab ==========
const activeTab = ref('records')
function handleTabChange(tab: string) {
  if (tab === 'records') loadRecords()
  else if (tab === 'sources') loadSources()
  else if (tab === 'logs') loadLogs()
}

// ========== 新闻记录 ==========
const records = ref<NewsRecord[]>([])
const recordLoading = ref(false)
const recordPagination = reactive({ pageNo: 1, pageSize: 20, total: 0 })
const recordFilters = reactive<NewsRecordPageReq & { search?: string; externalChannel?: string }>({
  pageNo: 1, pageSize: 20, search: '', sourceId: undefined, status: '', externalChannel: '',
})
const selectedIds = ref<number[]>([])
const channelOptions = ref<string[]>([])
const sourceOptions = ref<NewsSource[]>([])

async function loadRecords() {
  recordLoading.value = true
  try {
    recordFilters.pageNo = recordPagination.pageNo
    recordFilters.pageSize = recordPagination.pageSize
    const res = await NewsRecordApi.getPage(recordFilters as NewsRecordPageReq)
    records.value = res?.list || []
    recordPagination.total = res?.total || 0
  } catch { /* 错误由拦截器统一提示 */ }
  finally { recordLoading.value = false }
}

function handleSelectionChange(rows: NewsRecord[]) {
  selectedIds.value = rows.map(r => r.id)
}

async function handleBatchRetry() {
  try {
    await ElMessageBox.confirm(`确定重试选中的 ${selectedIds.value.length} 条记录吗？`, '重试确认', { type: 'warning' })
    await NewsRecordApi.batchRetry(selectedIds.value)
    ElMessage.success('重试成功')
    await loadRecords()
    await loadStats()
  } catch (e) { if (e !== 'cancel') console.error(e) }
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条记录吗？此操作不可恢复！`, '删除确认', { type: 'error' })
    await NewsRecordApi.batchDelete(selectedIds.value)
    ElMessage.success('删除成功')
    await loadRecords()
    await loadStats()
  } catch (e) { if (e !== 'cancel') console.error(e) }
}

async function handleParse(row: NewsRecord) {
  try {
    const res = await NewsRecordApi.parse(row.id)
    ElMessage.success(res?.message || '解析任务已提交')
    await loadRecords()
  } catch (e: any) {
    ElMessage.error(e?.message || '解析失败')
  }
}

// 记录详情
const recordDetailVisible = ref(false)
const currentRecord = ref<NewsRecord | null>(null)
async function openRecordDetail(row: NewsRecord) {
  try {
    const res = await NewsRecordApi.get(row.id)
    if (res) {
      currentRecord.value = res
      recordDetailVisible.value = true
    }
  } catch { ElMessage.error('加载详情失败') }
}

// ========== 数据源 ==========
const sources = ref<NewsSource[]>([])
const sourceLoading = ref(false)
const sourcePagination = reactive({ pageNo: 1, pageSize: 20, total: 0 })
const sourceFilters = reactive<NewsSourcePageReq & { search?: string }>({
  pageNo: 1, pageSize: 20, search: '', syncEnabled: undefined,
})
const deptTree = ref<any[]>([])

async function loadDeptTree() {
  try {
    const deptData = await getSimpleDeptList()
    deptTree.value = handleTree(deptData)
  } catch { /* noop */ }
}

async function loadSources() {
  sourceLoading.value = true
  try {
    sourceFilters.pageNo = sourcePagination.pageNo
    sourceFilters.pageSize = sourcePagination.pageSize
    const res = await NewsSourceApi.getPage(sourceFilters as NewsSourcePageReq)
    sources.value = res?.list || []
    sourcePagination.total = res?.total || 0
    // 同步更新下拉选项
    sourceOptions.value = sources.value
  } catch { /* 错误由拦截器统一提示 */ }
  finally { sourceLoading.value = false }
}

// 数据源编辑
const sourceDialogVisible = ref(false)
const sourceDialogMode = ref<'create' | 'edit'>('create')
const sourceFormRef = ref()
const sourceSubmitting = ref(false)
const sourceFormData = reactive<any>({
  id: null, name: '', dbHost: '', dbPort: 3306, dbName: '', dbUser: '', dbPassword: '',
  tableName: '', syncEnabled: 1, dbDept: undefined as number | undefined,
  idField: 'id', titleField: 'doctitle', contentField: 'doccontent',
  channelField: '', timeField: '', urlField: '', crdeptField: '', cruserField: '',
})
const sourceFormRules = {
  name: [{ required: true, message: '请输入数据源名称', trigger: 'blur' }],
  dbHost: [{ required: true, message: '请输入数据库主机', trigger: 'blur' }],
  dbName: [{ required: true, message: '请输入数据库名', trigger: 'blur' }],
  tableName: [{ required: true, message: '请输入表名', trigger: 'blur' }],
  dbUser: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  dbPassword: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  idField: [{ required: true, message: '请输入ID字段', trigger: 'blur' }],
  titleField: [{ required: true, message: '请输入标题字段', trigger: 'blur' }],
  contentField: [{ required: true, message: '请输入内容字段', trigger: 'blur' }],
}

function openSourceDialog(source?: NewsSource) {
  loadDeptTree()
  if (source) {
    sourceDialogMode.value = 'edit'
    Object.assign(sourceFormData, { ...source, id: source.id })
    // 确保 syncEnabled 是数字
    if (typeof sourceFormData.syncEnabled !== 'number') sourceFormData.syncEnabled = 1
  } else {
    sourceDialogMode.value = 'create'
    Object.assign(sourceFormData, {
      id: null, name: '', dbHost: '', dbPort: 3306, dbName: '', dbUser: '', dbPassword: '',
      tableName: '', syncEnabled: 1, dbDept: undefined as number | undefined,
      idField: 'id', titleField: 'doctitle', contentField: 'doccontent',
      channelField: '', timeField: '', urlField: '', crdeptField: '', cruserField: '',
    })
  }
  sourceDialogVisible.value = true
}

async function submitSourceForm() {
  await sourceFormRef.value.validate()
  sourceSubmitting.value = true
  try {
    const payload = { ...sourceFormData }
    if (sourceDialogMode.value === 'create') {
      await NewsSourceApi.create(payload)
      ElMessage.success('创建成功')
    } else {
      await NewsSourceApi.update(payload)
      ElMessage.success('更新成功')
    }
    sourceDialogVisible.value = false
    await loadSources()
  } catch { /* 错误由拦截器统一提示 */ }
  finally { sourceSubmitting.value = false }
}

async function handleTriggerSync(source: NewsSource) {
  try {
    await ElMessageBox.confirm(`确定手动同步数据源「${source.name}」吗？`, '同步确认', { type: 'info' })
    const res = await NewsSourceApi.triggerSync(source.id, 'manual')
    if (res?.success) {
      ElMessage.success(`同步完成: 获取${res.stats?.totalFetched ?? 0}条, 新增${res.stats?.newRecords ?? 0}条`)
    } else {
      ElMessage.error('同步失败: ' + (res?.error || '未知错误'))
    }
    await loadSources()
    await loadStats()
  } catch (e) { if (e !== 'cancel') console.error(e) }
}

async function handleDeleteSource(source: NewsSource) {
  try {
    await ElMessageBox.confirm(`确定删除数据源「${source.name}」吗？关联的记录也将被删除！`, '删除确认', { type: 'error' })
    await NewsSourceApi.delete(source.id)
    ElMessage.success('删除成功')
    await loadSources()
  } catch (e) { if (e !== 'cancel') console.error(e) }
}

// 数据源统计弹窗
const sourceStatsVisible = ref(false)
const sourceStatsLoading = ref(false)
const currentSourceStats = ref<any>(null)
const currentSourceStatsSourceName = ref('')
const sourceSyncLogs = ref<any[]>([])

async function openSourceStatsDialog(source: NewsSource) {
  currentSourceStatsSourceName.value = source.name
  currentSourceStats.value = null
  sourceSyncLogs.value = []
  sourceStatsVisible.value = true
  sourceStatsLoading.value = true
  try {
    const [statsRes, logsRes] = await Promise.all([
      NewsSourceApi.getStats(source.id),
      NewsSourceApi.getSyncLogs(source.id, 20),
    ])
    currentSourceStats.value = statsRes || {}
    sourceSyncLogs.value = logsRes || []
  } catch { /* 错误由拦截器统一提示 */ }
  finally { sourceStatsLoading.value = false }
}

// ========== 同步日志 ==========
const logs = ref<NewsSyncLog[]>([])
const logLoading = ref(false)
const logPagination = reactive({ pageNo: 1, pageSize: 20, total: 0 })
const logFilters = reactive<NewsSyncLogPageReq>({
  pageNo: 1, pageSize: 20, sourceId: undefined, syncType: '', status: '',
})

async function loadLogs() {
  logLoading.value = true
  try {
    logFilters.pageNo = logPagination.pageNo
    logFilters.pageSize = logPagination.pageSize
    const res = await NewsSyncLogApi.getPage(logFilters)
    logs.value = res?.list || []
    logPagination.total = res?.total || 0
  } catch { /* 错误由拦截器统一提示 */ }
  finally { logLoading.value = false }
}

// ========== 频道选项 ==========
async function loadChannels() {
  try {
    const res = await NewsRecordApi.getChannels()
    channelOptions.value = res || []
  } catch { /* noop */ }
}

// ========== 工具函数 ==========
function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function getStatusTagType(status: string) {
  return NEWS_STATUS_OPTIONS.find(o => o.value === status)?.type || 'info'
}

function getSyncStatusTagType(status: string) {
  return SYNC_STATUS_OPTIONS.find(o => o.value === status)?.type || 'info'
}

// ========== 初始化 ==========
onMounted(() => {
  loadStats()
  loadRecords()
  loadSources()
  loadChannels()
})
</script>

<style lang="scss" scoped>
.news-page {
  padding: 0;
}

/* 统计卡片 */
.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 150px;

    .stat-icon {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stat-info {
      display: flex;
      flex-direction: column;

      .stat-value {
        font-size: 22px;
        font-weight: 700;
        color: #303133;
        line-height: 1.2;
      }

      .stat-label {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

/* 筛选栏 */
.filter-bar {
  margin-bottom: 16px;
}

/* 分页 */
.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 统计迷你 */
.stat-mini {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;

  .stat-sep {
    margin: 0 4px;
    color: #dcdfe6;
  }
}

.text-warning { color: #e6a23c; }
.text-success { color: #67c23a; }
.text-danger { color: #f56c6c; }
.text-right { text-align: right; }

/* 详情 */
.record-content {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.w-full { width: 100%; }
</style>
