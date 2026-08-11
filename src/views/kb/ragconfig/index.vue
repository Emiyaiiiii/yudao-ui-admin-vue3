<template>
  <div class="rag-config-page">
    <!-- 搜索和过滤区域 -->
    <ContentWrap>
      <el-row :gutter="20">
        <el-col :span="5">
          <el-select
            v-model="moduleFilter"
            placeholder="全部模块"
            clearable
            @change="handleFilterChange"
            class="w-full"
          >
            <el-option
              v-for="item in moduleOptions"
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
        <el-col :span="6">
          <el-input
            v-model="searchQuery"
            placeholder="搜索配置键名/描述..."
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <Icon icon="ep:search" />
            </template>
          </el-input>
        </el-col>
        <el-col :span="9" class="flex justify-end gap-10px">
          <el-button type="primary" @click="openForm('create')" v-hasPermi="['kb:rag-config:create']">
            <Icon icon="ep:plus" class="mr-5px" /> 新建配置
          </el-button>
          <el-button @click="handleRefreshCache">
            <Icon icon="ep:refresh" class="mr-5px" /> 刷新缓存
          </el-button>
        </el-col>
      </el-row>
    </ContentWrap>

    <!-- 配置卡片展示区 -->
    <div class="rag-cards-section">
      <!-- 第一张卡片：新建配置 -->
      <div class="rag-card create-card" @click="openForm('create')">
        <div class="card-content">
          <div class="create-icon-wrap">
            <Icon icon="ep:plus" :size="28" color="var(--el-color-primary)" />
          </div>
          <div class="create-text">创建RAG配置</div>
          <div class="create-subtext">添加新的系统配置项</div>
        </div>
      </div>

      <!-- 配置卡片 -->
      <div
        v-for="config in configList"
        :key="config.id"
        class="rag-card"
        :class="{ inactive: config.isActive === 0 }"
      >
        <!-- 卡片头部 -->
        <div class="card-header">
          <div class="header-left">
            <el-tag :type="getModuleTagType(config.module)" size="small" class="text-10px">
              {{ getModuleDisplay(config.module) }}
            </el-tag>
            <span class="config-key">{{ config.key }}</span>
          </div>
          <div class="header-right">
            <span class="status-badge" :class="config.isActive ? 'active' : 'inactive'">
              {{ config.isActive ? '启用' : '停用' }}
            </span>
            <el-dropdown @command="(cmd: string) => handleCardCommand(cmd, config)" trigger="click">
              <span @click.stop>
                <Icon icon="ep:more-filled" :size="14" class="card-menu-icon" />
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="toggle-status">
                    {{ config.isActive ? '停用' : '启用' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 卡片内容 -->
        <div class="card-body">
          <div class="value-display">
            <span class="value-label">{{ getValueTypeLabel(config.valueType) }}：</span>
            <span class="value-content">
              <template v-if="config.valueType === 'bool'">
                <el-tag :type="config.typedValue ? 'success' : 'danger'" size="small">
                  {{ config.typedValue ? '是' : '否' }}
                </el-tag>
              </template>
              <template v-else-if="config.valueType === 'json'">
                <pre class="json-preview">{{ formatJsonPreview(config.typedValue) }}</pre>
              </template>
              <template v-else>
                {{ config.typedValue }}
              </template>
            </span>
          </div>
          <div class="description" :title="config.description">
            {{ config.description || '暂无描述' }}
          </div>
        </div>

        <!-- 卡片底部 -->
        <div class="card-footer">
          <span class="update-time">更新于 {{ formatDate(config.updateTime) }}</span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <ContentWrap v-if="configList.length === 0 && !loading">
      <el-empty description="暂无RAG配置">
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
        @pagination="loadConfigs"
      />
    </ContentWrap>

    <!-- 创建/编辑对话框（内联） -->
    <Dialog v-model="dialogVisible" :title="dialogTitle" width="700px">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        v-loading="formLoading"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="模块" prop="module">
              <el-select
                v-model="formData.module"
                placeholder="请选择模块"
                class="w-full"
                :disabled="dialogMode === 'edit'"
              >
                <el-option
                  v-for="item in moduleOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="配置键名" prop="key">
              <el-input
                v-model="formData.key"
                placeholder="例如：top_k"
                :disabled="dialogMode === 'edit'"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="值类型" prop="valueType">
              <el-select v-model="formData.valueType" placeholder="请选择值类型" class="w-full" @change="onValueTypeChange">
                <el-option
                  v-for="item in valueTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-switch
                v-model="formData.isActiveBool"
                active-text="启用"
                inactive-text="停用"
                :active-value="1"
                :inactive-value="0"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <!-- 类型感知的值编辑器 -->
        <el-form-item label="配置值" prop="value">
          <template v-if="formData.valueType === 'bool'">
            <el-switch v-model="boolValue" active-text="true" inactive-text="false" />
          </template>
          <template v-else-if="formData.valueType === 'json'">
            <div class="json-editor-wrapper">
              <el-input
                v-model="jsonString"
                type="textarea"
                :rows="6"
                placeholder='{"key": "value"}'
              />
              <div class="json-toolbar">
                <el-button size="small" @click="formatJson">格式化</el-button>
                <el-button size="small" @click="validateJsonInput">校验</el-button>
              </div>
            </div>
          </template>
          <template v-else-if="formData.valueType === 'int'">
            <el-input-number v-model="intValue" :min="0" controls-position="right" class="w-full" />
          </template>
          <template v-else-if="formData.valueType === 'float'">
            <el-input-number v-model="floatValue" :min="0" :precision="2" controls-position="right" class="w-full" />
          </template>
          <template v-else>
            <el-input v-model="strValue" placeholder="请输入配置值" />
          </template>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            placeholder="请输入配置说明"
            :rows="2"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="formData.sortOrder" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false" :disabled="formLoading">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="formLoading">
          {{ formLoading ? '保存中...' : '确定' }}
        </el-button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useMessage } from '@/hooks/web/useMessage'
import { RAGConfigApi, type RAGConfig } from '@/api/kb/ragconfig'

defineOptions({ name: 'KbRagConfig' })

const message = useMessage()

// ==================== 搜索和过滤 ====================
const searchQuery = ref('')
const moduleFilter = ref('')
const statusFilter = ref<number | undefined>(undefined)

// ==================== 分页 ====================
const queryParams = reactive({
  pageNo: 1,
  pageSize: 12
})

// ==================== 数据 ====================
const configList = ref<RAGConfig[]>([])
const totalCount = ref(0)
const loading = ref(true)

// ==================== 模块和值类型选项 ====================
const moduleOptions = [
  { value: 'retrieval', label: '检索模块' },
  { value: 'rerank', label: '重排序模块' },
  { value: 'chunking', label: '切片模块' },
  { value: 'llm', label: '大模型模块' },
  { value: 'cache', label: '缓存模块' },
  { value: 'batch', label: '批量处理模块' },
  { value: 'conversation', label: '对话模块' }
]

const valueTypeOptions = [
  { value: 'int', label: '整数' },
  { value: 'float', label: '浮点数' },
  { value: 'bool', label: '布尔值' },
  { value: 'str', label: '字符串' },
  { value: 'json', label: 'JSON对象' }
]

const moduleDisplayMap: Record<string, string> = {
  retrieval: '检索模块', rerank: '重排序模块', chunking: '切片模块',
  llm: '大模型模块', cache: '缓存模块', batch: '批量处理模块',
  conversation: '对话模块'
}

const moduleTagMap: Record<string, string> = {
  retrieval: 'primary', rerank: 'success', chunking: 'warning',
  llm: 'danger', cache: 'info', batch: '', conversation: 'success'
}

// ==================== 表单相关 ====================
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const formLoading = ref(false)
const formRef = ref()
const dialogTitle = computed(() => dialogMode.value === 'create' ? '新增RAG配置' : '编辑RAG配置')

const defaultFormData = () => ({
  id: undefined as number | undefined,
  module: '',
  key: '',
  valueType: 'str' as string,
  value: '',
  description: '',
  isActiveBool: 1,
  sortOrder: 0
})

const formData = reactive(defaultFormData())

// 类型敏感的临时值
const boolValue = ref(false)
const intValue = ref(0)
const floatValue = ref(0)
const strValue = ref('')
const jsonString = ref('{}')

const formRules = reactive({
  module: [{ required: true, message: '请选择模块', trigger: 'change' }],
  key: [
    { required: true, message: '请输入配置键名', trigger: 'blur' },
    { max: 100, message: '配置键名最多100个字符', trigger: 'blur' }
  ],
  valueType: [{ required: true, message: '请选择值类型', trigger: 'change' }],
  value: [{ required: true, message: '请输入配置值', trigger: 'blur' }]
})

// ==================== 同步临时变量到 formData.value ====================
// 当用户修改各类型对应的临时变量时，自动同步到 formData.value
// 这样 Element Plus 表单验证才能正确检查 formData.value 是否为空
watch([boolValue, intValue, floatValue, strValue, jsonString], () => {
  syncValueToFormData()
})

// ==================== 加载数据 ====================
const loadConfigs = async () => {
  loading.value = true
  try {
    const params: any = {
      pageNo: queryParams.pageNo,
      pageSize: queryParams.pageSize,
      search: searchQuery.value || undefined,
      module: moduleFilter.value || undefined,
      isActive: statusFilter.value !== undefined ? statusFilter.value : undefined
    }
    const data = await RAGConfigApi.getPage(params)
    configList.value = data.list || []
    totalCount.value = data.total || 0
  } catch (e) {
    console.error('加载RAG配置列表失败:', e)
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadConfigs()
})

const handleSearch = () => {
  queryParams.pageNo = 1
  loadConfigs()
}

const handleFilterChange = () => {
  queryParams.pageNo = 1
  loadConfigs()
}

// ==================== 表单操作 ====================
const resetForm = () => {
  Object.assign(formData, defaultFormData())
  boolValue.value = false
  intValue.value = 0
  floatValue.value = 0
  strValue.value = ''
  jsonString.value = '{}'
  formRef.value?.resetFields()
}

const setValueByType = (type: string, rawValue: string) => {
  if (type === 'bool') {
    boolValue.value = rawValue === 'true' || rawValue === '1'
    formData.value = rawValue
  } else if (type === 'int') {
    intValue.value = parseInt(rawValue, 10) || 0
    formData.value = String(intValue.value)
  } else if (type === 'float') {
    floatValue.value = parseFloat(rawValue) || 0
    formData.value = String(floatValue.value)
  } else if (type === 'json') {
    try {
      const parsed = JSON.parse(rawValue)
      jsonString.value = JSON.stringify(parsed, null, 2)
      formData.value = rawValue
    } catch {
      jsonString.value = rawValue
      formData.value = rawValue
    }
  } else {
    strValue.value = rawValue
    formData.value = rawValue
  }
}

const syncValueToFormData = () => {
  const type = formData.valueType
  if (type === 'bool') {
    formData.value = boolValue.value ? 'true' : 'false'
  } else if (type === 'int') {
    formData.value = String(intValue.value)
  } else if (type === 'float') {
    formData.value = String(floatValue.value)
  } else if (type === 'json') {
    formData.value = jsonString.value
  } else {
    formData.value = strValue.value
  }
}

const onValueTypeChange = () => {
  syncValueToFormData()
}

const openForm = async (type: 'create' | 'update', row?: RAGConfig) => {
  dialogVisible.value = true
  dialogMode.value = type
  resetForm()
  if (type === 'update' && row) {
    formLoading.value = true
    try {
      const res = await RAGConfigApi.get(row.id)
      const data = res
      Object.assign(formData, {
        id: data.id,
        module: data.module,
        key: data.key,
        valueType: data.valueType,
        description: data.description || '',
        isActiveBool: data.isActive !== undefined ? data.isActive : 1,
        sortOrder: data.sortOrder || 0
      })
      setValueByType(data.valueType, data.value)
    } finally {
      formLoading.value = false
    }
  }
}

const formatJson = () => {
  try {
    const obj = JSON.parse(jsonString.value)
    jsonString.value = JSON.stringify(obj, null, 2)
    message.success('格式化成功')
  } catch {
    message.error('JSON格式错误，无法格式化')
  }
}

const validateJsonInput = () => {
  try {
    JSON.parse(jsonString.value)
    message.success('JSON格式正确')
  } catch (e: any) {
    message.error(`JSON格式错误：${e.message}`)
  }
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  syncValueToFormData()

  // JSON 类型额外校验
  if (formData.valueType === 'json') {
    try {
      JSON.parse(formData.value)
    } catch {
      message.error('JSON值格式错误，请检查')
      return
    }
  }

  formLoading.value = true
  try {
    const params: any = {
      module: formData.module,
      key: formData.key,
      value: formData.value,
      valueType: formData.valueType,
      description: formData.description,
      isActive: formData.isActiveBool,
      sortOrder: Number(formData.sortOrder) || 0
    }
    if (dialogMode.value === 'create') {
      await RAGConfigApi.create(params)
      message.success('创建成功')
    } else {
      params.id = formData.id
      await RAGConfigApi.update(params)
      message.success('更新成功')
    }
    dialogVisible.value = false
    loadConfigs()
  } finally {
    formLoading.value = false
  }
}

// ==================== 卡片操作 ====================
const handleCardCommand = async (command: string, config: RAGConfig) => {
  switch (command) {
    case 'edit':
      openForm('update', config)
      break
    case 'toggle-status':
      await toggleStatus(config)
      break
    case 'delete':
      await handleDelete(config)
      break
  }
}

const toggleStatus = async (config: RAGConfig) => {
  try {
    const newStatus = config.isActive == 1 ? 0 : 1
    await RAGConfigApi.update({
      id: config.id,
      isActive: newStatus
    })
    message.success('操作成功')
    loadConfigs()
  } catch {
    message.error('操作失败')
  }
}

const handleDelete = async (config: RAGConfig) => {
  try {
    await ElMessageBox.confirm(
      `确定删除配置 "${config.key}" 吗？此操作不可恢复！`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await RAGConfigApi.delete(config.id)
    message.success('删除成功')
    loadConfigs()
  } catch {
    // 取消忽略
  }
}

const handleRefreshCache = async () => {
  try {
    await RAGConfigApi.refreshCache()
    message.success('缓存已刷新')
  } catch {
    message.error('刷新缓存失败')
  }
}

// ================== 辅助函数 ==================
const getModuleDisplay = (module?: string) => {
  if (!module) return '-'
  return moduleDisplayMap[module] || module
}

const getModuleTagType = (module?: string) => {
  if (!module) return ''
  return moduleTagMap[module] || ''
}

const getValueTypeLabel = (type?: string) => {
  const opt = valueTypeOptions.find(o => o.value === type)
  return opt ? opt.label : (type || '-')
}

const formatJsonPreview = (val: any) => {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') {
    const str = JSON.stringify(val, null, 2)
    return str.length > 100 ? str.substring(0, 100) + '...' : str
  }
  return String(val).length > 100 ? String(val).substring(0, 100) + '...' : String(val)
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
.rag-config-page {
  padding: 0;
}

/* ========== 卡片网格 ========== */
.rag-cards-section {
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
.rag-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid #eef2f6;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  min-height: 180px;

  &.inactive {
    opacity: 0.7;
    background-color: #fafbfc;

    .config-key {
      color: #909399;
    }
  }

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
}

/* ========== 创建卡片 ========== */
.create-card {
  background: #fafbfd;
  border: 2px dashed #e1e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;

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

  .header-left {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;

    .config-key {
      font-weight: 600;
      font-size: 14px;
      color: #1f2937;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .header-right {
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
  min-height: 0;

  .value-display {
    font-size: 13px;
    margin-bottom: 10px;
    .value-label {
      color: #6b7280;
    }
    .value-content {
      color: #1f2937;
      font-weight: 500;
      word-break: break-word;
      .json-preview {
        display: inline-block;
        background: #f5f7fa;
        padding: 4px 8px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        margin: 0;
        overflow: hidden;
        white-space: pre-wrap;
        max-width: 100%;
      }
    }
  }
  .description {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    min-height: 28px;
  }
}

/* ========== 卡片底部 ========== */
.card-footer {
  border-top: 1px solid #f0f2f5;
  padding-top: 10px;
  margin-top: auto;

  .update-time {
    font-size: 11px;
    color: #9ca3af;
  }
}

/* ========== JSON 编辑器 ========== */
.json-editor-wrapper {
  width: 100%;
  .json-toolbar {
    margin-top: 8px;
    display: flex;
    gap: 8px;
  }
}
</style>
