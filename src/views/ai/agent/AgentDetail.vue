<template>
  <el-drawer v-model="visible" title="智能体详情" size="640px" destroy-on-close>
    <div v-loading="loading">
      <!-- 基本信息 -->
      <el-descriptions :column="2" border class="mb-16px">
        <el-descriptions-item label="名称" :span="2">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ detail.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="模型">
          <el-tag size="small" type="info">{{ detail.modelProvider || 'qwen' }}</el-tag>
          <span class="ml-8px">{{ detail.modelName }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="知识库问答">
          <el-tag :type="detail.enableKbTool ? 'success' : 'info'" size="small">
            {{ detail.enableKbTool ? '开启' : '关闭' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="QwenPaw ID">{{ detail.qwenpawAgentId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="启用状态">
          <el-tag :type="detail.status === 1 ? 'success' : 'danger'" size="small">
            {{ detail.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="运行状态">
          <el-tag :type="remoteRunning ? 'success' : 'info'" size="small">
            {{ remoteRunning ? '运行中' : '已停止/未知' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createTime || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 系统提示词 -->
      <div class="mb-16px">
        <div class="text-14px font-500 mb-8px">系统提示词</div>
        <el-input
          :model-value="detail.systemPrompt || '（未配置）'"
          type="textarea"
          :rows="4"
          readonly
          resize="none"
        />
      </div>

      <!-- 内置工具列表 -->
      <div class="mb-16px">
        <div class="flex items-center justify-between mb-8px">
          <span class="text-14px font-500">内置工具（{{ toolList.length }}）</span>
        </div>
        <el-empty v-if="toolList.length === 0" description="未获取到内置工具" :image-size="60" />
        <el-table v-else :data="toolList" size="small" border>
          <el-table-column label="工具" min-width="120px">
            <template #default="scope">
              <span class="mr-4px">{{ scope.row.icon || '🔧' }}</span>
              <span>{{ scope.row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="描述" prop="description" min-width="140px" show-overflow-tooltip />
          <el-table-column label="启用" width="70px">
            <template #default="scope">
              <el-switch
                :model-value="scope.row.enabled"
                :loading="scope.row._toggling"
                @change="handleToggleTool(scope.row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70px" align="center">
            <template #default="scope">
              <el-button
                v-if="scope.row.requiresConfig"
                link
                type="primary"
                @click="handleOpenToolConfig(scope.row)"
              >
                配置
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- MCP 列表 -->
      <div class="mb-16px">
        <div class="flex items-center justify-between mb-8px">
          <span class="text-14px font-500">已绑定 MCP（{{ mcpList.length }}）</span>
          <el-button link type="primary" @click="handleManageMcp">
            <Icon icon="ep:setting" class="mr-4px" />管理 MCP
          </el-button>
        </div>
        <el-empty v-if="mcpList.length === 0" description="未绑定 MCP" :image-size="60" />
        <el-table v-else :data="mcpList" size="small" border>
          <el-table-column label="名称" prop="mcpName" min-width="120px" />
          <el-table-column label="编码" prop="mcpCode" min-width="100px" />
          <el-table-column label="传输方式" width="110px">
            <template #default="scope">
              <el-tag size="small" :type="transportType(scope.row.transport)">
                {{ scope.row.transport || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70px">
            <template #default="scope">
              <el-tag :type="scope.row.enabled === 1 ? 'success' : 'info'" size="small">
                {{ scope.row.enabled === 1 ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- QwenPaw 侧实际注册的 MCP 服务 -->
      <div class="mb-16px">
        <div class="flex items-center justify-between mb-8px">
          <span class="text-14px font-500">QwenPaw MCP 服务（{{ remoteMcpList.length }}）</span>
          <el-button link type="primary" @click="loadRemote(detail.id)">
            <Icon icon="ep:refresh" class="mr-4px" />刷新
          </el-button>
        </div>
        <el-empty v-if="remoteMcpList.length === 0" description="QwenPaw 侧未注册 MCP" :image-size="60" />
        <el-table v-else :data="remoteMcpList" size="small" border>
          <el-table-column label="名称" min-width="120px">
            <template #default="scope">{{ scope.row.name || scope.row.client_key || '-' }}</template>
          </el-table-column>
          <el-table-column label="Client Key" prop="client_key" min-width="110px" />
          <el-table-column label="传输" prop="transport" width="110px" />
          <el-table-column label="启用" width="70px">
            <template #default="scope">
              <el-switch :model-value="scope.row.enabled" @change="handleToggleRemoteMcp(scope.row)" />
            </template>
          </el-table-column>
          <el-table-column label="工具" width="70px" align="center">
            <template #default="scope">
              <el-button link type="primary" @click="handleShowMcpTools(scope.row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- QwenPaw 侧实际安装的 Skills -->
      <div class="mb-16px">
        <div class="flex items-center justify-between mb-8px">
          <span class="text-14px font-500">QwenPaw Skills（{{ remoteSkillList.length }}）</span>
          <el-button link type="primary" @click="handleManageSkill">
            <Icon icon="ep:setting" class="mr-4px" />管理 Skill
          </el-button>
        </div>
        <el-empty v-if="remoteSkillList.length === 0" description="QwenPaw 侧未安装 Skill" :image-size="60" />
        <el-table v-else :data="remoteSkillList" size="small" border>
          <el-table-column label="名称" min-width="120px">
            <template #default="scope">{{ scope.row.name || scope.row.skill_key || '-' }}</template>
          </el-table-column>
          <el-table-column label="编码" prop="skill_key" min-width="110px" />
          <el-table-column label="版本" prop="version" width="80px" />
          <el-table-column label="启用" width="70px">
            <template #default="scope">
              <el-tag :type="scope.row.enabled ? 'success' : 'info'" size="small">
                {{ scope.row.enabled ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 工具配置弹窗 -->
    <el-dialog
      v-model="toolConfigVisible"
      :title="`配置工具：${currentTool?.name || ''}`"
      width="520px"
      append-to-body
    >
      <el-form v-if="currentTool" label-width="120px" :model="toolConfigForm">
        <el-form-item
          v-for="field in currentTool.configFields || []"
          :key="field.name"
          :label="field.label || field.name"
          :required="field.required"
        >
          <!-- 文本框 / 密码 -->
          <el-input
            v-if="field.type === 'text' || field.type === 'password'"
            v-model="toolConfigForm[field.name]"
            :type="field.type === 'password' ? 'password' : 'text'"
            :placeholder="field.placeholder"
            show-password
          />
          <!-- 数字 -->
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="toolConfigForm[field.name]"
            :min="field.min"
            :max="field.max"
          />
          <!-- 开关 -->
          <el-switch
            v-else-if="field.type === 'boolean'"
            v-model="toolConfigForm[field.name]"
          />
          <!-- 下拉选择 -->
          <el-select
            v-else-if="field.type === 'select'"
            v-model="toolConfigForm[field.name]"
            :placeholder="field.placeholder"
            clearable
            style="width: 100%"
          >
            <el-option v-for="opt in field.options || []" :key="opt" :label="opt" :value="opt" />
          </el-select>
          <!-- 多行文本 -->
          <el-input
            v-else
            v-model="toolConfigForm[field.name]"
            type="textarea"
            :rows="3"
            :placeholder="field.placeholder"
          />
          <div v-if="field.help" class="text-12px text-gray-400">{{ field.help }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="toolConfigSaving" @click="handleSaveToolConfig">保 存</el-button>
        <el-button @click="toolConfigVisible = false">取 消</el-button>
      </template>
    </el-dialog>

    <!-- MCP 绑定管理弹窗 -->
    <AgentBindMcp ref="bindMcpRef" @success="handleMcpSuccess" />
    <!-- Skill 绑定管理弹窗 -->
    <AgentBindSkill ref="bindSkillRef" @success="handleSkillSuccess" />
    <!-- MCP 工具查看弹窗 -->
    <el-dialog
      v-model="mcpToolsVisible"
      :title="`MCP 工具：${currentMcp?.name || currentMcp?.client_key || ''}`"
      width="560px"
      append-to-body
    >
      <el-table :data="mcpTools" size="small" border max-height="400">
        <el-table-column label="工具" prop="name" min-width="140px" />
        <el-table-column label="描述" prop="description" min-width="220px" show-overflow-tooltip />
      </el-table>
      <el-empty v-if="mcpTools.length === 0" description="无工具" :image-size="50" />
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { AgentApi, Agent } from '@/api/ai/agent'
import { AgentMcpApi, AgentMcp } from '@/api/ai/agentmcp'
import { AgentToolApi, AgentTool, AgentToolConfigField } from '@/api/ai/agentTool'
import { AgentRemoteApi } from '@/api/ai/agentRemote'
import AgentBindMcp from './AgentBindMcp.vue'
import AgentBindSkill from './AgentBindSkill.vue'

/** 智能体详情抽屉 */
defineOptions({ name: 'AiAgentDetail' })

const message = useMessage()
const visible = ref(false) // 抽屉是否显示
const loading = ref(false) // 加载中
const detail = ref<Agent>({} as Agent) // 智能体详情
const mcpList = ref<AgentMcp[]>([]) // MCP 绑定列表
const toolList = ref<AgentTool[]>([]) // 内置工具列表
const bindMcpRef = ref() // MCP 绑定弹窗 Ref
const bindSkillRef = ref() // Skill 绑定弹窗 Ref
const remoteRunning = ref(false) // QwenPaw 侧运行状态
const remoteMcpList = ref<any[]>([]) // QwenPaw 侧注册的 MCP
const remoteSkillList = ref<any[]>([]) // QwenPaw 侧安装的 Skills
const mcpToolsVisible = ref(false) // MCP 工具查看弹窗
const mcpTools = ref<any[]>([]) // MCP 工具列表
const currentMcp = ref<any>() // 当前查看的 MCP

// 工具配置弹窗状态
const toolConfigVisible = ref(false)
const toolConfigSaving = ref(false)
const currentTool = ref<AgentTool>()
const toolConfigForm = reactive<Record<string, any>>({})

/** 传输方式对应的标签类型 */
const transportType = (transport?: string) => {
  if (transport === 'streamable_http') return 'primary'
  if (transport === 'sse') return 'warning'
  return 'info' // stdio / 未知
}

/** 打开抽屉 */
const open = async (agentId: number) => {
  visible.value = true
  loading.value = true
  try {
    const [agent, mcp, tool] = await Promise.all([
      AgentApi.getAgent(agentId),
      AgentMcpApi.getAgentMcpList(agentId),
      AgentToolApi.listTools(agentId).catch(() => [])
    ])
    detail.value = agent
    mcpList.value = mcp
    toolList.value = tool
  } finally {
    loading.value = false
  }
  await loadRemote(agentId)
}

/** 加载 QwenPaw 侧运行状态 / MCP / Skills */
const loadRemote = async (agentId: number) => {
  try {
    const [status, mcp, skill] = await Promise.all([
      AgentRemoteApi.getStatus(agentId),
      AgentRemoteApi.listMcps(agentId),
      AgentRemoteApi.listSkills(agentId)
    ])
    remoteRunning.value = !!(status?.running ?? false)
    remoteMcpList.value = mcp || []
    remoteSkillList.value = skill || []
  } catch {
    remoteRunning.value = false
    remoteMcpList.value = []
    remoteSkillList.value = []
  }
}

/** 切换 QwenPaw 侧 MCP 启用状态 */
const handleToggleRemoteMcp = async (mcp: any) => {
  const target = !mcp.enabled
  try {
    const updated = await AgentRemoteApi.toggleMcp(detail.value.id, mcp.client_key)
    mcp.enabled = updated?.enabled ?? target
    message.success('操作成功')
  } catch {
    message.error('切换 MCP 状态失败')
  }
}

/** 查看 QwenPaw 侧 MCP 工具 */
const handleShowMcpTools = async (mcp: any) => {
  currentMcp.value = mcp
  mcpToolsVisible.value = true
  mcpTools.value = []
  try {
    mcpTools.value = await AgentRemoteApi.listMcpTools(detail.value.id, mcp.client_key)
  } catch {
    message.error('获取工具列表失败')
  }
}

/** 切换工具启用状态 */
const handleToggleTool = async (tool: AgentTool) => {
  tool._toggling = true
  try {
    const updated = await AgentToolApi.toggleTool(detail.value.id, tool.name)
    tool.enabled = updated?.enabled ?? !tool.enabled
  } catch (e) {
    message.error('切换工具状态失败')
  } finally {
    tool._toggling = false
  }
}

/** 打开工具配置弹窗 */
const handleOpenToolConfig = async (tool: AgentTool) => {
  currentTool.value = tool
  // 回填现有配置
  Object.keys(toolConfigForm).forEach((k) => delete toolConfigForm[k])
  try {
    const config = await AgentToolApi.getConfig(detail.value.id, tool.name)
    const fields = tool.configFields || []
    fields.forEach((field: AgentToolConfigField) => {
      const value = config?.[field.name]
      toolConfigForm[field.name] = value !== undefined && value !== null ? value : (field.default ?? (field.type === 'boolean' ? false : field.type === 'number' ? 0 : ''))
    })
  } catch (e) {
    // 获取配置失败也允许打开（空表单）
  }
  toolConfigVisible.value = true
}

/** 保存工具配置 */
const handleSaveToolConfig = async () => {
  if (!currentTool.value) return
  toolConfigSaving.value = true
  try {
    await AgentToolApi.updateConfig(detail.value.id, currentTool.value.name, { ...toolConfigForm })
    message.success('配置已保存')
    toolConfigVisible.value = false
  } catch (e) {
    message.error('保存配置失败')
  } finally {
    toolConfigSaving.value = false
  }
}

/** 打开 MCP 绑定管理弹窗 */
const handleManageMcp = () => {
  bindMcpRef.value?.open(detail.value.id, detail.value.name)
}

/** 打开 Skill 绑定管理弹窗 */
const handleManageSkill = () => {
  bindSkillRef.value?.open(detail.value.id, detail.value.name)
}

/** MCP 绑定数据变更后刷新（含 QwenPaw 侧注册） */
const handleMcpSuccess = async () => {
  mcpList.value = await AgentMcpApi.getAgentMcpList(detail.value.id)
  await loadRemote(detail.value.id)
}

/** Skill 绑定数据变更后刷新（含 QwenPaw 侧安装） */
const handleSkillSuccess = async () => {
  await loadRemote(detail.value.id)
}

defineExpose({ open })
</script>
