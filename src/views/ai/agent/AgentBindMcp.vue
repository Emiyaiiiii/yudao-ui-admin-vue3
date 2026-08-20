<template>
  <Dialog :title="'MCP 绑定 - ' + agentName" v-model="dialogVisible" width="880px" append-to-body>
    <el-alert
      title="从 Java MCP 商店选择 MCP 挂载到智能体（区分系统级与个人）；或使用「自定义」模式直接填 JSON 下发到 QwenPaw。"
      type="info"
      :closable="false"
      show-icon
      class="mb-16px"
    />

    <!-- 模式切换 -->
    <el-radio-group v-model="mode" class="mb-12px">
      <el-radio-button value="store">从商店选择</el-radio-button>
      <el-radio-button value="custom">自定义 JSON</el-radio-button>
    </el-radio-group>

    <template v-if="mode === 'store'">
      <div class="flex items-center justify-between mb-8px">
        <span class="font-bold text-14px">已挂载 MCP</span>
        <el-input
          v-model="installedSearch"
          placeholder="搜索名称 / Client Key"
          clearable
          class="!w-220px"
        >
          <template #prefix><Icon icon="ep:search" /></template>
        </el-input>
      </div>
      <el-table v-loading="installedLoading" :data="pagedInstalled" :stripe="true" size="small">
        <el-table-column label="名称" align="center" min-width="140px">
          <template #default="scope">
            {{ scope.row.name || scope.row.client_key || scope.row.clientKey || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="传输" align="center" width="100px">
          <template #default="scope">
            <el-tag size="small">{{ scope.row.transport || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="140px" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="handleConfig(scope.row)">配置</el-button>
            <el-button link type="danger" @click="handleUninstall(scope.row)">卸载</el-button>
          </template>
        </el-table-column>
      </el-table>
      <Pagination
        v-if="filteredInstalled.length > pageSize"
        :total="filteredInstalled.length"
        v-model:page="installedPage"
        v-model:limit="pageSize"
        class="-mb-1px"
      />

      <div class="flex items-center justify-between mt-16px mb-8px">
        <span class="font-bold text-14px">MCP 商店（可挂载）</span>
        <el-input
          v-model="storeSearch"
          placeholder="搜索名称 / 编码 / 描述"
          clearable
          class="!w-220px"
        >
          <template #prefix><Icon icon="ep:search" /></template>
        </el-input>
      </div>
      <el-table v-loading="storeLoading" :data="pagedStore" :stripe="true" size="small">
        <el-table-column label="名称" align="center" prop="name" min-width="120px" />
        <el-table-column label="编码" align="center" prop="code" width="140px">
          <template #default="scope">
            <el-text type="info" size="small">{{ scope.row.code }}</el-text>
          </template>
        </el-table-column>
        <el-table-column label="类型" align="center" width="90px">
          <template #default="scope">
            <el-tag :type="scope.row.type === 0 ? 'primary' : 'warning'" size="small">
              {{ scope.row.type === 0 ? '系统级' : '个人' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="传输" align="center" width="100px">
          <template #default="scope">
            <el-tag size="small">{{ scope.row.transport || 'stdio' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="描述" align="center" prop="description" min-width="180px" show-overflow-tooltip />
        <el-table-column label="操作" align="center" width="140px" fixed="right">
          <template #default="scope">
            <el-button
              link
              type="primary"
              :disabled="isInstalled(scope.row.code)"
              @click="handleInstall(scope.row)"
            >
              {{ isInstalled(scope.row.code) ? '已挂载' : '挂载' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <Pagination
        v-if="filteredStore.length > pageSize"
        :total="filteredStore.length"
        v-model:page="storePage"
        v-model:limit="pageSize"
        class="-mb-1px"
      />
    </template>

    <template v-else>
      <el-form :model="customForm" label-width="100px" size="default">
        <el-form-item label="Client Key">
          <el-input v-model="customForm.client_key" placeholder="MCP 客户端唯一标识，如 filesystem" />
        </el-form-item>
        <el-form-item label="配置 JSON">
          <el-input
            v-model="customForm.json"
            type="textarea"
            :rows="14"
            placeholder='示例：
{
  "name": "Filesystem Access",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
}'
            class="font-mono"
          />
        </el-form-item>
      </el-form>
      <div class="text-right">
        <el-button type="primary" @click="handleCustomSubmit" :loading="customLoading">
          下发到 QwenPaw
        </el-button>
      </div>
    </template>
  </Dialog>

  <!-- 工具白名单配置弹窗 -->
  <el-dialog v-model="configVisible" title="MCP 工具白名单" width="640px" append-to-body>
    <el-form :model="configForm" label-width="120px">
      <el-form-item label="Client Key">
        <el-input v-model="configForm.clientKey" disabled />
      </el-form-item>
      <el-form-item label="工具白名单">
        <el-input
          v-model="configForm.toolsWhitelist"
          type="textarea"
          :rows="4"
          class="font-mono"
          placeholder='可选。JSON 数组，如 ["search","fetch"]。留空则继承商店模板配置。保存会自动重新下发到 QwenPaw。'
        />
      </el-form-item>
      <el-alert
        title="保存后会重新下发该 MCP 到 QwenPaw（先删后建生效）。仅对「从商店挂载」的 MCP 生效。"
        type="warning"
        :closable="false"
        show-icon
      />
    </el-form>
    <template #footer>
      <el-button @click="configVisible = false">取 消</el-button>
      <el-button type="primary" :loading="configLoading" @click="handleConfigSubmit">
        保 存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="AgentBindMcp">
import { AgentRemoteApi } from '@/api/ai/agentRemote'
import { McpMetaApi, McpMeta } from '@/api/ai/mcpmeta'

/**
 * 智能体-MCP 绑定管理（QwenPaw 优先，对齐 skills，无本地绑定表）
 * - 「从商店选择」：把 Java MCP 商店项作为模板，展开配置后调 QwenPaw register MCP 接口
 * - 「自定义 JSON」：直接调 QwenPaw register MCP 接口
 * 已挂载列表、启停、配置一律以 QwenPaw 为唯一权威源。
 */
const message = useMessage()
const emit = defineEmits(['success'])

const dialogVisible = ref(false)
const mode = ref<'store' | 'custom'>('store')
const installedLoading = ref(false)
const storeLoading = ref(false)
const customLoading = ref(false)
const installedList = ref<any[]>([]) // 已挂载 MCP（QwenPaw 侧）
const storeList = ref<McpMeta[]>([]) // Java MCP 商店可见列表
const agentId = ref<number>()
const agentName = ref('')

// 搜索与分页（前端过滤/分页）
const pageSize = ref(10)
const installedSearch = ref('')
const storeSearch = ref('')
const installedPage = ref(1)
const storePage = ref(1)

/** 已挂载列表：按 名称 / client_key 过滤 */
const filteredInstalled = computed(() => {
  const kw = installedSearch.value.trim().toLowerCase()
  if (!kw) return installedList.value
  return installedList.value.filter((s) => {
    const name = String(s.name || s.client_key || s.clientKey || '').toLowerCase()
    return name.includes(kw)
  })
})
/** 已挂载列表：分页后的数据 */
const pagedInstalled = computed(() => filteredInstalled.value.slice((installedPage.value - 1) * pageSize.value, installedPage.value * pageSize.value))

/** 商店列表：按 名称 / 编码 / 描述 过滤 */
const filteredStore = computed(() => {
  const kw = storeSearch.value.trim().toLowerCase()
  if (!kw) return storeList.value
  return storeList.value.filter((s) => {
    const name = String(s.name || '').toLowerCase()
    const code = String(s.code || '').toLowerCase()
    const desc = String(s.description || '').toLowerCase()
    return name.includes(kw) || code.includes(kw) || desc.includes(kw)
  })
})
/** 商店列表：分页后的数据 */
const pagedStore = computed(() => filteredStore.value.slice((storePage.value - 1) * pageSize.value, storePage.value * pageSize.value))

// 自定义模式表单
const customForm = ref({
  client_key: '',
  json: ''
})

// 配置弹窗（编辑该 client 的工具白名单，重新下发到 QwenPaw）
const configVisible = ref(false)
const configLoading = ref(false)
const configForm = ref({
  clientKey: '',
  toolsWhitelist: ''
})

/** 打开弹窗 */
const open = async (id: number, name: string) => {
  dialogVisible.value = true
  agentId.value = id
  agentName.value = name
  await Promise.all([getInstalledList(), getStoreList()])
}
defineExpose({ open })

/** 查询已挂载 MCP（QwenPaw 侧真实状态） */
const getInstalledList = async () => {
  installedLoading.value = true
  try {
    installedList.value = await AgentRemoteApi.listMcps(agentId.value)
  } finally {
    installedLoading.value = false
  }
}

/** 查询 Java MCP 商店可见列表（公开 + 当前用户的个人 MCP） */
const getStoreList = async () => {
  storeLoading.value = true
  try {
    storeList.value = await McpMetaApi.getVisibleMcpMetaList()
  } finally {
    storeLoading.value = false
  }
}

/** 判断 MCP 是否已挂载（按 key / client_key 或 name） */
const isInstalled = (code: string) => {
  if (!code) return false
  return installedList.value.some((s) => {
    const n = s.key || s.client_key || s.clientKey || s.name
    return n === code
  })
}

/** 从商店项解析出 RegisterMcpReq（商店仅作为模板） */
const buildStoreRegisterReq = (meta: McpMeta, toolsWhitelist?: string) => {
  const req: any = {
    agentId: agentId.value,
    clientKey: meta.code,
    transport: meta.transport
  }
  if (meta.url) req.url = meta.url
  if (meta.command) req.command = meta.command
  if (meta.args && meta.args.trim()) req.commandArgs = meta.args
  if (meta.headers && meta.headers.trim()) req.headersJson = meta.headers
  const tools = toolsWhitelist !== undefined ? toolsWhitelist : meta.toolsWhitelist
  if (tools && tools.trim()) req.toolsJson = tools
  return req
}

/** 从商店挂载到智能体：展开商店模板配置，直接下发 QwenPaw */
const handleInstall = async (row: McpMeta) => {
  try {
    await message.confirm('确定挂载 MCP「' + row.name + '」到该智能体？')
    await AgentRemoteApi.registerMcp(buildStoreRegisterReq(row))
    message.success('挂载成功')
    await getInstalledList()
    emit('success')
  } catch {}
}

/** 卸载（直接删除 QwenPaw client） */
const handleUninstall = async (row: any) => {
  const code = row.key || row.client_key || row.clientKey || row.name
  try {
    await message.delConfirm()
    await AgentRemoteApi.deleteMcp(agentId.value, code)
    message.success('卸载成功')
    await getInstalledList()
    emit('success')
  } catch {}
}

/** 按 code 在商店里找到模板项 */
const findStoreByCode = (code: string) => {
  return storeList.value.find((m) => m.code === code)
}

/** 打开配置弹窗（编辑工具白名单；仅商店模板项支持，自定义 JSON 请重新下发） */
const handleConfig = async (row: any) => {
  const code = row.key || row.client_key || row.clientKey || row.name
  const meta = findStoreByCode(code)
  if (!meta) {
    message.warning('该 MCP 非商店模板项，请用「自定义 JSON」重新下发配置')
    return
  }
  configForm.value = {
    clientKey: code,
    toolsWhitelist: ''
  }
  configVisible.value = true
}

/** 保存配置：校验白名单后，按商店模板重新下发 QwenPaw（先删后建生效） */
const handleConfigSubmit = async () => {
  const { clientKey, toolsWhitelist } = configForm.value
  if (toolsWhitelist && toolsWhitelist.trim()) {
    try {
      const arr = JSON.parse(toolsWhitelist)
      if (!Array.isArray(arr)) {
        throw new Error('必须是数组')
      }
    } catch (e: any) {
      message.error('工具白名单 JSON 格式错误（需为数组）：' + (e?.message || ''))
      return
    }
  }
  const meta = findStoreByCode(clientKey)
  if (!meta) {
    message.warning('该 MCP 非商店模板项，无法保存')
    return
  }
  configLoading.value = true
  try {
    await AgentRemoteApi.deleteMcp(agentId.value, clientKey)
    await AgentRemoteApi.registerMcp(buildStoreRegisterReq(meta, toolsWhitelist))
    message.success('保存成功')
    configVisible.value = false
    await getInstalledList()
    emit('success')
  } finally {
    configLoading.value = false
  }
}

/** 自定义 JSON 模式：直接下发到 QwenPaw（不创建 Java 绑定） */
const handleCustomSubmit = async () => {
  if (!customForm.value.client_key) {
    message.error('请填写 Client Key')
    return
  }
  let parsed: any
  try {
    parsed = JSON.parse(customForm.value.json || '{}')
  } catch {
    message.error('JSON 格式错误')
    return
  }
  customLoading.value = true
  try {
    await AgentRemoteApi.registerMcp({
      agentId: agentId.value,
      clientKey: customForm.value.client_key,
      transport: parsed.transport,
      url: parsed.url,
      command: parsed.command,
      commandArgs: Array.isArray(parsed.args) ? JSON.stringify(parsed.args) : undefined,
      headersJson:
        parsed.headers && Object.keys(parsed.headers).length > 0
          ? JSON.stringify(parsed.headers)
          : undefined,
      toolsJson:
        Array.isArray(parsed.tools) && parsed.tools.length > 0
          ? JSON.stringify(parsed.tools)
          : undefined
    })
    message.success('下发成功')
    await getInstalledList()
    emit('success')
  } finally {
    customLoading.value = false
  }
}
</script>
