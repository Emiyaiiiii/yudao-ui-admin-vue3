<template>
  <ContentWrap>
    <!-- 查询条件 -->
    <div class="mb-16px flex items-center gap-12px flex-wrap">
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        :clearable="true"
        style="width: 260px"
      />
      <el-input
        v-model="queryParams.model"
        placeholder="模型名"
        clearable
        style="width: 180px"
        @keyup.enter="handleQuery"
        @clear="handleQuery"
      />
      <el-input
        v-model="queryParams.provider"
        placeholder="Provider"
        clearable
        style="width: 160px"
        @keyup.enter="handleQuery"
        @clear="handleQuery"
      />
      <el-button type="primary" @click="handleQuery"><Icon icon="ep:search" class="mr-4px" /> 查询</el-button>
    </div>

    <div v-loading="loading">
      <!-- 汇总卡片 -->
      <el-row :gutter="16" class="mb-16px">
        <el-col :span="6">
          <el-card shadow="never" class="text-center">
            <div class="text-13px text-gray-500 mb-8px">总 Token</div>
            <div class="text-24px font-700 text-[var(--el-color-primary)]">{{ formatNumber(summary.total_prompt_tokens + summary.total_completion_tokens) }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" class="text-center">
            <div class="text-13px text-gray-500 mb-8px">输入 Token</div>
            <div class="text-24px font-700">{{ formatNumber(summary.total_prompt_tokens) }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" class="text-center">
            <div class="text-13px text-gray-500 mb-8px">输出 Token</div>
            <div class="text-24px font-700">{{ formatNumber(summary.total_completion_tokens) }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="never" class="text-center">
            <div class="text-13px text-gray-500 mb-8px">调用次数</div>
            <div class="text-24px font-700 text-[var(--el-color-success)]">{{ formatNumber(summary.total_calls) }}</div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 按模型统计 -->
        <el-col :span="12">
          <el-card shadow="never" class="mb-16px">
            <template #header>按模型统计</template>
            <el-table :data="modelRows" size="small" max-height="320">
              <el-table-column label="模型" min-width="150px">
                <template #default="scope">
                  <span>{{ scope.row.provider_id }}</span>
                  <el-tag size="small" class="ml-4px">{{ scope.row.model }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="输入" prop="prompt_tokens" align="right" width="100px">
                <template #default="scope">{{ formatNumber(scope.row.prompt_tokens) }}</template>
              </el-table-column>
              <el-table-column label="输出" prop="completion_tokens" align="right" width="100px">
                <template #default="scope">{{ formatNumber(scope.row.completion_tokens) }}</template>
              </el-table-column>
              <el-table-column label="次数" prop="call_count" align="right" width="80px">
                <template #default="scope">{{ formatNumber(scope.row.call_count) }}</template>
              </el-table-column>
            </el-table>
            <el-empty v-if="modelRows.length === 0" description="暂无数据" :image-size="50" />
          </el-card>
        </el-col>

        <!-- 按日期统计 -->
        <el-col :span="12">
          <el-card shadow="never" class="mb-16px">
            <template #header>按日期统计</template>
            <el-table :data="dateRows" size="small" max-height="320">
              <el-table-column label="日期" prop="date" min-width="120px" />
              <el-table-column label="输入" prop="prompt_tokens" align="right" width="100px">
                <template #default="scope">{{ formatNumber(scope.row.prompt_tokens) }}</template>
              </el-table-column>
              <el-table-column label="输出" prop="completion_tokens" align="right" width="100px">
                <template #default="scope">{{ formatNumber(scope.row.completion_tokens) }}</template>
              </el-table-column>
              <el-table-column label="次数" prop="call_count" align="right" width="80px">
                <template #default="scope">{{ formatNumber(scope.row.call_count) }}</template>
              </el-table-column>
            </el-table>
            <el-empty v-if="dateRows.length === 0" description="暂无数据" :image-size="50" />
          </el-card>
        </el-col>
      </el-row>

      <!-- 明细表 -->
      <el-card shadow="never">
        <template #header>用量明细</template>
        <el-table :data="details" size="small">
          <el-table-column label="日期" prop="date" min-width="110px" />
          <el-table-column label="Provider" prop="provider_id" min-width="120px" />
          <el-table-column label="模型" prop="model" min-width="140px" />
          <el-table-column label="输入 Token" prop="prompt_tokens" align="right" width="110px">
            <template #default="scope">{{ formatNumber(scope.row.prompt_tokens) }}</template>
          </el-table-column>
          <el-table-column label="输出 Token" prop="completion_tokens" align="right" width="110px">
            <template #default="scope">{{ formatNumber(scope.row.completion_tokens) }}</template>
          </el-table-column>
          <el-table-column label="调用次数" prop="call_count" align="right" width="100px">
            <template #default="scope">{{ formatNumber(scope.row.call_count) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="details.length === 0" description="暂无数据" :image-size="50" />
      </el-card>
    </div>
  </ContentWrap>
</template>

<script setup lang="ts">
import { TokenUsageApi, TokenUsageSummary, TokenUsageRecord, TokenUsageByModel, TokenUsageByDate } from '@/api/ai/tokenUsage'

/** Token 用量统计 */
defineOptions({ name: 'AiTokenUsageIndex' })

const loading = ref(false)
const dateRange = ref<[string, string] | null>(null)
const queryParams = reactive({ model: '', provider: '' })
const summary = ref<TokenUsageSummary>({
  total_prompt_tokens: 0,
  total_completion_tokens: 0,
  total_calls: 0,
  by_model: {},
  by_date: {}
})
const details = ref<TokenUsageRecord[]>([])

/** 按模型统计行（转数组并倒序） */
const modelRows = computed<TokenUsageByModel[]>(() =>
  Object.values(summary.value.by_model || {}).sort((a, b) => b.prompt_tokens + b.completion_tokens - (a.prompt_tokens + a.completion_tokens))
)

/** 按日期统计行（转数组） */
const dateRows = computed<TokenUsageByDate & { date: string }[]>(() =>
  Object.entries(summary.value.by_date || {})
    .map(([date, item]) => ({ date, ...item }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
)

/** 数字格式化（千分位） */
const formatNumber = (value?: number) => {
  const num = value || 0
  return num.toLocaleString('en-US')
}

/** 查询 */
const handleQuery = async () => {
  loading.value = true
  try {
    const params = {
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      model: queryParams.model || undefined,
      provider: queryParams.provider || undefined
    }
    const [sum, det] = await Promise.all([TokenUsageApi.getSummary(params), TokenUsageApi.getDetails(params)])
    summary.value = sum
    details.value = det
  } finally {
    loading.value = false
  }
}

/** 初始化：默认查最近 30 天 */
onMounted(async () => {
  const today = new Date()
  const start = new Date()
  start.setDate(today.getDate() - 29)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  dateRange.value = [fmt(start), fmt(today)]
  await handleQuery()
})
</script>
