<template>
  <Dialog v-model="dialogVisible" :title="dialogTitle" width="750">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="110px"
      v-loading="formLoading"
    >
      <el-row v-if="!isMineruMode" :gutter="20">
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
              <el-option label="MinerU(文档解析)" value="mineru" />
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
      <el-form-item
        v-if="!isMineruMode"
        label="具体模型名"
        prop="model"
      >
        <el-input v-model="formData.model" placeholder="如 text-embedding-v4 / deepseek-chat / DeepSeek-OCR-2" />
      </el-form-item>
      <el-form-item :label="isMineruMode ? (formData.mineruMode === 'v1' ? '服务根地址(V1)' : '云端地址') : 'API地址'" prop="url">
        <el-input
          v-model="formData.url"
          :placeholder="isMineruMode ? (formData.mineruMode === 'v1' ? 'http://mineru-host:8000（/v1 之前，不含 /v1）' : 'https://mineru.net/api/v4') : 'https://api.example.com/v1/chat/completions'"
        />
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
      <el-form-item v-if="['llm', 'embedding', 'rerank'].includes(formData.modelType)" label="支持多模态(VL)">
        <el-switch
          v-model="formData.vlSupportedBool"
          active-text="是"
          inactive-text="否"
          :active-value="1"
          :inactive-value="0"
        />
      </el-form-item>
      <template v-if="formData.modelType === 'mineru'">
        <el-form-item label="接入方式">
          <el-select v-model="formData.mineruMode" placeholder="选择接入方式" class="w-full">
            <el-option label="云端 v4（默认，填 key 即用）" value="v4" />
            <el-option label="自部署 V1（本地文件路径）" value="v1" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="formData.mineruMode === 'v1'" label="解析档位">
          <el-select v-model="formData.mineruTier" placeholder="选择档位" class="w-full">
            <el-option label="flash（快速，不需额外模型环境）" value="flash" />
            <el-option label="standard" value="standard" />
            <el-option label="advanced（高质量版式）" value="advanced" />
          </el-select>
        </el-form-item>
        <el-form-item v-else label="模型版本">
          <el-select v-model="formData.mineruModelVersion" placeholder="选择模型版本（缺省会自适应）" class="w-full">
            <el-option label="vlm（推荐，默认）" value="vlm" />
            <el-option label="pipeline" value="pipeline" />
            <el-option label="MinerU-HTML" value="MinerU-HTML" />
            <el-option label="自适应（不指定）" value="" />
          </el-select>
        </el-form-item>
      </template>
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

// MinerU 专用模式：独立分类 modelType=mineru（文档解析通道，非 OCR），隐藏 uid/name，渲染专用字段
const isMineruMode = computed(() => formData.modelType === 'mineru')

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
  mineruMode: 'v4',
  mineruTier: 'flash',
  mineruModelVersion: 'vlm',
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
    {
      validator: (rule, value, callback) => {
        // MinerU 分类不需要模型UID（提交时自动生成）
        if (isMineruMode.value) {
          callback()
        } else if (!value) {
          callback(new Error('请输入模型UID'))
        } else if (value.length > 100) {
          callback(new Error('模型UID长度在1-100个字符之间'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  name: [
    {
      validator: (rule, value, callback) => {
        if (isMineruMode.value) {
          callback()
        } else if (!value) {
          callback(new Error('请输入模型名称'))
        } else if (value.length > 100) {
          callback(new Error('模型名称最多100个字符'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  url: [
    { required: true, message: '请输入API地址', trigger: 'blur' },
    { pattern: /^https?:\/\/.+/, message: '请输入有效的URL地址，以http://或https://开头', trigger: 'blur' }
  ],
  appkey: [
    {
      validator: (rule, value, callback) => {
        // MinerU 自部署 V1 允许留空（匿名鉴权）；云端 v4 及其余用途 appkey 必填且长度≥10
        const allowEmpty = isMineruMode.value && formData.mineruMode === 'v1'
        if (!value && !allowEmpty) {
          callback(new Error('请输入API密钥'))
        } else if (value && value.length < 10 && !allowEmpty) {
          callback(new Error('API密钥长度至少为10个字符'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
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

const open = async (type: 'create' | 'update', row?: ModelConfig, initModelType?: string) => {
  dialogVisible.value = true
  formType.value = type
  resetForm()
  // 支持从能力级别就绪矩阵「去配置」预选用途分类
  if (type === 'create' && initModelType) {
    formData.modelType = initModelType
  }
  if (type === 'update' && row) {
    formLoading.value = true
    try {
      const res = await ModelConfigApi.get(row.id)
      const data = res
      // OCR 通道从 config JSON 的 ocr_kind 读取，缺省 deepseek_ocr
      let ocrKind = 'deepseek_ocr'
      let mineruMode = 'v4'
      let mineruTier = 'flash'
      let mineruModelVersion = 'vlm'
      try {
        const cfgObj = JSON.parse(data.config || '{}')
        if (cfgObj.ocr_kind) ocrKind = String(cfgObj.ocr_kind)
        if (cfgObj.mineru_mode) mineruMode = String(cfgObj.mineru_mode)
        if (cfgObj.mineru_tier) mineruTier = String(cfgObj.mineru_tier)
        if (cfgObj.mineru_model_version != null) mineruModelVersion = String(cfgObj.mineru_model_version)
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
        mineruMode,
        mineruTier,
        mineruModelVersion,
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
    if (formData.modelType === 'mineru') {
      // MinerU 独立分类：config JSON 只写接入方式/档位(v1)/模型版本(v4)，不设 ocr_kind
      configObj.mineru_mode = formData.mineruMode
      delete configObj.ocr_kind
      if (formData.mineruMode === 'v1') {
        configObj.mineru_tier = formData.mineruTier
        delete configObj.mineru_model_version
      } else {
        configObj.mineru_model_version = formData.mineruModelVersion
        delete configObj.mineru_tier
      }
    } else if (formData.modelType === 'ocr') {
      configObj.ocr_kind = formData.ocrKind
      delete configObj.mineru_mode
      delete configObj.mineru_tier
      delete configObj.mineru_model_version
    } else if ('ocr_kind' in configObj) {
      delete configObj.ocr_kind
      delete configObj.mineru_mode
      delete configObj.mineru_tier
      delete configObj.mineru_model_version
    }
    // MinerU 分类：模型UID/名称非必填且表单隐藏，提交时自动生成，保证后端 uid 唯一
    const mineruUid = isMineruMode.value && !formData.uid
      ? `mineru_${Math.random().toString(16).slice(2, 10)}`
      : formData.uid
    const mineruName = isMineruMode.value && !formData.name ? 'MinerU' : formData.name
    const params: any = {
      uid: mineruUid,
      model: isMineruMode.value ? 'mineru' : formData.model,
      modelType: formData.modelType,
      name: mineruName,
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
