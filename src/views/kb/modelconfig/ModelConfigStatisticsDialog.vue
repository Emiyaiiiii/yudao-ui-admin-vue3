<template>
  <el-dialog v-model="dialogVisible" title="模型配置统计" width="950" destroy-on-close>
    <div v-loading="loading">
      <!-- 统计概览卡片 -->
      <el-row :gutter="16" class="mb-20px">
        <el-col :span="6">
          <el-card shadow="hover">
            <div class="stat-card-inner">
              <div class="stat-label text-13px" style="color: #6b7280;">总配置数</div>
              <div class="stat-value text-28px fw-700 mt-4px" style="color: #1f2937;">{{ statistics?.totalConfigs || 0 }}</div>
              <div class="stat-desc text-11px mt-4px" style="color: #9ca3af;">已创建的模型配置总数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <div class="stat-card-inner">
              <div class="stat-label text-13px" style="color: #6b7280;">激活配置</div>
              <div class="stat-value text-28px fw-700 mt-4px" style="color: #1f2937;">{{ statistics?.activeConfigs || 0 }}</div>
              <div class="stat-desc text-11px mt-4px" style="color: #9ca3af;">当前可用的配置数量</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <div class="stat-card-inner">
              <div class="stat-label text-13px" style="color: #6b7280;">总使用量</div>
              <div class="stat-value text-28px fw-700 mt-4px" style="color: #1f2937;">{{ (statistics?.totalUsage || 0).toLocaleString() }}</div>
              <div class="stat-desc text-11px mt-4px" style="color: #9ca3af;">累计使用次数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <div class="stat-card-inner">
              <div class="stat-label text-13px" style="color: #6b7280;">部署类型</div>
              <div class="stat-value text-28px fw-700 mt-4px" style="color: #1f2937;">{{ deployTypeCount }}</div>
              <div class="stat-desc text-11px mt-4px" style="color: #9ca3af;">支持的部署方式</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 配置详情表格 -->
      <el-table
        v-if="statistics?.statistics?.length"
        :data="statistics.statistics"
        size="small"
        stripe
        border
        highlight-current-row
      >
        <el-table-column prop="name" label="模型名称" width="140">
          <template #default="{ row }">
            <span>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="部署类型" width="110">
          <template #default="{ row }">
            <el-tag :type="getDeployTagType(row.deploy)" size="small">
              {{ getDeployDisplay(row.deploy) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small" effect="light">
              {{ row.isActive ? '激活' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="usageCount" label="使用次数" width="90" align="right">
          <template #default="{ row }">
            {{ (row.usageCount || 0).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="totalSessions" label="总对话数" width="90" align="right">
          <template #default="{ row }">
            {{ (row.totalSessions || 0).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="最后使用时间" width="160">
          <template #default="{ row }">
            {{ formatDateDisplay(row.lastUsed) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDateDisplay(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200">
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无统计数据" :image-size="80" />
    </div>
    <template #footer>
      <el-button type="primary" @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ModelConfigApi, type ModelConfigStatistics } from '@/api/kb/modelconfig'

defineOptions({ name: 'ModelConfigStatisticsDialog' })

const dialogVisible = ref(false)
const loading = ref(false)
const statistics = ref<ModelConfigStatistics | null>(null)

const deployTypeCount = computed(() => {
  if (!statistics.value?.statistics) return 0
  const deploys = new Set(statistics.value.statistics.map((item) => item.deploy))
  return deploys.size
})

const deployDisplayMap: Record<string, string> = {
  doubao: '豆包',
  bailian: '百炼',
  lite: 'LiteLLM',
  openai: 'OpenAI',
  api: '通用API',
  xinf: 'Xinference',
  vllm: 'VLLM',
  zhipu: '智谱AI',
  other: '其他'
}

const deployTagTypeMap: Record<string, string> = {
  doubao: 'warning',
  bailian: 'danger',
  openai: 'success',
  lite: 'success',
  api: 'info',
  zhipu: 'primary',
  vllm: '',
  xinf: '',
  other: ''
}

const getDeployDisplay = (deploy: string) => {
  return deployDisplayMap[deploy] || deploy
}

const getDeployTagType = (deploy: string) => {
  return deployTagTypeMap[deploy] || ''
}

const formatDateDisplay = (val?: string | number) => {
  if (!val) return '-'
  if (typeof val === 'number') {
    return new Date(val).toISOString().substring(0, 10)
  }
  return val
}

const open = async () => {
  dialogVisible.value = true
  loading.value = true
  try {
    statistics.value = await ModelConfigApi.getStatistics()
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.stat-card-inner {
  padding: 4px 0;
}
</style>
