<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="68px"
    >
      <el-form-item label="层级编码" prop="levelCode">
        <el-input
          v-model="queryParams.levelCode"
          placeholder="请输入层级编码"
          clearable
          @keyup.enter="handleQuery"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item label="层级名称" prop="levelName">
        <el-input
          v-model="queryParams.levelName"
          placeholder="请输入层级名称"
          clearable
          @keyup.enter="handleQuery"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item label="可见规则" prop="visibilityRule">
        <el-select v-model="queryParams.visibilityRule" placeholder="请选择可见规则" clearable class="!w-240px">
          <el-option label="按所有者" :value="1" />
          <el-option label="按归属部门" :value="2" />
          <el-option label="全员" :value="3" />
          <el-option label="指定部门列表" :value="5" />
          <el-option label="查询公开" :value="6" />
        </el-select>
      </el-form-item>
      <el-form-item label="归属维度" prop="ownerDim">
        <el-select v-model="queryParams.ownerDim" placeholder="请选择归属维度" clearable class="!w-240px">
          <el-option label="无" :value="0" />
          <el-option label="用户" :value="1" />
          <el-option label="部门" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select
          v-model="queryParams.status"
          placeholder="请选择状态"
          clearable
          class="!w-240px"
        >
          <el-option label="启用" :value="0" />
          <el-option label="禁用" :value="1" />
        </el-select>
      </el-form-item>
      <el-form-item label="创建时间" prop="createTime">
        <el-date-picker
          v-model="queryParams.createTime"
          value-format="YYYY-MM-DD HH:mm:ss"
          type="daterange"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :default-time="[new Date('1 00:00:00'), new Date('1 23:59:59')]"
          class="!w-220px"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openForm('create')"
          v-hasPermi="['kb:level-config:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增
        </el-button>
        <el-button
          type="success"
          plain
          @click="handleExport"
          :loading="exportLoading"
          v-hasPermi="['kb:level-config:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
            type="danger"
            plain
            :disabled="isEmpty(checkedIds)"
            @click="handleDeleteBatch"
            v-hasPermi="['kb:level-config:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-table
        row-key="id"
        v-loading="loading"
        :data="list"
        :stripe="true"
        :show-overflow-tooltip="true"
        @selection-change="handleRowCheckboxChange"
    >
    <el-table-column type="selection" width="55" />
      <el-table-column label="层级编码" align="center" prop="levelCode" width="100px" />
      <el-table-column label="层级名称" align="center" prop="levelName" min-width="130px" />
      <el-table-column label="可见规则" align="center" width="130px">
        <template #default="scope">
          <el-tag :type="scope.row.visibilityRule === 3 ? 'success' : 'info'" size="small">
            {{ visibilityRuleMap[scope.row.visibilityRule] || '未知' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="归属维度" align="center" width="80px">
        <template #default="scope">
          <el-tag v-if="scope.row.ownerDim === 1" type="primary" size="small">用户</el-tag>
          <el-tag v-else-if="scope.row.ownerDim === 2" type="success" size="small">部门</el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="排序" align="center" prop="sort" width="60px" />
      <el-table-column label="状态" align="center" width="70px">
        <template #default="scope">
          <el-tag :type="scope.row.status === 0 ? 'success' : 'danger'" size="small">
            {{ scope.row.status === 0 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="创建时间"
        align="center"
        prop="createTime"
        :formatter="dateFormatter"
        width="180px"
      />
      <el-table-column label="操作" align="center" min-width="120px">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="openForm('update', scope.row.id)"
            v-hasPermi="['kb:level-config:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['kb:level-config:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 表单弹窗：添加/修改 -->
  <LevelConfigForm ref="formRef" @success="getList" />
</template>

<script setup lang="ts">
import { isEmpty } from '@/utils/is'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import { LevelConfigApi, LevelConfig } from '@/api/kb/levelconfig'
import LevelConfigForm from './LevelConfigForm.vue'

/** 知识库层级配置 列表 */
defineOptions({ name: 'LevelConfig' })

/** 可见规则映射 */
const visibilityRuleMap: Record<number, string> = {
  1: '按所有者',
  2: '按归属部门',
  3: '全员',
  5: '指定部门',
  6: '查询公开'
}

const message = useMessage() // 消息弹窗
const { t } = useI18n() // 国际化

const loading = ref(true) // 列表的加载中
const list = ref<LevelConfig[]>([]) // 列表的数据
const total = ref(0) // 列表的总页数
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  levelCode: undefined,
  levelName: undefined,
  visibilityRule: undefined,
  ownerDim: undefined,
  status: undefined,
  createTime: []
})
const queryFormRef = ref() // 搜索的表单
const exportLoading = ref(false) // 导出的加载中

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await LevelConfigApi.getLevelConfigPage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
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

/** 添加/修改操作 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 删除按钮操作 */
const handleDelete = async (id: number) => {
  try {
    // 删除的二次确认
    await message.delConfirm()
    // 发起删除
    await LevelConfigApi.deleteLevelConfig(id)
    message.success(t('common.delSuccess'))
    // 刷新列表
    await getList()
  } catch {}
}

/** 批量删除知识库层级配置 */
const handleDeleteBatch = async () => {
  try {
    // 删除的二次确认
    await message.delConfirm()
    await LevelConfigApi.deleteLevelConfigList(checkedIds.value);
    checkedIds.value = [];
    message.success(t('common.delSuccess'))
    await getList();
  } catch {}
}

const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (records: LevelConfig[]) => {
  checkedIds.value = records.map((item) => item.id!);
}

/** 导出按钮操作 */
const handleExport = async () => {
  try {
    // 导出的二次确认
    await message.exportConfirm()
    // 发起导出
    exportLoading.value = true
    const data = await LevelConfigApi.exportLevelConfig(queryParams)
    download.excel(data, '知识库层级配置.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(() => {
  getList()
})
</script>