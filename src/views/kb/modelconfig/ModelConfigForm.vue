<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="750">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="110px"
      v-loading="formLoading"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="模型UID" prop="uid">
            <el-input v-model="formData.uid" placeholder="请输入模型唯一标识" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="模型名称" prop="name">
            <el-input v-model="formData.name" placeholder="请输入模型名称" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="用途分类" prop="modelType">
            <el-select v-model="formData.modelType" placeholder="请选择用途分类" class="w-full">
              <el-option label="大模型(LLM)" value="llm" />
              <el-option label="嵌入/向量(Embedding)" value="embedding" />
              <el-option label="OCR/多模态" value="ocr" />
              <el-option label="重排(Rerank)" value="rerank" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态">
            <el-switch
              v-model="formData.isActiveBool"
              active-text="激活"
              inactive-text="停用"
              :active-value="1"
              :inactive-value="0"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="具体模型名" prop="model">
        <el-input v-model="formData.model" placeholder="如 text-embedding-v4 / deepseek-chat / DeepSeek-OCR-2" />
      </el-form-item>
      <el-form-item label="API地址" prop="url">
        <el-input v-model="formData.url" placeholder="https://api.example.com/v1/chat/completions" />
      </el-form-item>
      <el-form-item label="API密钥" prop="appkey">
        <el-input
          v-model="formData.appkey"
          type="password"
          show-password
          placeholder="请输入API密钥"
        />
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="排序顺序">
            <el-input-number v-model="formData.sortOrder" :min="0" :max="9999" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="置顶">
            <el-switch
              v-model="formData.isPinnedBool"
              active-text="是"
              inactive-text="否"
              :active-value="1"
              :inactive-value="0"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="模型描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          placeholder="请输入模型描述"
          :rows="3"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="最大Token数">
            <el-input-number
              v-model="formData.maxTokens"
              :min="1"
              :max="1000000"
              class="w-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="上下文长度">
            <el-input-number
              v-model="formData.contextLength"
              :min="1"
              :max="1000000"
              class="w-full"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="温度参数">
            <el-slider
              v-model="formData.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              show-input
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Top-P参数">
            <el-slider
              v-model="formData.topP"
              :min="0"
              :max="1"
              :step="0.1"
              show-input
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="启用思考能力">
        <el-switch
          v-model="formData.thinkingEnabledBool"
          active-text="启用"
          inactive-text="禁用"
          :active-value="1"
          :inactive-value="0"
        />
      </el-form-item>
      <el-form-item v-if="formData.modelType === 'ocr'" label="OCR通道" prop="ocrKind">
        <el-select v-model="formData.ocrKind" placeholder="请选择 OCR 通道" class="w-full">
          <el-option label="MinerU 整篇版式解析" value="mineru" />
          <el-option label="DeepSeek 逐图OCR" value="deepseek_ocr" />
        </el-select>
      </el-form-item>
      <el-form-item v-else label="支持多模态(VL)">
        <el-switch
          v-model="formData.vlSupportedBool"
          active-text="是"
          inactive-text="否"
        />
      </el-form-item>
      <el-form-item label="配置参数(JSON)">
        <el-input
          v-model="formData.configStr"
          type="textarea"
          placeholder='{"provider": "openai", "stream": true}'
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
import { useI18n } from '@/hooks/web/useI18n'
import { ModelConfigApi, type ModelConfig } from '@/api/kb/modelconfig'

defineOptions({ name: 'ModelConfigForm' })

const message = useMessage()
const { t } = useI18n()

const dialogVisible = ref(false)
const formLoading = ref(false)
const formType = ref<'create' | 'update'>('create')
const formRef = ref()

const dialogTitle = computed(() => {
  return formType.value === 'create' ? '创建模型配置' : '编辑模型配置'
})

const defaultFormData = () => ({
  id: undefined as number | undefined,
  uid: '',
  model: '',
  modelType: 'llm',
  name: '',
  url: '',
  appkey: '',
  thinkingEnabledBool: 0,
  vlSupportedBool: false,
  ocrKind: 'deepseek_ocr',
  isActiveBool: 1,
  description: '',
  maxTokens: 4096,
  contextLength: 8192,
  temperature: 0.7,
  topP: 0.9,
  configStr: '{}',
  sortOrder: 0,
  isPinnedBool: 0
})

const formData = reactive(defaultFormData())

const formRules = reactive({
  uid: [
    { required: true, message: '请输入模型UID', trigger: 'blur' },
    { min: 1, max: 100, message: '模型UID长度在1-100个字符之间', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入模型名称', trigger: 'blur' },
    { max: 100, message: '模型名称最多100个字符', trigger: 'blur' }
  ],
  url: [
    { required: true, message: '请输入API地址', trigger: 'blur' },
    { pattern: /^https?:\/\/.+/, message: '请输入有效的URL地址，以http://或https://开头', trigger: 'blur' }
  ],
  appkey: [
    { required: true, message: '请输入API密钥', trigger: 'blur' },
    { min: 10, message: 'API密钥长度至少为10个字符', trigger: 'blur' }
  ],
  modelType: [
    { required: true, message: '请选择用途分类', trigger: 'change' }
  ]
})

const emit = defineEmits(['success'])

const resetForm = () => {
  Object.assign(formData, defaultFormData())
  formRef.value?.resetFields()
}

const open = async (type: 'create' | 'update', row?: ModelConfig) => {
  dialogVisible.value = true
  formType.value = type
  resetForm()
  if (type === 'update' && row) {
    formLoading.value = true
    try {
      const res = await ModelConfigApi.get(row.id)
      const data = res
      // OCR 通道从 config JSON 的 ocr_kind 读取，缺省 deepseek_ocr
      let ocrKind = 'deepseek_ocr'
      try {
        const cfgObj = JSON.parse(data.config || '{}')
        if (cfgObj.ocr_kind) ocrKind = String(cfgObj.ocr_kind)
      } catch (e) {
        // 忽略解析失败，沿用默认值
      }
      Object.assign(formData, {
        id: data.id,
        uid: data.uid,
        model: data.model || '',
        modelType: data.modelType || 'llm',
        name: data.name,
        url: data.url,
        appkey: data.appkey,
        thinkingEnabledBool: data.thinkingEnabled || 0,
        vlSupportedBool: !!data.vlSupported,
        ocrKind,
        isActiveBool: data.isActive || 0,
        description: data.description || '',
        maxTokens: data.maxTokens || 4096,
        contextLength: data.contextLength || 8192,
        temperature: data.temperature || 0.7,
        topP: data.topP || 0.9,
        configStr: data.config || '{}',
        sortOrder: data.sortOrder || 0,
        isPinnedBool: data.isPinned || 0
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
    // OCR 通道写入 config JSON 的 ocr_kind（后端 resolveOcrKind 从 config 读取）
    let configObj: any = {}
    try {
      configObj = JSON.parse(formData.configStr || '{}')
    } catch (e) {
      configObj = {}
    }
    if (formData.modelType === 'ocr') {
      configObj.ocr_kind = formData.ocrKind
    } else if ('ocr_kind' in configObj) {
      delete configObj.ocr_kind
    }
    const params: any = {
      uid: formData.uid,
      model: formData.model,
      modelType: formData.modelType,
      name: formData.name,
      url: formData.url,
      appkey: formData.appkey,
      thinkingEnabled: formData.thinkingEnabledBool,
      vlSupported: formData.vlSupportedBool,
      isActive: formData.isActiveBool,
      description: formData.description,
      maxTokens: formData.maxTokens,
      contextLength: formData.contextLength,
      temperature: formData.temperature,
      topP: formData.topP,
      config: JSON.stringify(configObj) || '{}',
      sortOrder: formData.sortOrder || 0,
      isPinned: formData.isPinnedBool
    }
    if (formType.value === 'create') {
      await ModelConfigApi.create(params)
      message.success('创建成功')
    } else {
      params.id = formData.id
      await ModelConfigApi.update(params)
      message.success('更新成功')
    }
    dialogVisible.value = false
    emit('success')
  } finally {
    formLoading.value = false
  }
}
</script>
