<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="820">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
      v-loading="formLoading"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="方法名称" prop="name">
            <el-input v-model="formData.name" placeholder="请输入方法名称" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="方法代码" prop="code">
            <el-input v-model="formData.code" placeholder="随方法类型自动填充" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="方法类型" prop="methodType">
            <el-select v-model="formData.methodType" placeholder="请选择方法类型" class="w-full">
              <el-option
                v-for="item in methodTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <span>{{ item.label }}</span>
                <span class="method-type-desc">（{{ item.desc }}）</span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="设为默认方法">
            <el-switch
              v-model="formData.isDefaultMethodBool"
              active-text="是"
              inactive-text="否"
              :active-value="1"
              :inactive-value="0"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="方法描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          placeholder="请描述该方法的适用场景"
          :rows="2"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="处理器类">
        <el-input v-model="formData.handlerClass" placeholder="预留：Java 处理器类全路径（当前未使用）" />
      </el-form-item>

      <!-- 切片参数（结构化） -->
      <el-divider content-position="left">切片参数</el-divider>
      <el-form-item label="说明">
        <span class="param-tip">
          方法类型决定切分策略；以下参数与启动切分有关。块间重叠建议不超过单块大小的一半。
        </span>
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="单块大小(字符)" prop="chunkSize">
            <el-input-number v-model="formData.chunkSize" :min="100" :max="4000" :step="50" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="块间重叠(字符)" prop="chunkOverlap">
            <el-input-number v-model="formData.chunkOverlap" :min="0" :max="2000" :step="20" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="最小块长度" prop="minChunkSize">
            <el-input-number v-model="formData.minChunkSize" :min="50" :max="1000" :step="10" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="最大块长度" prop="maxChunkSize">
            <el-input-number v-model="formData.maxChunkSize" :min="500" :max="8000" :step="100" class="w-full" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="扩展参数(JSON)">
        <el-input
          v-model="formData.advancedParamsStr"
          type="textarea"
          placeholder='可选，预留后续扩展；当前 python-vector 生效参数为：strategy、chunk_size、chunk_overlap、min_chunk_size、max_chunk_size'
          :rows="2"
          class="w-full"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false" :disabled="formLoading">取消</el-button>
      <el-button type="primary" @click="submitForm" :loading="formLoading">
        {{ formLoading ? '保存中...' : '确定' }}
      </el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useMessage } from '@/hooks/web/useMessage'
import { ChunkMethodApi, type ChunkMethod } from '@/api/kb/chunkmethod'

defineOptions({ name: 'ChunkMethodForm' })

const message = useMessage()

const dialogVisible = ref(false)
const formLoading = ref(false)
const formType = ref<'create' | 'update'>('create')
const formRef = ref()

const dialogTitle = computed(() => {
  return formType.value === 'create' ? '新增切片方法' : '编辑切片方法'
})

const defaultFormData = () => ({
  id: undefined as number | undefined,
  name: '',
  code: '',
  methodType: 'fixed_size',
  description: '',
  handlerClass: '',
  isDefaultMethodBool: 0,
  chunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
  maxChunkSize: 2000,
  advancedParamsStr: ''
})

const formData = reactive(defaultFormData())

const formRules = reactive({
  name: [
    { required: true, message: '请输入方法名称', trigger: 'blur' },
    { max: 100, message: '方法名称最多100个字符', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入方法代码', trigger: 'blur' },
    { max: 50, message: '方法代码最多50个字符', trigger: 'blur' }
  ],
  methodType: [{ required: true, message: '请选择方法类型', trigger: 'change' }],
  chunkSize: [{ required: true, message: '请设置单块大小', trigger: 'blur' }],
  chunkOverlap: [{ required: true, message: '请设置块间重叠', trigger: 'blur' }]
})

// 仅列出 python-vector 端真实支持的切分策略（ChunkerFactory）
const methodTypeOptions = [
  { label: '固定大小', value: 'fixed_size', desc: '按字符数均匀切分，通用' },
  { label: '按句子', value: 'sentence', desc: '向最近句读边界对齐' },
  { label: '按段落', value: 'paragraph', desc: '向段落边界对齐' },
  { label: '递归分割', value: 'recursive', desc: '按分隔符层级递归切分' },
  { label: '语义分段', value: 'semantic', desc: '按语义相似度合并（需嵌入模型）' }
]
const methodTypeValues = methodTypeOptions.map((o) => o.value)

// 方法类型切换时自动同步 code，保证下发 strategy 与所选类型一致
watch(
  () => formData.methodType,
  (val, old) => {
    if (!val) return
    if (!formData.code || methodTypeValues.includes(formData.code) || formData.code === old) {
      formData.code = val
    }
  }
)

const emit = defineEmits(['success'])

const resetForm = () => {
  Object.assign(formData, defaultFormData())
  formRef.value?.resetFields()
}

const CORE_KEYS = ['strategy', 'chunk_size', 'chunk_overlap', 'min_chunk_size', 'max_chunk_size']

const open = async (type: 'create' | 'update', row?: ChunkMethod) => {
  dialogVisible.value = true
  formType.value = type
  resetForm()
  if (type === 'update' && row) {
    formLoading.value = true
    try {
      const data = await ChunkMethodApi.get(row.id)
      Object.assign(formData, {
        id: data.id,
        name: data.name,
        code: data.code,
        methodType: data.methodType || 'fixed_size',
        description: data.description || '',
        handlerClass: data.handlerClass || '',
        isDefaultMethodBool: data.isDefaultMethod || 0
      })
      // 解析 defaultParameters：(core 字段填入结构化输入，其余归入高级参数)
      let params: Record<string, any> = {}
      if (data.defaultParameters) {
        try {
          params = JSON.parse(data.defaultParameters)
        } catch {
          params = {}
        }
      }
      formData.chunkSize = params.chunk_size ?? 1000
      formData.chunkOverlap = params.chunk_overlap ?? 200
      formData.minChunkSize = params.min_chunk_size ?? 100
      formData.maxChunkSize = params.max_chunk_size ?? 2000
      const advanced: Record<string, any> = {}
      for (const k of Object.keys(params)) {
        if (!CORE_KEYS.includes(k) && params[k] !== null && params[k] !== undefined) {
          advanced[k] = params[k]
        }
      }
      formData.advancedParamsStr = Object.keys(advanced).length ? JSON.stringify(advanced, null, 2) : ''
      // 若 methodType 非真实支持值，回退 fixed_size 并启用自动同步 code
      if (!methodTypeValues.includes(formData.methodType)) {
        formData.methodType = 'fixed_size'
        formData.code = 'fixed_size'
      }
    } finally {
      formLoading.value = false
    }
  }
}

defineExpose({ open })

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  // 参数合法性：单块大小须在 [最小,最大] 内，重叠须小于单块大小
  if (formData.chunkSize > formData.maxChunkSize || formData.chunkSize < formData.minChunkSize) {
    message.warning('单块大小应介于最小块长度与最大块长度之间')
    return
  }
  if (formData.chunkOverlap >= formData.chunkSize) {
    message.warning('块间重叠应小于单块大小')
    return
  }

  // 组装 defaultParameters：策略 + 核心数字参数 + 高级参数（仅补入非核心键）
  const defaultParams: Record<string, any> = {
    strategy: formData.methodType,
    chunk_size: formData.chunkSize,
    chunk_overlap: formData.chunkOverlap,
    min_chunk_size: formData.minChunkSize,
    max_chunk_size: formData.maxChunkSize
  }
  if (formData.advancedParamsStr.trim()) {
    try {
      const adv = JSON.parse(formData.advancedParamsStr)
      if (adv && typeof adv === 'object' && !Array.isArray(adv)) {
        for (const k of Object.keys(adv)) {
          if (adv[k] !== null && adv[k] !== undefined && !(k in defaultParams)) {
            defaultParams[k] = adv[k]
          }
        }
      }
    } catch {
      message.warning('高级参数 JSON 格式不合法，已忽略该字段')
    }
  }

  formLoading.value = true
  try {
    const params: any = {
      name: formData.name,
      code: formData.code,
      methodType: formData.methodType,
      description: formData.description,
      handlerClass: formData.handlerClass,
      isActive: 1,
      isDefaultMethod: formData.isDefaultMethodBool,
      parametersTemplate: '{}',
      defaultParameters: JSON.stringify(defaultParams)
    }
    if (formType.value === 'create') {
      await ChunkMethodApi.create(params)
      message.success('创建成功')
    } else {
      params.id = formData.id
      await ChunkMethodApi.update(params)
      message.success('更新成功')
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.method-type-desc {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-left: 8px;
}
.param-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}
</style>