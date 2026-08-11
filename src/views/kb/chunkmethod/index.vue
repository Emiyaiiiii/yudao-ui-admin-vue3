<template>
  <div class="chunk-method-page">
    <!-- 搜索和过滤区域 -->
    <ContentWrap>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-input
            v-model="searchQuery"
            placeholder="搜索方法名称/代码..."
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <Icon icon="ep:search" />
            </template>
          </el-input>
        </el-col>
        <el-col :span="5">
          <el-select
            v-model="methodTypeFilter"
            placeholder="方法类型"
            clearable
            @change="handleFilterChange"
            class="w-full"
          >
            <el-option
              v-for="item in methodTypeOptions"
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
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-col>
        <el-col :span="9" class="flex justify-end gap-10px">
          <el-button type="primary" @click="openForm('create')" v-hasPermi="['kb:chunk-method:create']">
            <Icon icon="ep:plus" class="mr-5px" /> 新建方法
          </el-button>
        </el-col>
      </el-row>
    </ContentWrap>

    <!-- 切片方法卡片展示区 -->
    <div class="chunk-cards-section">
      <!-- 第一张卡片：新建方法 -->
      <div class="chunk-card create-card" @click="openForm('create')">
        <div class="card-content">
          <div class="create-icon-wrap">
            <Icon icon="ep:plus" :size="28" color="var(--el-color-primary)" />
          </div>
          <div class="create-text">创建切片方法</div>
          <div class="create-subtext">创建新的切片方法定义</div>
        </div>
      </div>

      <!-- 切片方法卡片 -->
      <div
        v-for="method in methodList"
        :key="method.id"
        class="chunk-card"
        @click="handleCardClick(method)"
      >
        <!-- 卡片顶部 -->
        <div class="card-header">
          <div class="method-type">
            <el-tag :type="getMethodTypeTagType(method.methodType)" size="small" class="text-10px">
              {{ getMethodTypeDisplay(method.methodType) }}
            </el-tag>
            <el-tag
              v-if="method.isDefaultMethod"
              size="small"
              type="warning"
              effect="plain"
              class="ml-4px text-10px"
            >
              默认
            </el-tag>
          </div>
          <div class="card-header-right">
            <span class="status-badge" :class="method.isActive ? 'active' : 'inactive'">
              {{ method.isActive ? '启用' : '停用' }}
            </span>
            <el-button link size="small" @click.stop="handleTest(method)" title="测试方法">
              <Icon icon="ep:video-play" :size="14" />
            </el-button>
            <el-dropdown @command="(cmd: string) => handleCardCommand(cmd, method)" trigger="click">
              <span @click.stop><Icon icon="ep:more-filled" :size="14" class="card-menu-icon" /></span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="view">查看详情</el-dropdown-item>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="test">测试方法</el-dropdown-item>
                  <el-dropdown-item command="toggle-status">
                    {{ method.isActive ? '停用' : '启用' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="set-default" :disabled="method.isDefaultMethod">
                    {{ method.isDefaultMethod ? '已是默认' : '设为默认' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 卡片内容 -->
        <div class="card-body">
          <div class="method-name">{{ method.name }}</div>
          <div class="method-code">{{ method.code }}</div>
          <div class="method-description">
            {{ truncateText(method.description || '暂无描述', 80) }}
          </div>
          <div class="method-perf">
            <div class="perf-item">
              <Icon icon="ep:odometer" :size="14" />
              <span class="perf-text">{{ formatSpeed(method.avgProcessingSpeed) }}</span>
            </div>
            <div class="perf-item">
              <Icon icon="ep:cpu" :size="14" />
              <span class="perf-text">{{ formatMemory(method.memoryFootprint) }}</span>
            </div>
          </div>
        </div>

        <!-- 卡片底部 -->
        <div class="card-footer">
          <div class="stats-row">
            <div class="stat-item" title="创建时间">
              <Icon icon="ep:calendar" :size="12" />
              <span class="stat-text">{{ formatDate(method.createTime) }}</span>
            </div>
            <div class="stat-item" title="方法代码">
              <Icon icon="ep:document" :size="12" />
              <span class="stat-text">{{ truncateText(method.code, 15) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <ContentWrap v-if="methodList.length === 0 && !loading">
      <el-empty description="暂无切片方法">
        <el-button type="primary" @click="openForm('create')">创建第一个方法</el-button>
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
        @pagination="loadMethods"
      />
    </ContentWrap>

    <!-- 弹窗组件 -->
    <ChunkMethodForm ref="formRef" @success="loadMethods" />
    <ChunkMethodViewDialog ref="viewDialogRef" />
    <ChunkMethodTestDialog ref="testDialogRef" @testSuccess="handleTestSuccess" />
    <ChunkMethodTestResultDialog ref="testResultDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useMessage } from '@/hooks/web/useMessage'
import { ChunkMethodApi, type ChunkMethod } from '@/api/kb/chunkmethod'
import ChunkMethodForm from './ChunkMethodForm.vue'
import ChunkMethodViewDialog from './ChunkMethodViewDialog.vue'
import ChunkMethodTestDialog from './ChunkMethodTestDialog.vue'
import ChunkMethodTestResultDialog from './ChunkMethodTestResultDialog.vue'

defineOptions({ name: 'KbChunkMethod' })

const message = useMessage()

// 搜索和过滤
const searchQuery = ref('')
const methodTypeFilter = ref('')
const statusFilter = ref<number | undefined>(undefined)

// 分页
const queryParams = reactive({
  pageNo: 1,
  pageSize: 12
})

// 数据
const methodList = ref<ChunkMethod[]>([])
const totalCount = ref(0)
const loading = ref(true)

// 子组件引用
const formRef = ref()
const viewDialogRef = ref()
const testDialogRef = ref()
const testResultDialogRef = ref()

// 方法类型选项
const methodTypeOptions = [
  { label: '固定大小', value: 'fixed_size' },
  { label: '语义分段', value: 'semantic' },
  { label: '层次分段', value: 'hierarchical' },
  { label: '递归分割', value: 'recursive' },
  { label: '按句子', value: 'sentence' },
  { label: '按段落', value: 'paragraph' },
  { label: '按章节', value: 'section' },
  { label: '自定义', value: 'custom' }
]

// 加载列表
const loadMethods = async () => {
  loading.value = true
  try {
    const params: any = {
      pageNo: queryParams.pageNo,
      pageSize: queryParams.pageSize,
      search: searchQuery.value || undefined,
      methodType: methodTypeFilter.value || undefined,
      isActive: statusFilter.value !== undefined ? statusFilter.value : undefined
    }
    const data = await ChunkMethodApi.getPage(params)
    methodList.value = data.list || []
    totalCount.value = data.total || 0
  } catch (e) {
    console.error('加载切片方法列表失败:', e)
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

// 初始化
onMounted(() => {
  loadMethods()
})

// 搜索
const handleSearch = () => {
  queryParams.pageNo = 1
  loadMethods()
}

// 过滤
const handleFilterChange = () => {
  queryParams.pageNo = 1
  loadMethods()
}

// 打开创建/编辑弹窗
const openForm = (type: 'create' | 'update', row?: ChunkMethod) => {
  formRef.value.open(type, row)
}

// 测试方法
const handleTest = (method: ChunkMethod) => {
  testDialogRef.value.open(method)
}

// 测试成功回调
const handleTestSuccess = (result: any) => {
  testResultDialogRef.value.open(result)
}

// 卡片下拉菜单命令
const handleCardCommand = async (command: string, method: ChunkMethod) => {
  switch (command) {
    case 'view':
      viewDialogRef.value.open(method)
      break
    case 'edit':
      openForm('update', method)
      break
    case 'test':
      handleTest(method)
      break
    case 'toggle-status':
      await toggleStatus(method)
      break
    case 'set-default':
      await setDefault(method)
      break
    case 'delete':
      await handleDelete(method)
      break
  }
}

// 切换状态
const toggleStatus = async (method: ChunkMethod) => {
  try {
    await ChunkMethodApi.batchActivate([method.id], !method.isActive)
    message.success('操作成功')
    loadMethods()
  } catch {
    message.error('操作失败')
  }
}

// 设为默认
const setDefault = async (method: ChunkMethod) => {
  try {
    await ElMessageBox.confirm(
      `确定要将 "${method.name}" 设置为默认切片方法吗？`,
      '确认',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
    await ChunkMethodApi.setDefault(method.id)
    message.success('已设置为默认方法')
    loadMethods()
  } catch {
    // 取消忽略
  }
}

// 删除方法
const handleDelete = async (method: ChunkMethod) => {
  try {
    await ElMessageBox.confirm(
      `确定删除切片方法 "${method.name}" 吗？此操作不可恢复！`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await ChunkMethodApi.delete(method.id)
    message.success('删除成功')
    loadMethods()
  } catch {
    // 取消忽略
  }
}

// 卡片点击
const handleCardClick = (method: ChunkMethod) => {
  viewDialogRef.value.open(method)
}

// ================== 辅助函数 ==================
const methodTypeDisplayMap: Record<string, string> = {
  fixed_size: '固定大小', semantic: '语义分段', hierarchical: '层次分段',
  recursive: '递归分割', sentence: '按句子', paragraph: '按段落',
  section: '按章节', custom: '自定义'
}

const methodTypeTagMap: Record<string, string> = {
  fixed_size: '', semantic: 'success', hierarchical: 'warning',
  recursive: 'primary', sentence: 'info', paragraph: 'danger',
  section: '', custom: ''
}

const getMethodTypeDisplay = (type?: string) => methodTypeDisplayMap[type || ''] || type || '-'
const getMethodTypeTagType = (type?: string) => methodTypeTagMap[type || ''] || ''

const truncateText = (text: string, length: number) => {
  if (!text) return ''
  return text.length <= length ? text : text.substring(0, length) + '...'
}

const formatSpeed = (speed?: number) => {
  if (speed === undefined || speed === null) return '-'
  return `${speed.toFixed(1)} 千字/秒`
}

const formatMemory = (memory?: number) => {
  if (memory === undefined || memory === null) return '-'
  return `${memory} MB`
}

const formatDate = (date?: string | number) => {
  if (!date) return '-'
  if (typeof date === 'number') {
    const d = new Date(date)
    return d.toISOString().substring(0, 10)
  }
  return String(date).substring(0, 10)
}
</script>

<style scoped lang="scss">
.chunk-method-page {
  padding: 0;
}

/* ========== 卡片网格 ========== */
.chunk-cards-section {
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
.chunk-card {
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

  .method-type {
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

  .method-name {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 4px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .method-code {
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }
  .method-description {
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
  .method-perf {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    padding: 8px 10px;
    background: #f8fafc;
    border-radius: 6px;
    .perf-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #6b7280;
      .perf-text {
        font-weight: 500;
        color: #1f2937;
      }
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
