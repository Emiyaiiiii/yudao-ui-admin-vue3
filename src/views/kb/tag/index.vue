<template>
  <div class="tag-page">
    <!-- 搜索和过滤区域 -->
    <ContentWrap>
      <el-row :gutter="16">
        <el-col :span="6">
          <el-input
            v-model="searchQuery"
            placeholder="搜索标签名称..."
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
          <el-select v-model="typeFilter" placeholder="标签类型" clearable @change="handleFilterChange" class="w-full">
            <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="scopeFilter" placeholder="可见范围" clearable @change="handleFilterChange" class="w-full">
            <el-option label="全局可见" value="global" />
            <el-option label="个人可见" value="personal" />
          </el-select>
        </el-col>
        <el-col :span="10" class="flex justify-end">
          <el-button type="primary" @click="openCreate" v-hasPermi="['kb:tag:create']">
            <Icon icon="ep:plus" class="mr-5px" /> 新建标签
          </el-button>
        </el-col>
      </el-row>
    </ContentWrap>

    <!-- 标签卡片网格 -->
    <div v-loading="loading" class="tag-cards-section">
      <div v-for="tag in tagList" :key="tag.id" class="tag-card">
        <div class="tag-card-head">
          <span class="tag-color-dot" :style="{ backgroundColor: tag.color || '#007bff' }"></span>
          <span class="tag-name">{{ tag.name }}</span>
          <span class="tag-scope" :class="tag.ownerId == null ? 'global' : 'personal'">
            {{ tag.ownerId == null ? '全局可见' : '个人可见' }}
          </span>
        </div>
        <div class="tag-card-body">
          <el-tag size="small" :type="getTypeTagType(tag.type)" effect="plain" class="text-10px">
            {{ getTypeDisplay(tag.type) }}
          </el-tag>
          <span v-if="tag.ownerNickname" class="tag-owner">归属：{{ tag.ownerNickname }}</span>
          <span v-else-if="tag.ownerId == null" class="tag-owner">归属：全局</span>
        </div>
        <div class="tag-card-foot">
          <span class="tag-time">{{ formatDate(tag.createTime) }}</span>
          <div class="tag-actions">
            <el-button link size="small" @click="openEdit(tag)" v-hasPermi="['kb:tag:update']">
              <Icon icon="ep:edit" :size="14" />
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(tag)" v-hasPermi="['kb:tag:delete']">
              <Icon icon="ep:delete" :size="14" />
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <ContentWrap v-if="tagList.length === 0 && !loading">
      <el-empty description="暂无标签">
        <el-button type="primary" @click="openCreate" v-hasPermi="['kb:tag:create']">创建第一个标签</el-button>
      </el-empty>
    </ContentWrap>

    <!-- 分页 -->
    <ContentWrap v-if="total > 0">
      <Pagination
        :total="total"
        v-model:page="queryParams.pageNo"
        v-model:limit="queryParams.pageSize"
        :page-sizes="[12, 24, 36, 48]"
        @pagination="loadTags"
      />
    </ContentWrap>

    <!-- 创建/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'create' ? '新建标签' : '编辑标签'"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入标签名称" maxlength="100" show-word-limit clearable />
        </el-form-item>
        <el-form-item label="颜色" prop="color">
          <div class="color-picker-row">
            <el-color-picker v-model="form.color" />
            <div class="color-presets">
              <span
                v-for="c in colorPresets"
                :key="c"
                class="color-preset"
                :style="{ backgroundColor: c }"
                @click="form.color = c"
              ></span>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择标签类型" class="w-full">
            <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="可见范围">
          <el-switch
            v-model="form.isGlobal"
            active-text="全局可见"
            inactive-text="个人可见"
            inline-prompt
          />
          <div class="form-tip">全局标签对所有用户可见（仅管理员可设为全局）；个人标签仅本人可见。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useMessage } from '@/hooks/web/useMessage'
import { TagApi, type Tag } from '@/api/kb/tag'

defineOptions({ name: 'KbTag' })

const message = useMessage()

// 搜索和过滤
const searchQuery = ref('')
const typeFilter = ref('')
const scopeFilter = ref('')

// 分页
const queryParams = reactive({
  pageNo: 1,
  pageSize: 12
})

// 数据
const tagList = ref<Tag[]>([])
const total = ref(0)
const loading = ref(false)

// 弹窗
const dialogVisible = ref(false)
const dialogType = ref<'create' | 'update'>('create')
const submitting = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  id: undefined as number | undefined,
  name: '',
  color: '#007bff',
  type: 'document',
  isGlobal: false
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入标签名称', trigger: 'blur' }],
  color: [{ required: true, message: '请选择标签颜色', trigger: 'change' }],
  type: [{ required: true, message: '请选择标签类型', trigger: 'change' }]
}

// 颜色预设
const colorPresets = [
  '#007bff', '#28a745', '#dc3545', '#fd7e14', '#ffc107',
  '#6f42c1', '#17a2b8', '#20c997', '#e83e8c', '#6c757d'
]

// 类型选项
const typeOptions = [
  { label: '知识库标签', value: 'knowledge_base' },
  { label: '文档标签', value: 'document' },
  { label: '文档切片标签', value: 'chunk' },
  { label: '其他', value: 'other' }
]

const typeDisplayMap: Record<string, string> = {
  knowledge_base: '知识库标签',
  document: '文档标签',
  chunk: '文档切片标签',
  other: '其他'
}

const typeTagTypeMap: Record<string, string> = {
  knowledge_base: 'primary',
  document: 'success',
  chunk: 'warning',
  other: 'info'
}

const getTypeDisplay = (type?: string) => typeDisplayMap[type || ''] || type || '-'
const getTypeTagType = (type?: string) => typeTagTypeMap[type || ''] || ''

// 加载列表
const loadTags = async () => {
  loading.value = true
  try {
    const params: any = {
      pageNo: queryParams.pageNo,
      pageSize: queryParams.pageSize,
      name: searchQuery.value || undefined,
      type: typeFilter.value || undefined,
      scope: scopeFilter.value || undefined
    }
    const data = await TagApi.getPage(params)
    tagList.value = data.list || []
    total.value = data.total || 0
  } catch {
    message.error('加载标签列表失败')
  } finally {
    loading.value = false
  }
}

// 初始化
onMounted(() => {
  loadTags()
})

// 搜索
const handleSearch = () => {
  queryParams.pageNo = 1
  loadTags()
}

// 过滤
const handleFilterChange = () => {
  queryParams.pageNo = 1
  loadTags()
}

// 打开创建
const openCreate = () => {
  dialogType.value = 'create'
  form.id = undefined
  form.name = ''
  form.color = '#007bff'
  form.type = 'document'
  form.isGlobal = false
  dialogVisible.value = true
}

// 打开编辑
const openEdit = (tag: Tag) => {
  dialogType.value = 'update'
  form.id = tag.id
  form.name = tag.name
  form.color = tag.color || '#007bff'
  form.type = tag.type || 'other'
  form.isGlobal = tag.ownerId == null
  dialogVisible.value = true
}

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const payload = {
      id: form.id,
      name: form.name,
      color: form.color,
      type: form.type,
      isGlobal: form.isGlobal
    }
    if (dialogType.value === 'create') {
      await TagApi.createTag(payload)
      message.success('创建成功')
    } else {
      await TagApi.updateTag(payload)
      message.success('更新成功')
    }
    dialogVisible.value = false
    loadTags()
  } catch {
    // 校验失败或接口异常忽略
  } finally {
    submitting.value = false
  }
}

// 删除
const handleDelete = async (tag: Tag) => {
  try {
    await ElMessageBox.confirm(
      `确定删除标签 "${tag.name}" 吗？此操作不可恢复！`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await TagApi.deleteTag(tag.id)
    message.success('删除成功')
    loadTags()
  } catch {
    // 取消忽略
  }
}

// 时间格式化
const formatDate = (date?: number | string) => {
  if (!date) return '-'
  if (typeof date === 'number') {
    return new Date(date).toISOString().substring(0, 10)
  }
  return String(date).substring(0, 10)
}
</script>

<style scoped lang="scss">
.tag-page {
  padding: 0;
}

/* ========== 卡片网格 ========== */
.tag-cards-section {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(1, 1fr);
  margin: 16px 0;
  min-height: 120px;

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

/* ========== 卡片 ========== */
.tag-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid #eef2f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
    border-color: #d0ddf0;
  }
}

.tag-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  .tag-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .tag-name {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag-scope {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
    font-weight: 500;

    &.global {
      color: var(--el-color-primary);
      background: rgba(64, 158, 255, 0.1);
    }
    &.personal {
      color: #909399;
      background: rgba(144, 147, 153, 0.12);
    }
  }
}

.tag-card-body {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;

  .tag-owner {
    font-size: 12px;
    color: #909399;
  }
}

.tag-card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #f0f2f5;
  padding-top: 10px;
  margin-top: auto;

  .tag-time {
    font-size: 11px;
    color: #9ca3af;
  }
  .tag-actions {
    display: flex;
    gap: 4px;
  }
}

/* ========== 弹窗颜色选择 ========== */
.color-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.color-presets {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  .color-preset {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.1);
    transition: transform 0.15s ease;

    &:hover {
      transform: scale(1.2);
    }
  }
}
.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 6px;
}
</style>
