<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      v-loading="formLoading"
    >
      <el-form-item label="智能体名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入智能体名称" />
      </el-form-item>
      <el-form-item label="选择模型" prop="modelName">
        <el-select
          v-model="selectedModel"
          placeholder="请选择模型"
          style="width: 100%"
          filterable
          @change="handleModelChange"
        >
          <el-option-group
            v-for="provider in providerModels"
            :key="provider.providerId"
            :label="provider.providerName"
          >
            <el-option
              v-for="model in provider.models"
              :key="model.modelId"
              :label="model.modelName || model.modelId"
              :value="model.modelId"
            >
              <span>{{ model.modelName || model.modelId }}</span>
              <span class="text-gray-400 text-12px ml-8px">{{ provider.providerName }}</span>
            </el-option>
          </el-option-group>
        </el-select>
      </el-form-item>
      <el-form-item label="模型供应商" prop="modelProvider">
        <el-input v-model="formData.modelProvider" placeholder="自动填充" disabled />
      </el-form-item>
      <el-form-item label="系统提示词" prop="systemPrompt">
        <el-input
          v-model="formData.systemPrompt"
          type="textarea"
          :rows="3"
          placeholder="可选，设定智能体的角色与行为"
        />
      </el-form-item>
      <el-form-item label="智能体描述" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="2"
          placeholder="可选，智能体用途说明"
        />
      </el-form-item>
      <el-form-item label="头像地址" prop="avatar">
        <el-input v-model="formData.avatar" placeholder="可选，头像 URL" />
      </el-form-item>
      <el-form-item label="知识库问答" prop="enableKbTool">
        <el-switch v-model="formData.enableKbTool" :active-value="true" :inactive-value="false" />
        <span class="ml-8px text-gray-400 text-12px">开启后智能体可通过 kb 工具检索知识库</span>
      </el-form-item>
      <el-form-item v-if="formType === 'create'" label="初始技能" prop="initialSkills">
        <el-select
          v-model="formData.initialSkills"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="可选，创建时自动安装到智能体"
          style="width: 100%"
          :loading="skillPoolLoading"
        >
          <el-option
            v-for="skill in skillPool"
            :key="skill.name"
            :label="skill.name"
            :value="skill.name"
          >
            <span>{{ skill.name }}</span>
            <span class="text-gray-400 text-12px ml-8px">{{ skill.source }} · {{ skill.version_text || 'v?' }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="排序" prop="sortOrder">
        <el-input-number v-model="formData.sortOrder" :min="0" controls-position="right" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :value="1">启用</el-radio>
          <el-radio :value="0">停用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitForm" type="primary" :disabled="formLoading">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { AgentApi, Agent } from '@/api/ai/agent'
import { ModelApi } from '@/api/ai/model'
import { AgentRemoteApi, SkillPoolItem } from '@/api/ai/agentRemote'

/** 我的智能体 表单 */
defineOptions({ name: 'AgentForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref<Agent>({
  id: undefined,
  userId: undefined,
  name: undefined,
  description: undefined,
  avatar: undefined,
  modelProvider: 'qwen',
  modelName: undefined,
  systemPrompt: undefined,
  enableKbTool: false,
  status: 1,
  sortOrder: 0,
  initialSkills: []
})
const formRules = reactive({
  name: [{ required: true, message: '智能体名称不能为空', trigger: 'blur' }],
  modelName: [{ required: true, message: '请选择模型', trigger: 'change' }]
})
const formRef = ref() // 表单 Ref

/** 模型选择相关 */
const selectedModel = ref('')
const providerModels = ref<Array<{ providerId: string; providerName: string; models: Array<{ modelId: string; modelName: string }> }>>([])

/** 加载可用模型列表 */
const loadModels = async () => {
  try {
    const allModels = await ModelApi.listAllModels()
    // 按 providerId 分组
    const groupMap = new Map<string, { providerId: string; providerName: string; models: Array<{ modelId: string; modelName: string }> }>()
    for (const m of allModels) {
      const pid = m.providerId as string
      if (!groupMap.has(pid)) {
        groupMap.set(pid, {
          providerId: pid,
          providerName: (m.providerName as string) || pid,
          models: []
        })
      }
      groupMap.get(pid)!.models.push({
        modelId: m.modelId as string,
        modelName: (m.modelName as string) || (m.modelId as string)
      })
    }
    providerModels.value = Array.from(groupMap.values())
  } catch (e) {
    console.error('加载模型列表失败', e)
  }
}

/** 初始技能（从 QwenPaw 技能池加载） */
const skillPool = ref<SkillPoolItem[]>([])
const skillPoolLoading = ref(false)

/** 加载 QwenPaw 技能池 */
const loadSkillPool = async () => {
  skillPoolLoading.value = true
  try {
    skillPool.value = await AgentRemoteApi.listSkillPool()
  } catch (e) {
    console.error('加载技能池失败', e)
  } finally {
    skillPoolLoading.value = false
  }
}

/** 模型选择变化 */
const handleModelChange = (modelId: string) => {
  formData.value.modelName = modelId
  // 找到对应的 provider
  for (const provider of providerModels.value) {
    for (const model of provider.models) {
      if (model.modelId === modelId) {
        formData.value.modelProvider = provider.providerId
        return
      }
    }
  }
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  // 加载模型列表
  await loadModels()
  // 创建时，加载技能池用于初始技能选择
  if (type === 'create') {
    await loadSkillPool()
  }
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      formData.value = await AgentApi.getAgent(id)
      selectedModel.value = formData.value.modelName || ''
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗

/** 提交表单 */
const emit = defineEmits(['success']) // 定义 success 事件，用于操作成功后的回调
const submitForm = async () => {
  // 校验表单
  await formRef.value.validate()
  // 提交请求
  formLoading.value = true
  try {
    const data = formData.value as unknown as Agent
    if (formType.value === 'create') {
      await AgentApi.createAgent(data)
      message.success(t('common.createSuccess'))
    } else {
      await AgentApi.updateAgent(data)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    // 发送操作成功的事件
    emit('success')
  } finally {
    formLoading.value = false
  }
}

/** 重置表单 */
const resetForm = () => {
  formData.value = {
    id: undefined,
    userId: undefined,
    name: undefined,
    description: undefined,
    avatar: undefined,
    modelProvider: 'qwen',
    modelName: undefined,
    systemPrompt: undefined,
    enableKbTool: false,
    status: 1,
    sortOrder: 0,
    initialSkills: []
  }
  selectedModel.value = ''
  formRef.value?.resetFields()
}
</script>
