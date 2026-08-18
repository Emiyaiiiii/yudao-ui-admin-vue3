<template>
  <Dialog :title="'MCP 绑定 - ' + agentName" v-model="dialogVisible" width="820px" append-to-body>
    <el-alert
      title="MCP 配置直接注册到 QwenPaw 智能体，不经过本地商店；streamable-http 填 URL，stdio 填命令与参数。"
      type="info"
      :closable="false"
      show-icon
      class="mb-16px"
    />
    <div class="mb-8px font-bold text-14px">已注册 MCP</div>
    <el-table v-loading="loading" :data="list" :stripe="true" size="small">
      <el-table-column label="Client Key" align="center" prop="client_key" min-width="140px" />
      <el-table-column label="传输" align="center" prop="transport" width="130px" />
      <el-table-column label="启用" align="center" width="80px">
        <template #default="scope">
          <el-tag :type="isEnabled(scope.row) ? 'success' : 'info'" size="small">
            {{ isEnabled(scope.row) ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="工具数" align="center" width="90px">
        <template #default="scope">
          {{ (scope.row.tools || []).length }}
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="190px">
        <template #default="scope">
          <el-button link type="primary" @click="handleShowTools(scope.row)">工具</el-button>
          <el-button link type="primary" @click="handleToggle(scope.row)">
            {{ isEnabled(scope.row) ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- MCP 工具查看弹窗 -->
    <el-dialog v-model="toolsVisible" :title="`MCP 工具：${currentMcp?.client_key || ''}`" width="560px" append-to-body>
      <el-table v-loading="toolsLoading" :data="mcpTools" size="small" border max-height="400">
        <el-table-column label="工具" prop="name" min-width="140px" />
        <el-table-column label="描述" prop="description" min-width="220px" show-overflow-tooltip />
      </el-table>
      <el-empty v-if="!toolsLoading && mcpTools.length === 0" description="无工具" :image-size="50" />
    </el-dialog>

    <div class="mt-16px mb-8px font-bold text-14px">注册新 MCP</div>
    <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="110px">
      <el-form-item label="Client Key" prop="clientKey">
        <el-input v-model="createForm.clientKey" placeholder="MCP 客户端标识，如 kb-mcp" />
      </el-form-item>
      <el-form-item label="传输方式" prop="transport">
        <el-radio-group v-model="createForm.transport">
          <el-radio value="streamable-http">streamable-http</el-radio>
          <el-radio value="stdio">stdio</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="createForm.transport === 'streamable-http'" label="服务地址" prop="url">
        <el-input v-model="createForm.url" placeholder="https://host:port/mcp 或 http://127.0.0.1:8080/mcp" />
      </el-form-item>
      <el-form-item v-if="createForm.transport === 'stdio'" label="启动命令" prop="command">
        <el-input v-model="createForm.command" placeholder="如 npx、python、node" />
      </el-form-item>
      <el-form-item v-if="createForm.transport === 'stdio'" label="启动参数" prop="commandArgs">
        <el-input
          v-model="createForm.commandArgs"
          type="textarea"
          :rows="1"
          placeholder='JSON 数组，如 ["-y","@modelcontextprotocol/server-everything"]，可空'
        />
      </el-form-item>
      <el-form-item label="请求头" prop="headersJson">
        <el-input
          v-model="createForm.headersJson"
          type="textarea"
          :rows="1"
          placeholder='JSON 对象，如 {"Authorization":"Bearer xxx"}，可空'
        />
      </el-form-item>
      <el-form-item label="工具白名单" prop="toolsJson">
        <el-input
          v-model="createForm.toolsJson"
          type="textarea"
          :rows="1"
          placeholder='JSON 数组，如 ["kb_search"]，空表示全部'
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitCreate" :loading="formLoading">注册</el-button>
        <el-button @click="resetCreateForm">重置</el-button>
      </el-form-item>
    </el-form>
  </Dialog>
</template>
<script setup lang="ts">
import { AgentRemoteApi } from '@/api/ai/agentRemote'

/** 智能体-MCP 绑定管理（直接注册到 QwenPaw） */
defineOptions({ name: 'AgentBindMcp' })

const message = useMessage() // 消息弹窗
const emit = defineEmits(['success']) // 数据变更事件
const dialogVisible = ref(false) // 弹窗的是否展示
const loading = ref(false) // 列表的加载中
const formLoading = ref(false) // 提交中
const list = ref<any[]>([]) // QwenPaw 侧已注册 MCP 列表
const agentId = ref<number>() // 当前智能体ID
const agentName = ref('') // 当前智能体名称
const toolsVisible = ref(false) // MCP 工具查看弹窗
const toolsLoading = ref(false) // 工具加载中
const mcpTools = ref<any[]>([]) // MCP 工具列表
const currentMcp = ref<any>() // 当前查看的 MCP
const createFormRef = ref() // 表单 Ref
const createForm = ref({
  clientKey: '',
  transport: 'streamable-http',
  url: '',
  command: '',
  commandArgs: '',
  headersJson: '',
  toolsJson: ''
})
const createRules = reactive({
  clientKey: [{ required: true, message: '请输入 Client Key', trigger: 'blur' }],
  url: [
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (createForm.value.transport === 'streamable-http' && !value) {
          callback(new Error('streamable-http 传输需填写服务地址'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  command: [
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (createForm.value.transport === 'stdio' && !value) {
          callback(new Error('stdio 传输需填写启动命令'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
})

/** 打开弹窗 */
const open = async (id: number, name: string) => {
  dialogVisible.value = true
  agentId.value = id
  agentName.value = name
  resetCreateForm()
  await getList()
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗

/** 查询 QwenPaw 侧已注册 MCP */
const getList = async () => {
  loading.value = true
  try {
    list.value = await AgentRemoteApi.listMcps(agentId.value)
  } finally {
    loading.value = false
  }
}

/** 判断 MCP 是否启用 */
const isEnabled = (row: any) => {
  return row.enabled === true || row.enabled === 1 || row.enabled === 'true'
}

/** 重置注册表单 */
const resetCreateForm = () => {
  createForm.value = {
    clientKey: '',
    transport: 'streamable-http',
    url: '',
    command: '',
    commandArgs: '',
    headersJson: '',
    toolsJson: ''
  }
  createFormRef.value?.clearValidate()
}

/** 提交注册 */
const submitCreate = async () => {
  await createFormRef.value.validate()
  formLoading.value = true
  try {
    await AgentRemoteApi.registerMcp({
      agentId: agentId.value,
      clientKey: createForm.value.clientKey.trim(),
      transport: createForm.value.transport,
      url: createForm.value.url?.trim() || undefined,
      command: createForm.value.command?.trim() || undefined,
      commandArgs: createForm.value.commandArgs?.trim() || undefined,
      headersJson: createForm.value.headersJson?.trim() || undefined,
      toolsJson: createForm.value.toolsJson?.trim() || undefined
    })
    message.success('注册成功')
    resetCreateForm()
    await getList()
    emit('success')
  } finally {
    formLoading.value = false
  }
}

/** 启停 MCP */
const handleToggle = async (row: any) => {
  try {
    await AgentRemoteApi.toggleMcp(agentId.value, row.client_key)
    message.success('操作成功')
    await getList()
  } catch {}
}

/** 删除 MCP 注册 */
const handleDelete = async (row: any) => {
  try {
    await message.delConfirm()
    await AgentRemoteApi.deleteMcp(agentId.value, row.client_key)
    message.success('删除成功')
    await getList()
    emit('success')
  } catch {}
}

/** 查看 MCP 工具列表 */
const handleShowTools = async (row: any) => {
  currentMcp.value = row
  toolsVisible.value = true
  mcpTools.value = []
  toolsLoading.value = true
  try {
    mcpTools.value = await AgentRemoteApi.listMcpTools(agentId.value, row.client_key)
  } catch {
    message.error('获取工具列表失败')
  } finally {
    toolsLoading.value = false
  }
}
</script>
