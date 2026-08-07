<template>
  <div class="model-config-page">
    <!-- 搜索和过滤区域 -->
    <ContentWrap>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-input
            v-model="searchQuery"
            placeholder="搜索模型名称/UID..."
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <Icon icon="ep:search" />
            </template>
          </el-input>
        </el-col>
        <el-col :span="4">
          <el-select
            v-model="deployFilter"
            placeholder="部署类型"
            clearable
            @change="handleFilterChange"
            class="w-full"
          >
            <el-option
              v-for="item in deployOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select
            v-model="statusFilter"
            placeholder="状态"
            clearable
            @change="handleFilterChange"
            class="w-full"
          >
            <el-option label="激活" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-col>
        <el-col :span="10" class="flex justify-end gap-10px">
          <el-button type="primary" @click="openForm('create')" v-hasPermi="['kb:model-config:create']">
            <Icon icon="ep:plus" class="mr-5px" /> 创建配置
          </el-button>
          <el-button @click="handleShowStatistics">
            <Icon icon="ep:data-line" class="mr-5px" /> 统计
          </el-button>
        </el-col>
      </el-row>
    </ContentWrap>

    <!-- 模型配置卡片展示区 -->
    <div class="model-cards-section">
      <!-- 第一张卡片：创建配置 -->
      <div class="model-card create-card" @click="openForm('create')">
        <div class="card-content">
          <div class="create-icon-wrap">
            <Icon icon="ep:plus" :size="28" color="var(--el-color-primary)" />
          </div>
          <div class="create-text">创建模型配置</div>
          <div class="create-subtext">创建新的模型配置</div>
        </div>
      </div>

      <!-- 模型配置卡片 -->
      <div
        v-for="config in modelList"
        :key="config.id"
        class="model-card"
        @click="handleCardClick(config)"
      >
        <!-- 卡片顶部 -->
        <div class="card-header">
          <div class="model-deploy">
            <el-tag :type="getDeployTagType(config.deploy)" size="small" class="text-10px">
              {{ getDeployDisplay(config.deploy) }}
            </el-tag>
            <el-tag
              v-if="config.platform !== 'both'"
              size="small"
              type="info"
              effect="plain"
              class="ml-4px text-10px"
            >
              {{ getPlatformDisplay(config.platform) }}
            </el-tag>
            <Icon
              v-if="config.isPinned"
              icon="ep:star-filled"
              :size="14"
              color="#e6a23c"
              class="ml-4px"
            />
          </div>
          <div class="card-header-right">
            <span class="status-badge" :class="config.isActive ? 'active' : 'inactive'">
              {{ config.isActive ? '激活' : '停用' }}
            </span>
            <el-button
              link
              size="small"
              @click.stop="handleTest(config)"
              title="测试连接"
            >
              <Icon icon="ep:connection" :size="14" />
            </el-button>
            <el-button
              link
              size="small"
              @click.stop="openForm('update', config)"
              title="编辑"
            >
              <Icon icon="ep:edit" :size="14" />
            </el-button>
            <el-dropdown @command="(cmd: string) => handleCardCommand(cmd, config)" trigger="click">
              <Icon icon="ep:more-filled" :size="14" class="card-menu-icon" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="test">测试连接</el-dropdown-item>
                  <el-dropdown-item command="copy">复制配置</el-dropdown-item>
                  <el-dropdown-item command="toggle-status">
                    {{ config.isActive ? '停用' : '激活' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="toggle-pin">
                    {{ config.isPinned ? '取消置顶' : '置顶' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="set-default">设为默认</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 卡片内容 -->
        <div class="card-body">
          <div class="model-name">{{ config.name }}</div>
          <div class="model-uid">{{ config.uid }}</div>
          <div class="model-description">
            {{ truncateText(config.description || '暂无描述', 80) }}
          </div>
          <div class="model-url">
            <Icon icon="ep:link" :size="12" />
            <span class="url-text">{{ truncateText(config.url, 25) }}</span>
          </div>
          <div class="model-params">
            <div class="param-item">
              <span class="param-label">最大Token:</span>
              <span class="param-value">{{ formatNumber(config.maxTokens) }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">上下文:</span>
              <span class="param-value">{{ formatNumber(config.contextLength) }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">思考:</span>
              <Icon
                :icon="config.thinkingEnabled ? 'ep:check' : 'ep:close'"
                :size="14"
                :color="config.thinkingEnabled ? '#67c23a' : '#909399'"
              />
            </div>
          </div>
        </div>

        <!-- 卡片底部 -->
        <div class="card-footer">
          <div class="stats-row">
            <div class="stat-item" title="创建时间">
              <Icon icon="ep:calendar" :size="12" />
              <span class="stat-text">{{ formatDate(config.createTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <ContentWrap v-if="modelList.length === 0 && !loading">
      <el-empty description="暂无模型配置">
        <el-button type="primary" @click="openForm('create')">创建第一个配置</el-button>
      </el-empty>
    </ContentWrap>

    <!-- 加载状态 -->
    <ContentWrap v-if="loading">
      <el-skeleton :rows="5" animated />
    </ContentWrap>

    <!-- 分页 -->
    <ContentWrap v-if="totalCount > 0">
      <Pagination
        :total="totalCount"
        v-model:page="queryParams.pageNo"
        v-model:limit="queryParams.pageSize"
        :page-sizes="[12, 24, 36, 48]"
        @pagination="loadModelConfigs"
      />
    </ContentWrap>

    <!-- 弹窗组件 -->
    <ModelConfigForm ref="formRef" @success="loadModelConfigs" />
    <ModelConfigTestDialog ref="testDialogRef" />
    <ModelConfigCopyDialog ref="copyDialogRef" @success="loadModelConfigs" />
    <ModelConfigStatisticsDialog ref="statisticsDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useMessage } from '@/hooks/web/useMessage'
import { ModelConfigApi, type ModelConfig } from '@/api/kb/modelconfig'
import ModelConfigForm from './ModelConfigForm.vue'
import ModelConfigTestDialog from './ModelConfigTestDialog.vue'
import ModelConfigCopyDialog from './ModelConfigCopyDialog.vue'
import ModelConfigStatisticsDialog from './ModelConfigStatisticsDialog.vue'

defineOptions({ name: 'KbModelConfig' })

const message = useMessage()

// 搜索和过滤
const searchQuery = ref('')
const deployFilter = ref('')
const statusFilter = ref<number | undefined>(undefined)

// 分页
const queryParams = reactive({
  pageNo: 1,
  pageSize: 12
})

// 数据
const modelList = ref<ModelConfig[]>([])
const totalCount = ref(0)
const loading = ref(true) // 初始 true，让骨架屏先显示

// 子组件引用
const formRef = ref()
const testDialogRef = ref()
const copyDialogRef = ref()
const statisticsDialogRef = ref()

// 部署选项
const deployOptions = [
  { label: '豆包', value: 'doubao' },
  { label: '百炼', value: 'bailian' },
  { label: 'LiteLLM', value: 'lite' },
  { label: 'OpenAI', value: 'openai' },
  { label: '通用API', value: 'api' },
  { label: 'Xinference', value: 'xinf' },
  { label: 'VLLM', value: 'vllm' },
  { label: '智谱AI', value: 'zhipu' },
  { label: '其他', value: 'other' }
]

// 加载列表
const loadModelConfigs = async () => {
  loading.value = true
  try {
    const params: any = {
      pageNo: queryParams.pageNo,
      pageSize: queryParams.pageSize,
      search: searchQuery.value || undefined,
      deploy: deployFilter.value || undefined,
      isActive: statusFilter.value !== undefined ? statusFilter.value : undefined
    }
    const data = await ModelConfigApi.getPage(params)
    modelList.value = data.list || []
    totalCount.value = data.total || 0
  } catch (e) {
    console.error('加载模型配置列表失败:', e)
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

// 初始化
onMounted(() => {
  loadModelConfigs()
})

// 搜索
const handleSearch = () => {
  queryParams.pageNo = 1
  loadModelConfigs()
}

// 过滤
const handleFilterChange = () => {
  queryParams.pageNo = 1
  loadModelConfigs()
}

// 打开创建/编辑弹窗
const openForm = (type: 'create' | 'update', row?: ModelConfig) => {
  formRef.value.open(type, row)
}

// 测试连接
const handleTest = (config: ModelConfig) => {
  testDialogRef.value.open(config)
}

// 卡片下拉菜单命令
const handleCardCommand = async (command: string, config: ModelConfig) => {
  switch (command) {
    case 'edit':
      openForm('update', config)
      break
    case 'test':
      handleTest(config)
      break
    case 'copy':
      copyDialogRef.value.open(config)
      break
    case 'toggle-status':
      await toggleStatus(config)
      break
    case 'set-default':
      await setDefault(config)
      break
    case 'toggle-pin':
      await togglePin(config)
      break
    case 'delete':
      await handleDelete(config)
      break
  }
}

// 切换状态
const toggleStatus = async (config: ModelConfig) => {
  try {
    if (config.isActive) {
      await ModelConfigApi.deactivate(config.id)
    } else {
      await ModelConfigApi.activate(config.id)
    }
    message.success('操作成功')
    loadModelConfigs()
  } catch {
    message.error('操作失败')
  }
}

// 设为默认
const setDefault = async (config: ModelConfig) => {
  try {
    await ModelConfigApi.setDefault(config.id)
    message.success('已设置为默认配置')
    loadModelConfigs()
  } catch {
    message.error('设置失败')
  }
}

// 切换置顶
const togglePin = async (config: ModelConfig) => {
  try {
    const fullConfig = await ModelConfigApi.get(config.id)
    await ModelConfigApi.update({
      ...fullConfig,
      isPinned: config.isPinned ? 0 : 1
    })
    message.success(config.isPinned ? '取消置顶成功' : '置顶成功')
    loadModelConfigs()
  } catch {
    message.error('操作失败')
  }
}

// 删除配置
const handleDelete = async (config: ModelConfig) => {
  try {
    await ElMessageBox.confirm(
      `确定删除模型配置 "${config.name}" 吗？此操作不可恢复！`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await ModelConfigApi.delete(config.id)
    message.success('删除成功')
    loadModelConfigs()
  } catch {
    // 取消忽略
  }
}

// 显示统计
const handleShowStatistics = () => {
  statisticsDialogRef.value.open()
}

// 卡片点击
const handleCardClick = (config: ModelConfig) => {
  // 可扩展为跳转详情页
}

// ================== 辅助函数 ==================
const deployDisplayMap: Record<string, string> = {
  doubao: '豆包', bailian: '百炼', lite: 'LiteLLM', openai: 'OpenAI',
  api: '通用API', xinf: 'Xinference', vllm: 'VLLM', zhipu: '智谱AI', other: '其他'
}

const deployTagTypeMap: Record<string, string> = {
  doubao: 'warning', bailian: 'danger', openai: 'success', lite: 'success',
  api: 'info', zhipu: 'primary', vllm: '', xinf: '', other: ''
}

const getDeployDisplay = (deploy?: string) => deployDisplayMap[deploy || ''] || deploy || '-'
const getDeployTagType = (deploy?: string) => deployTagTypeMap[deploy || ''] || ''

const getPlatformDisplay = (platform?: string) => {
  if (platform === 'web') return 'Web端'
  if (platform === 'app') return 'App端'
  return platform || ''
}

const truncateText = (text: string, length: number) => {
  if (!text) return ''
  return text.length <= length ? text : text.substring(0, length) + '...'
}

const formatNumber = (num?: number) => {
  if (num === undefined || num === null) return '-'
  return num.toLocaleString()
}

const formatDate = (date?: string | number) => {
  if (!date) return '-'
  // yudao 后端 LocalDateTime 默认序列化为时间戳数字
  if (typeof date === 'number') {
    const d = new Date(date)
    return d.toISOString().substring(0, 10)
  }
  return String(date).substring(0, 10)
}
</script>

<style scoped lang="scss">
.model-config-page {
  padding: 0;
}

/* ========== 卡片网格 ========== */
.model-cards-section {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(1, 1fr);
  margin: 16px 0;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (min-width: 1600px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* ========== 卡片基类 ========== */
.model-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid #eef2f6;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  min-height: 230px;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(64, 158, 255, 0.3), transparent);
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
    border-color: #d0ddf0;
    &::after { opacity: 1; }
  }

  &:active {
    transform: translateY(-1px);
    transition: all 0.1s ease;
  }
}

/* ========== 创建卡片 ========== */
.create-card {
  background: #fafbfd;
  border: 2px dashed #e1e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;

  &:hover {
    background: #f0f7ff;
    border-color: var(--el-color-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.1);
  }

  .card-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .create-icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ecf5ff, #d9ecff);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .create-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-color-primary);
  }
  .create-subtext {
    font-size: 11px;
    color: #9ca3af;
  }
}

/* ========== 卡片头部 ========== */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  min-height: 24px;

  .model-deploy {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .card-header-right {
    display: flex;
    align-items: center;
    gap: 6px;

    .status-badge {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
      font-weight: 500;
      &.active {
        color: var(--el-color-success);
        background: rgba(103, 194, 58, 0.1);
      }
      &.inactive {
        color: var(--el-color-danger);
        background: rgba(245, 108, 108, 0.1);
      }
    }

    .card-menu-icon {
      opacity: 0.6;
      transition: opacity 0.3s ease;
      color: #6b7280;
      cursor: pointer;
      padding: 2px;
      &:hover { color: var(--el-color-primary); opacity: 1; }
    }
  }
}

/* ========== 卡片主体 ========== */
.card-body {
  flex: 1;
  margin-bottom: 10px;
  min-height: 0;

  .model-name {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 4px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .model-uid {
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .model-description {
    font-size: 11px;
    color: #6b7280;
    line-height: 1.4;
    margin-bottom: 10px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    min-height: 28px;
  }
  .model-url {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 8px;
    padding: 6px 8px;
    background: #f8fafc;
    border-radius: 6px;
    .url-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
  }
  .model-params {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    .param-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #6b7280;
      .param-label { color: #9ca3af; }
      .param-value { font-weight: 500; color: #1f2937; }
    }
  }
}

/* ========== 卡片底部 ========== */
.card-footer {
  border-top: 1px solid #f0f2f5;
  padding-top: 10px;
  margin-top: auto;

  .stats-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .stat-item {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #6b7280;
      font-size: 11px;
      .stat-text { font-size: 11px; font-weight: 500; }
    }
  }
}
</style>
