<template>
  <ContentWrap>
    <!-- 搜索栏 -->
    <el-form class="-mb-15px" :model="queryParams" ref="queryFormRef" :inline="true" label-width="80px">
      <el-form-item label="关键字" prop="search">
        <el-input
          v-model="queryParams.search"
          placeholder="搜索名称/编码/描述"
          clearable
          @keyup.enter="handleQuery"
          class="!w-200px"
        />
      </el-form-item>
      <el-form-item label="传输" prop="transport">
        <el-select v-model="queryParams.transport" placeholder="全部" clearable class="!w-140px">
          <el-option label="stdio" value="stdio" />
          <el-option label="streamable_http" value="streamable_http" />
          <el-option label="sse" value="sse" />
        </el-select>
      </el-form-item>
      <el-form-item label="类型" prop="type">
        <el-select v-model="queryParams.type" placeholder="全部" clearable class="!w-140px">
          <el-option label="系统级" :value="0" />
          <el-option label="个人" :value="1" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable class="!w-100px">
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" />搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" />重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['ai-agent:mcp-meta:create']"
        >
          <Icon icon="ep:plus" />新增 MCP
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <el-table v-loading="loading" :data="list" :stripe="true" :show-overflow-tooltip="true">
      <el-table-column label="ID" align="center" prop="id" width="60px" />
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
      <el-table-column label="命令/URL" align="center" min-width="160px">
        <template #default="scope">
          <el-text v-if="scope.row.command" size="small">
            {{ scope.row.command }} {{ formatArgs(scope.row.args) }}
          </el-text>
          <el-text v-else-if="scope.row.url" size="small" type="primary">{{ scope.row.url }}</el-text>
          <el-text v-else size="small" type="info">-</el-text>
        </template>
      </el-table-column>
      <el-table-column label="描述" align="center" prop="description" min-width="160px" />
      <el-table-column label="状态" align="center" width="80px">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'info'" size="small">
            {{ scope.row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="170px">
        <template #default="scope">
          <span>{{ formatDate(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="180px" fixed="right">
        <template #default="scope">
          <el-button link type="primary" @click="handleDetail(scope.row)">详情</el-button>
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['ai-agent:mcp-meta:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row)"
            v-hasPermi="['ai-agent:mcp-meta:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      :total="total"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 新增/编辑弹窗 -->
  <Dialog v-model="formVisible" :title="formTitle" width="720px" append-to-body>
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      v-loading="formLoading"
    >
      <el-form-item label="名称" prop="name">
        <el-input v-model="formData.name" placeholder="如：filesystem" />
      </el-form-item>
      <el-form-item label="编码" prop="code">
        <el-input
          v-model="formData.code"
          placeholder="唯一标识（QwenPaw clientKey），保存后不可修改"
          :disabled="formType === 'update'"
        />
      </el-form-item>
      <el-form-item label="类型" prop="type">
        <el-radio-group v-model="formData.type">
          <el-radio :value="0">系统级（公共）</el-radio>
          <el-radio :value="1">个人</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="传输" prop="transport">
        <el-select v-model="formData.transport" placeholder="请选择" class="!w-100%">
          <el-option label="stdio（本地命令）" value="stdio" />
          <el-option label="streamable_http（远程 HTTP）" value="streamable_http" />
          <el-option label="sse（Server-Sent Events）" value="sse" />
        </el-select>
      </el-form-item>

      <template v-if="formData.transport === 'stdio'">
        <el-form-item label="命令" prop="command">
          <el-input v-model="formData.command" placeholder="如 npx、python" />
        </el-form-item>
        <el-form-item label="参数" prop="args">
          <el-input
            v-model="formData.args"
            type="textarea"
            :rows="3"
            placeholder='JSON 数组，如 ["-y", "@modelcontextprotocol/server-filesystem", "/data"]'
            @change="syncJson('args')"
          />
        </el-form-item>
        <el-form-item label="工作目录" prop="cwd">
          <el-input v-model="formData.cwd" placeholder="可选" />
        </el-form-item>
        <el-form-item label="环境变量" prop="env">
          <el-input
            v-model="formData.env"
            type="textarea"
            :rows="3"
            placeholder='JSON 对象，如 {"API_KEY":"xxx"}'
            @change="syncJson('env')"
          />
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item label="URL" prop="url">
          <el-input v-model="formData.url" placeholder="https://example.com/mcp" />
        </el-form-item>
        <el-form-item label="请求头" prop="headers">
          <el-input
            v-model="formData.headers"
            type="textarea"
            :rows="3"
            placeholder='JSON 对象，如 {"Authorization":"Bearer xxx"}'
            @change="syncJson('headers')"
          />
        </el-form-item>
      </template>

      <el-form-item label="工具白名单" prop="toolsWhitelist">
        <el-input
          v-model="formData.toolsWhitelist"
          type="textarea"
          :rows="2"
          placeholder='JSON 数组，如 ["search","fetch"]；留空表示全部'
          @change="syncJson('toolsWhitelist')"
        />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="formData.description" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :value="1">启用</el-radio>
          <el-radio :value="0">停用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="formVisible = false">取 消</el-button>
      <el-button type="primary" @click="submitForm" :loading="formLoading">确 定</el-button>
    </template>
  </Dialog>

  <!-- 详情抽屉 -->
  <el-drawer v-model="detailVisible" title="MCP 详情" size="520px">
    <el-descriptions v-if="detailData" :column="1" border>
      <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
      <el-descriptions-item label="名称">{{ detailData.name }}</el-descriptions-item>
      <el-descriptions-item label="编码">{{ detailData.code }}</el-descriptions-item>
      <el-descriptions-item label="类型">
        <el-tag :type="detailData.type === 0 ? 'primary' : 'warning'" size="small">
          {{ detailData.type === 0 ? '系统级' : '个人' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="传输">{{ detailData.transport }}</el-descriptions-item>
      <el-descriptions-item label="命令">{{ detailData.command || '-' }}</el-descriptions-item>
      <el-descriptions-item label="参数">
        <pre class="!m-0 whitespace-pre-wrap break-all">{{
          formatArgsList(detailData.args)
        }}</pre>
      </el-descriptions-item>
      <el-descriptions-item label="URL">{{ detailData.url || '-' }}</el-descriptions-item>
      <el-descriptions-item label="工作目录">{{ detailData.cwd || '-' }}</el-descriptions-item>
      <el-descriptions-item label="环境变量">
        <pre class="!m-0 whitespace-pre-wrap break-all">{{ detailData.env || '-' }}</pre>
      </el-descriptions-item>
      <el-descriptions-item label="请求头">
        <pre class="!m-0 whitespace-pre-wrap break-all">{{ detailData.headers || '-' }}</pre>
      </el-descriptions-item>
      <el-descriptions-item label="工具白名单">
        {{ formatToolsWhitelist(detailData.toolsWhitelist) }}
      </el-descriptions-item>
      <el-descriptions-item label="描述">{{ detailData.description || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="detailData.status === 1 ? 'success' : 'info'" size="small">
          {{ detailData.status === 1 ? '启用' : '停用' }}
        </el-tag>
      </el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<script setup lang="ts" name="AiMcpMetaIndex">
import { formatDate } from '@/utils/formatTime'
import { McpMetaApi, McpMeta } from '@/api/ai/mcpmeta'

const message = useMessage()
const { t } = useI18n()

const loading = ref(true)
const list = ref<McpMeta[]>([])
const total = ref(0)
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  search: undefined,
  transport: undefined,
  type: undefined,
  status: undefined
})
const queryFormRef = ref()

const getList = async () => {
  loading.value = true
  try {
    const data = await McpMetaApi.getMcpMetaPage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}
const resetQuery = () => {
  queryFormRef.value?.resetFields()
  handleQuery()
}

/** 新增/编辑弹窗 */
const formVisible = ref(false)
const formLoading = ref(false)
const formTitle = ref('')
const formType = ref<'create' | 'update'>('create')
const formData = ref<McpMeta>({
  id: undefined,
  name: '',
  code: '',
  type: 1,
  transport: 'stdio',
  command: '',
  args: '',
  url: '',
  env: '',
  headers: '',
  cwd: '',
  toolsWhitelist: '',
  description: '',
  status: 1
} as McpMeta)
const formRef = ref()

// 表单 JSON 字段容错：失败时保留原值并提示
const syncJson = (field: 'args' | 'env' | 'headers' | 'toolsWhitelist') => {
  const val = formData.value[field] as string | undefined
  if (!val || !val.trim()) {
    formData.value[field] = ''
    return
  }
  try {
    if (field === 'env' || field === 'headers') {
      JSON.parse(val)
    } else {
      const arr = JSON.parse(val)
      if (!Array.isArray(arr)) throw new Error('必须是数组')
    }
  } catch (e: any) {
    message.error(`${field} 字段非合法 JSON：${e?.message || ''}`)
  }
}

const formRules = {
  name: [{ required: true, message: '名称不能为空', trigger: 'blur' }],
  code: [
    { required: true, message: '编码不能为空', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      message: '编码以字母开头，仅含字母数字下划线连字符',
      trigger: 'blur'
    }
  ],
  type: [{ required: true, message: '类型不能为空', trigger: 'change' }],
  transport: [{ required: true, message: '传输不能为空', trigger: 'change' }],
  command: [
    {
      validator: (_: any, val: string, cb: any) => {
        if (formData.value.transport === 'stdio' && !val) {
          cb(new Error('stdio 模式下命令必填'))
        } else {
          cb()
        }
      },
      trigger: 'blur'
    }
  ],
  url: [
    {
      validator: (_: any, val: string, cb: any) => {
        if (formData.value.transport !== 'stdio' && !val) {
          cb(new Error('远程模式下 URL 必填'))
        } else {
          cb()
        }
      },
      trigger: 'blur'
    }
  ]
}

const resetForm = () => {
  formData.value = {
    id: undefined,
    name: '',
    code: '',
    type: 1,
    transport: 'stdio',
    command: '',
    args: '',
    url: '',
    env: '',
    headers: '',
    cwd: '',
    toolsWhitelist: '',
    description: '',
    status: 1
  }
  formRef.value?.resetFields()
}

const openForm = async (type: 'create' | 'update', id?: number) => {
  formVisible.value = true
  formType.value = type
  formTitle.value = type === 'create' ? '新增 MCP' : '编辑 MCP'
  resetForm()
  if (type === 'update' && id) {
    formLoading.value = true
    try {
      const data = await McpMetaApi.getMcpMeta(id)
      formData.value = { ...formData.value, ...data }
    } finally {
      formLoading.value = false
    }
  }
}

const submitForm = async () => {
  await formRef.value?.validate()
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      await McpMetaApi.createMcpMeta(formData.value)
      message.success(t('common.createSuccess'))
    } else {
      await McpMetaApi.updateMcpMeta(formData.value)
      message.success(t('common.updateSuccess'))
    }
    formVisible.value = false
    await getList()
  } finally {
    formLoading.value = false
  }
}

const handleDelete = async (row: McpMeta) => {
  try {
    await message.delConfirm()
    await McpMetaApi.deleteMcpMeta(row.id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 详情 */
const detailVisible = ref(false)
const detailData = ref<McpMeta>()
const handleDetail = async (row: McpMeta) => {
  detailVisible.value = true
  detailData.value = undefined
  detailData.value = await McpMetaApi.getMcpMeta(row.id)
}

/** JSON 数组字符串 → 空格拼接，容错返回原值 */
const formatArgs = (args: string | undefined) => {
  if (!args) return ''
  try {
    const arr = JSON.parse(args)
    if (Array.isArray(arr)) return arr.join(' ')
  } catch {}
  return args
}

/** JSON 数组字符串 → 换行拼接（详情用） */
const formatArgsList = (args: string | undefined) => {
  if (!args) return '-'
  try {
    const arr = JSON.parse(args)
    if (Array.isArray(arr)) return arr.join('\n')
  } catch {}
  return args
}

/** JSON 数组字符串 → 顿号拼接，空则显示「全部」 */
const formatToolsWhitelist = (tw: string | undefined) => {
  if (!tw) return '全部'
  try {
    const arr = JSON.parse(tw)
    if (Array.isArray(arr) && arr.length) return arr.join('、')
  } catch {}
  return tw || '全部'
}

onMounted(() => {
  getList()
})
</script>
