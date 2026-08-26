<template>
  <ContentWrap>
    <!-- 搜索 -->
    <el-form class="-mb-15px" :model="queryParams" inline label-width="80px">
      <el-form-item label="Provider">
        <el-input v-model="queryParams.search" placeholder="搜索 Provider 或模型" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button type="primary" @click="openCustomProviderDialog" v-hasPermi="['ai-agent:model:create']">
          <Icon icon="ep:plus" class="mr-5px" /> 自定义 Provider
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 默认 LLM 常驻条 -->
  <ContentWrap :body-style="{ padding: '0px' }" class="mt-16px">
    <div class="flex justify-between items-center"
         style="padding:12px 16px;background:var(--el-fill-color-light);border:1px solid var(--el-border-color-lighter);border-radius:8px;cursor:pointer"
         @click="openLlmDialog">
      <div class="flex items-center">
        <span class="inline-block mr-8px" :style="{width:'10px',height:'10px',borderRadius:'50%',background: defaultLlm?.model ? '#10b981' : '#9ca3af'}"></span>
        <span class="text-13px text-[var(--el-text-color-regular)] mr-8px">默认 LLM：</span>
        <span class="text-14px font-bold">{{ defaultLlm?.model ? `${displayProviderName(defaultLlm.providerId)} / ${defaultLlm.model}` : '—' }}</span>
        <el-tag v-if="defaultLlm?.scope === 'global'" size="small" type="warning" class="ml-8px">全局</el-tag>
      </div>
      <div class="flex items-center text-13px text-primary">
        <Icon icon="ep:edit" class="mr-4px" /> 编辑
      </div>
    </div>
  </ContentWrap>

  <!-- Provider 列表 -->
  <ContentWrap v-loading="loading">
    <!-- 云端/本地切换 -->
    <div class="flex mb-16px" style="border-bottom:1px solid #e5e7eb">
      <div v-for="t in tabOptions" :key="t.key" class="cursor-pointer pb-12px mr-24px text-14px"
           :style="{color: activeTab===t.key ? '#409eff' : '#64748b', fontWeight: activeTab===t.key ? 600 : 400, borderBottom: activeTab===t.key ? '2px solid #409eff' : '2px solid transparent'}"
           @click="activeTab = t.key">
        {{ t.label }}（{{ tabCounts[t.key] }}）
      </div>
    </div>

    <!-- 已配置 区块 -->
    <div v-if="configuredProviders.length > 0" class="mb-24px">
      <div class="flex items-center mb-12px">
        <span class="inline-block mr-8px" style="width:10px;height:10px;border-radius:50%;background:#10b981"></span>
        <span class="text-15px font-bold">已配置</span>
        <span class="ml-8px text-12px text-gray-400">{{ configuredProviders.length }} 个在线</span>
      </div>
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :lg="8" :xl="6" v-for="provider in configuredProviders" :key="provider.id" class="mb-16px">
          <el-card shadow="hover" :body-style="{ padding: '16px' }">
            <template #header>
              <div class="flex justify-between items-center">
                <div>
                  <span class="font-bold text-16px">{{ provider.name }}</span>
                  <el-tag v-if="provider.isCustom" size="small" type="warning" class="ml-8px">自定义</el-tag>
                  <el-tag v-if="provider.isLocal" size="small" type="info" class="ml-4px">本地</el-tag>
                </div>
                <div>
                  <el-button link type="primary" @click="handleConfigure(provider)" v-hasPermi="['ai-agent:model:update']">
                    <Icon icon="ep:setting" />
                  </el-button>
                  <el-button link type="success" @click="handleTest(provider)" v-hasPermi="['ai-agent:model:query']">
                    <Icon icon="ep:connection" />
                  </el-button>
                  <el-button link type="primary" @click="handleDiscover(provider)" v-if="provider.supportModelDiscovery"
                    v-hasPermi="['ai-agent:model:query']">
                    <Icon icon="ep:search" />
                  </el-button>
                  <el-button link type="danger" @click="handleDeleteCustomProvider(provider)" v-if="provider.isCustom"
                    v-hasPermi="['ai-agent:model:delete']">
                    <Icon icon="ep:delete" />
                  </el-button>
                </div>
              </div>
            </template>
            <div class="text-12px text-gray-500 mb-8px">
              <span v-if="provider.apiKeyPrefix || provider.chatModel" class="mr-8px">Key: {{ provider.apiKeyPrefix || '***' }}</span>
              <span v-if="provider.chatModel">当前模型: {{ provider.chatModel }}</span>
            </div>
            <el-collapse v-if="(provider.models && provider.models.length > 0) || (provider.extraModels && provider.extraModels.length > 0)">
              <el-collapse-item title="内置模型" v-if="provider.models && provider.models.length > 0">
                <div v-for="model in provider.models" :key="model.id" class="flex justify-between items-center py-4px">
                  <div>
                    <span>{{ model.name || model.id }}</span>
                    <el-tag v-if="model.supportsMultimodal" size="small" type="info" class="ml-4px">多模态</el-tag>
                  </div>
                  <div>
                    <el-button link type="primary" size="small" @click="openAddModelDialog(provider, model)">编辑</el-button>
                    <el-button link type="danger" size="small" @click="handleDeleteModel(provider, model)">删除</el-button>
                  </div>
                </div>
              </el-collapse-item>
              <el-collapse-item title="自定义模型" v-if="provider.extraModels && provider.extraModels.length > 0">
                <div v-for="model in provider.extraModels" :key="model.id" class="flex justify-between items-center py-4px">
                  <div>
                    <span>{{ model.name || model.id }}</span>
                    <el-tag v-if="model.supportsMultimodal" size="small" type="info" class="ml-4px">多模态</el-tag>
                  </div>
                  <div>
                    <el-button link type="danger" size="small" @click="handleDeleteModel(provider, model)">删除</el-button>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 未配置（可用） 区块 -->
    <div v-if="availableProviders.length > 0">
      <div class="flex items-center mb-12px">
        <span class="inline-block mr-8px" style="width:10px;height:10px;border-radius:50%;background:#d1d5db"></span>
        <span class="text-15px font-bold" style="color:#6b7280">未配置（可用）</span>
        <span class="ml-8px text-12px text-gray-400">{{ availableProviders.length }} 个待配置</span>
      </div>
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :lg="8" :xl="6" v-for="provider in availableProviders" :key="provider.id" class="mb-16px">
          <el-card shadow="never" :body-style="{ padding: '16px' }" style="border:1px dashed #d1d5db">
            <div class="flex justify-between items-center">
              <div>
                <span class="text-14px">{{ provider.name }}</span>
                <el-tag v-if="provider.isCustom" size="small" type="warning" class="ml-8px">自定义</el-tag>
                <el-tag v-if="provider.isLocal" size="small" type="info" class="ml-4px">本地</el-tag>
              </div>
              <el-button type="primary" plain size="small" @click="handleConfigure(provider)"
                v-hasPermi="['ai-agent:model:update']">配置</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-empty v-if="!loading && filteredProviders.length === 0" description="暂无 Provider 数据" />
  </ContentWrap>

  <!-- Provider 配置弹窗 -->
  <el-dialog v-model="configureDialogVisible" title="配置 Provider" width="500px">
    <el-form :model="configureForm" label-width="100px">
      <el-form-item label="Provider">
        <el-input :model-value="configureForm.providerName" disabled />
      </el-form-item>
      <el-form-item label="API Key">
        <el-input v-model="configureForm.apiKey" placeholder="输入 API Key" show-password />
      </el-form-item>
      <el-form-item label="Base URL">
        <el-input v-model="configureForm.baseUrl" placeholder="自定义 Base URL（可选）" />
      </el-form-item>
      <el-form-item label="认证模式">
        <el-select v-model="configureForm.authMode" placeholder="选择认证模式" clearable>
          <el-option label="API Key" value="api_key" />
          <el-option label="Auth Token" value="auth_token" />
        </el-select>
      </el-form-item>
      <el-form-item label="自定义请求头">
        <el-input v-model="configureForm.customHeaders" type="textarea" :rows="2"
          placeholder='JSON 对象，如 {"X-Custom":"value"}' />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="configureDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitConfigure" :loading="configureLoading">保存</el-button>
    </template>
  </el-dialog>

  <!-- 添加模型弹窗 -->
  <el-dialog v-model="addModelDialogVisible" title="添加模型" width="500px">
    <el-form :model="addModelForm" label-width="100px">
      <el-form-item label="Provider">
        <el-input :model-value="addModelForm.providerName" disabled />
      </el-form-item>
      <el-form-item label="模型 ID" required>
        <el-input v-model="addModelForm.modelId" placeholder="如 gpt-4o、qwen-max" />
      </el-form-item>
      <el-form-item label="模型名称" required>
        <el-input v-model="addModelForm.name" placeholder="展示名称" />
      </el-form-item>
      <el-form-item label="多模态">
        <el-switch v-model="addModelForm.supportsMultimodal" />
      </el-form-item>
      <el-form-item label="支持图片">
        <el-switch v-model="addModelForm.supportsImage" />
      </el-form-item>
      <el-form-item label="支持视频">
        <el-switch v-model="addModelForm.supportsVideo" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="addModelDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitAddModel" :loading="addModelLoading">添加</el-button>
    </template>
  </el-dialog>

  <!-- 自定义 Provider 弹窗 -->
  <el-dialog v-model="customProviderDialogVisible" title="创建自定义 Provider" width="500px">
    <el-form :model="customProviderForm" label-width="100px">
      <el-form-item label="名称" required>
        <el-input v-model="customProviderForm.name" placeholder="Provider 名称" />
      </el-form-item>
      <el-form-item label="Base URL" required>
        <el-input v-model="customProviderForm.baseUrl" placeholder="API 地址" />
      </el-form-item>
      <el-form-item label="API Key">
        <el-input v-model="customProviderForm.apiKey" placeholder="API Key" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="customProviderDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitCustomProvider" :loading="customProviderLoading">创建</el-button>
    </template>
  </el-dialog>

  <!-- 默认 LLM 选择弹窗 -->
  <el-dialog v-model="llmDialogVisible" title="设置默认 LLM" width="560px" @open="openLlmDialogReady">
    <el-form label-width="100px">
      <el-form-item label="模型">
        <el-select v-model="selectedLlm" style="width:100%" filterable placeholder="选择已配置服务商下的模型">
          <el-option-group v-for="provider in configuredProviders" :key="provider.id" :label="provider.name">
            <el-option v-for="model in allModelsOf(provider)" :key="provider.id + '__' + model.id"
              :label="`${model.name || model.id}`" :value="provider.id + '__' + model.id" />
          </el-option-group>
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="llmDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitDefaultLlm" :loading="llmLoading">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ModelApi, Provider, ModelInfo, ActiveModel } from '@/api/ai/model'

defineOptions({ name: 'AiModelProvider' })

const message = useMessage()

const loading = ref(false)
const providers = ref<Provider[]>([])
const queryParams = reactive({ search: '' })

/** 查询 Provider 列表 */
const getList = async () => {
  loading.value = true
  try {
    providers.value = await ModelApi.listProviders()
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

/** 搜索过滤 */
const filteredProviders = computed(() => {
  if (!queryParams.search) return providers.value
  const kw = queryParams.search.toLowerCase()
  return providers.value.filter(p =>
    p.name?.toLowerCase().includes(kw) ||
    p.models?.some(m => m.name?.toLowerCase().includes(kw) || m.id?.toLowerCase().includes(kw)) ||
    p.extraModels?.some(m => m.name?.toLowerCase().includes(kw) || m.id?.toLowerCase().includes(kw))
  )
})

const handleQuery = () => { /* 前端过滤，无需请求 */ }
const resetQuery = () => {
  queryParams.search = ''
}

/** 云端 / 本地标签页 */
const tabOptions = [
  { key: 'cloud', label: '云端' },
  { key: 'local', label: '本地 / 自定义' }
] as const
type TabKey = typeof tabOptions[number]['key']
const activeTab = ref<TabKey>('cloud')

const currentProviders = computed(() =>
  filteredProviders.value.filter(p =>
    activeTab.value === 'local' ? (p.isLocal || p.isCustom) : !(p.isLocal || p.isCustom)
  )
)
const configuredProviders = computed(() => currentProviders.value.filter(p => p.configured))
const availableProviders = computed(() => currentProviders.value.filter(p => !p.configured))
const tabCounts = computed(() => ({
  cloud: filteredProviders.value.filter(p => !(p.isLocal || p.isCustom)).length,
  local: filteredProviders.value.filter(p => (p.isLocal || p.isCustom)).length
}))

/** Provider 显示名 */
const displayProviderName = (providerId?: string) =>
  providerId ? providers.value.find(p => p.id === providerId)?.name || providerId : ''

const allModelsOf = (provider: Provider): ModelInfo[] => {
  const list: ModelInfo[] = []
  if (provider.models) list.push(...provider.models)
  if (provider.extraModels) list.push(...provider.extraModels)
  return list
}

/** 配置 Provider */
const configureDialogVisible = ref(false)
const configureLoading = ref(false)
const configureForm = reactive({
  providerId: '',
  providerName: '',
  apiKey: '',
  baseUrl: '',
  authMode: '',
  customHeaders: ''
})

const handleConfigure = (provider: Provider) => {
  configureForm.providerId = provider.id
  configureForm.providerName = provider.name
  configureForm.apiKey = ''
  configureForm.baseUrl = provider.baseUrl || ''
  configureForm.authMode = ''
  configureForm.customHeaders = ''
  configureDialogVisible.value = true
}

const submitConfigure = async () => {
  configureLoading.value = true
  try {
    await ModelApi.configureProvider({
      providerId: configureForm.providerId,
      apiKey: configureForm.apiKey || undefined,
      baseUrl: configureForm.baseUrl || undefined,
      authMode: configureForm.authMode || undefined,
      customHeaders: configureForm.customHeaders || undefined
    })
    message.success('配置成功')
    configureDialogVisible.value = false
    await getList()
  } finally {
    configureLoading.value = false
  }
}

/** 测试连接 */
const handleTest = async (provider: Provider) => {
  try {
    const result = await ModelApi.testProvider(provider.id)
    if (result.success) {
      message.success(`连接成功，延迟 ${result.latencyMs || '-'}ms`)
    } else {
      message.error(`连接失败: ${result.error || '未知错误'}`)
    }
  } catch (e) {
    message.error('测试失败')
  }
}

/** 发现模型 */
const handleDiscover = async (provider: Provider) => {
  try {
    const models = await ModelApi.discoverModels(provider.id)
    if (models.length === 0) {
      message.info('未发现新模型')
    } else {
      message.success(`发现 ${models.length} 个模型`)
      await getList()
    }
  } catch (e) {
    message.error('发现模型失败')
  }
}

/** 添加模型 */
const addModelDialogVisible = ref(false)
const addModelLoading = ref(false)
const addModelForm = reactive({
  providerId: '',
  providerName: '',
  modelId: '',
  name: '',
  supportsMultimodal: false,
  supportsImage: false,
  supportsVideo: false
})

const openAddModelDialog = (provider: Provider, model?: ModelInfo) => {
  addModelForm.providerId = provider.id
  addModelForm.providerName = provider.name
  if (model) {
    addModelForm.modelId = model.id
    addModelForm.name = model.name || model.id
    addModelForm.supportsMultimodal = model.supportsMultimodal || false
    addModelForm.supportsImage = model.supportsImage || false
    addModelForm.supportsVideo = model.supportsVideo || false
  } else {
    addModelForm.modelId = ''
    addModelForm.name = ''
    addModelForm.supportsMultimodal = false
    addModelForm.supportsImage = false
    addModelForm.supportsVideo = false
  }
  addModelDialogVisible.value = true
}

const submitAddModel = async () => {
  if (!addModelForm.modelId || !addModelForm.name) {
    message.warning('模型 ID 和名称不能为空')
    return
  }
  addModelLoading.value = true
  try {
    await ModelApi.addModel({
      providerId: addModelForm.providerId,
      modelId: addModelForm.modelId,
      name: addModelForm.name,
      supportsMultimodal: addModelForm.supportsMultimodal || undefined,
      supportsImage: addModelForm.supportsImage || undefined,
      supportsVideo: addModelForm.supportsVideo || undefined
    })
    message.success('添加成功')
    addModelDialogVisible.value = false
    await getList()
  } finally {
    addModelLoading.value = false
  }
}

/** 删除模型 */
const handleDeleteModel = async (provider: Provider, model: ModelInfo) => {
  try {
    await message.delConfirm(`确认删除模型 ${model.name || model.id}？`)
    await ModelApi.deleteModel(provider.id, model.id)
    message.success('删除成功')
    await getList()
  } catch {}
}

/** 自定义 Provider */
const customProviderDialogVisible = ref(false)
const customProviderLoading = ref(false)
const customProviderForm = reactive({
  name: '',
  baseUrl: '',
  apiKey: ''
})

const openCustomProviderDialog = () => {
  customProviderForm.name = ''
  customProviderForm.baseUrl = ''
  customProviderForm.apiKey = ''
  customProviderDialogVisible.value = true
}

const submitCustomProvider = async () => {
  if (!customProviderForm.name || !customProviderForm.baseUrl) {
    message.warning('名称和 Base URL 不能为空')
    return
  }
  customProviderLoading.value = true
  try {
    await ModelApi.createCustomProvider({
      name: customProviderForm.name,
      base_url: customProviderForm.baseUrl,
      api_key: customProviderForm.apiKey || undefined
    })
    message.success('创建成功')
    customProviderDialogVisible.value = false
    await getList()
  } finally {
    customProviderLoading.value = false
  }
}

/** 删除自定义 Provider */
const handleDeleteCustomProvider = async (provider: Provider) => {
  try {
    await message.delConfirm(`确认删除自定义 Provider ${provider.name}？`)
    await ModelApi.deleteCustomProvider(provider.id)
    message.success('删除成功')
    await getList()
  } catch {}
}

/** 默认 LLM */
const defaultLlm = ref<ActiveModel>()
const llmDialogVisible = ref(false)
const llmLoading = ref(false)
const selectedLlm = ref('')

const loadDefaultLlm = async () => {
  try {
    defaultLlm.value = await ModelApi.getActiveModel('global')
  } catch (e) {
    defaultLlm.value = undefined
  }
}

const openLlmDialog = () => {
  if (defaultLlm.value?.providerId && defaultLlm.value.model) {
    selectedLlm.value = `${defaultLlm.value.providerId}__${defaultLlm.value.model}`
  } else {
    selectedLlm.value = ''
  }
  llmDialogVisible.value = true
}

const openLlmDialogReady = () => {
  if (!selectedLlm.value && defaultLlm.value?.providerId && defaultLlm.value.model) {
    selectedLlm.value = `${defaultLlm.value.providerId}__${defaultLlm.value.model}`
  }
}

const submitDefaultLlm = async () => {
  if (!selectedLlm.value) {
    message.warning('请选择模型')
    return
  }
  const idx = selectedLlm.value.lastIndexOf('__')
  const providerId = selectedLlm.value.substring(0, idx)
  const model = selectedLlm.value.substring(idx + 2)
  llmLoading.value = true
  try {
    await ModelApi.setActiveModel({ scope: 'global', providerId, model })
    message.success('默认 LLM 设置成功')
    llmDialogVisible.value = false
    await loadDefaultLlm()
  } finally {
    llmLoading.value = false
  }
}

/** 初始化 */
onMounted(() => {
  getList()
  loadDefaultLlm()
})
</script>