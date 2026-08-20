<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form class="-mb-15px" :model="queryParams" ref="queryFormRef" :inline="true" label-width="68px">
      <el-form-item label="名称" prop="search">
        <el-input
          v-model="queryParams.search"
          placeholder="请输入智能体名称/描述"
          clearable
          @keyup.enter="handleQuery"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-160px">
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button type="primary" plain @click="openForm('create')" v-hasPermi="['ai-agent:agent:create']">
          <Icon icon="ep:plus" class="mr-5px" /> 新增
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-table v-loading="loading" :data="list" :stripe="true" :show-overflow-tooltip="true">
      <el-table-column label="名称" align="center" prop="name" min-width="140px" />
      <el-table-column label="头像" align="center" width="70px">
        <template #default="scope">
          <el-avatar :size="36" :src="scope.row.avatar">
            <Icon icon="ep:avatar" />
          </el-avatar>
        </template>
      </el-table-column>
      <el-table-column label="模型" align="center" min-width="180px">
        <template #default="scope">
          <el-tag size="small" type="info">{{ scope.row.modelProvider || 'qwen' }}</el-tag>
          <span class="ml-8px">{{ scope.row.modelName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="知识库问答" align="center" width="100px">
        <template #default="scope">
          <el-tag :type="scope.row.enableKbTool ? 'success' : 'info'" size="small">
            {{ scope.row.enableKbTool ? '开启' : '关闭' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="QwenPaw ID" align="center" prop="qwenpawAgentId" min-width="130px" />
      <el-table-column label="状态" align="center" width="80px">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'" size="small">
            {{ scope.row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="运行状态" align="center" width="100px">
        <template #default="scope">
          <el-tag v-if="scope.row.status !== 1" size="small" type="info">已停用</el-tag>
          <el-tag v-else :type="scope.row._running ? 'success' : 'info'" size="small">
            {{ scope.row._running ? '运行中' : '未运行' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" :formatter="dateFormatter" width="180px" />
      <el-table-column label="操作" align="center" min-width="200px">
        <template #default="scope">
          <el-button link type="primary" @click="openDetail(scope.row.id)" v-hasPermi="['ai-agent:agent:query']">
            详情
          </el-button>
          <el-button link type="primary" @click="handleToggle(scope.row)" v-hasPermi="['ai-agent:agent:update']">
            {{ scope.row.status === 1 ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" @click="handleDelete(scope.row.id)" v-hasPermi="['ai-agent:agent:delete']">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 表单弹窗：新增 -->
  <AgentForm ref="formRef" @success="getList" />
  <!-- 详情抽屉 -->
  <AgentDetail ref="detailRef" />
</template>

<script setup lang="ts">
import { dateFormatter } from '@/utils/formatTime'
import { AgentApi, Agent } from '@/api/ai/agent'
import { AgentRemoteApi } from '@/api/ai/agentRemote'
import AgentForm from './AgentForm.vue'
import AgentDetail from './AgentDetail.vue'

/** 我的智能体 列表 */
defineOptions({ name: 'AiAgentIndex' })

const message = useMessage() // 消息弹窗
const { t } = useI18n() // 国际化

const loading = ref(true) // 列表的加载中
const list = ref<Agent[]>([]) // 列表的数据
const total = ref(0) // 列表的总页数
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  search: undefined,
  status: undefined
})
const queryFormRef = ref() // 搜索的表单

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await AgentApi.getAgentPage(queryParams)
    list.value = data.list
    total.value = data.total
    await loadRunningStatus(list.value)
  } finally {
    loading.value = false
  }
}

/** 并行加载各智能体运行状态（失败兜底为未运行） */
const loadRunningStatus = async (agents: Agent[]) => {
  const tasks = agents.map(async (agent) => {
    if (agent.status !== 1) {
      agent._running = false
      return
    }
    try {
      const status = await AgentRemoteApi.getStatus(agent.id)
      agent._running = !!(status?.running ?? false)
    } catch {
      agent._running = false
    }
  })
  await Promise.all(tasks)
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 添加操作 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 详情操作 */
const detailRef = ref()
const openDetail = (id: number) => {
  detailRef.value.open(id)
}

/** 启停操作 */
const handleToggle = async (row: Agent) => {
  await AgentApi.toggleAgent(row.id)
  message.success('操作成功')
  await getList()
}

/** 删除按钮操作 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await AgentApi.deleteAgent(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 初始化 **/
onMounted(() => {
  getList()
})
</script>
