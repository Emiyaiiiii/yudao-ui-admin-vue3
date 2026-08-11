<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="800">
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
            <el-input v-model="formData.code" placeholder="请输入方法代码（英文）" />
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
      <el-form-item label="方法描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          placeholder="请输入方法描述"
          :rows="2"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="处理器类">
        <el-input v-model="formData.handlerClass" placeholder="例如：cn.iocoder.yudao.module.kb.service.chunk.ChunkMethodService" />
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="处理速度(千字/秒)">
            <el-input-number
              v-model="formData.avgProcessingSpeed"
              :min="0.1"
              :max="1000"
              :step="0.1"
              :precision="1"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="内存占用(MB)">
            <el-input-number
              v-model="formData.memoryFootprint"
              :min="1"
              :max="10000"
              :step="10"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="设为默认方法">
        <el-switch
          v-model="formData.isDefaultMethodBool"
          active-text="是"
          inactive-text="否"
          :active-value="1"
          :inactive-value="0"
        />
      </el-form-item>
      <el-form-item label="参数模板(JSON)">
        <el-input
          v-model="formData.parametersTemplateStr"
          type="textarea"
          placeholder='{"type":"object","properties":{"chunk_size":{"type":"integer","title":"分块大小","default":1000}}}'
          :rows="3"
        />
      </el-form-item>
      <el-form-item label="默认参数(JSON)">
        <el-input
          v-model="formData.defaultParametersStr"
          type="textarea"
          placeholder='{"chunk_size":1000,"chunk_overlap":200}'
          :rows="3"
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
import { ref, reactive, computed } from 'vue'
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
  methodType: '',
  description: '',
  handlerClass: '',
  isActiveBool: 1,
  isDefaultMethodBool: 0,
  avgProcessingSpeed: 1.0,
  memoryFootprint: 100,
  parametersTemplateStr: '',
  defaultParametersStr: ''
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
  methodType: [
    { required: true, message: '请选择方法类型', trigger: 'change' }
  ]
})

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

const emit = defineEmits(['success'])

const resetForm = () => {
  Object.assign(formData, defaultFormData())
  formRef.value?.resetFields()
}

const open = async (type: 'create' | 'update', row?: ChunkMethod) => {
  dialogVisible.value = true
  formType.value = type
  resetForm()
  if (type === 'update' && row) {
    formLoading.value = true
    try {
      const res = await ChunkMethodApi.get(row.id)
      const data = res
      Object.assign(formData, {
        id: data.id,
        name: data.name,
        code: data.code,
        methodType: data.methodType,
        description: data.description || '',
        handlerClass: data.handlerClass || '',
        isActiveBool: data.isActive !== undefined ? data.isActive : 1,
        isDefaultMethodBool: data.isDefaultMethod || 0,
        avgProcessingSpeed: data.avgProcessingSpeed || 1.0,
        memoryFootprint: data.memoryFootprint || 100,
        parametersTemplateStr: data.parametersTemplate || '',
        defaultParametersStr: data.defaultParameters || ''
      })
    } finally {
      formLoading.value = false
    }
  }
}

defineExpose({ open })

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  formLoading.value = true
  try {
    const params: any = {
      name: formData.name,
      code: formData.code,
      methodType: formData.methodType,
      description: formData.description,
      handlerClass: formData.handlerClass,
      isActive: formData.isActiveBool,
      isDefaultMethod: formData.isDefaultMethodBool,
      avgProcessingSpeed: Number(formData.avgProcessingSpeed) || 1.0,
      memoryFootprint: Number(formData.memoryFootprint) || 100,
      parametersTemplate: formData.parametersTemplateStr || '{}',
      defaultParameters: formData.defaultParametersStr || '{}'
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
