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
      <el-form-item label="选择部门" prop="deptId">
        <el-tree-select
          v-model="queryParams.deptId"
          :data="deptTree"
          :props="defaultProps"
          check-strictly
          default-expand-all
          placeholder="请选择部门"
          class="!w-300px"
          @change="handleQuery"
        />
      </el-form-item>
      <el-form-item label="包含子部门">
        <el-checkbox v-model="queryParams.includeChildren" @change="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openUserSelect('member')"
          v-hasPermi="['kb:user-dept:update']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 添加成员
        </el-button>
        <el-button
          type="warning"
          plain
          @click="openUserSelect('admin')"
          v-hasPermi="['kb:user-dept:update']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 添加管理员
        </el-button>
      </el-form-item>
    </el-form>
    <!-- 当前部门提示 -->
    <el-alert
      v-if="queryParams.deptId"
      :title="selectedDeptHint"
      type="info"
      :closable="false"
      show-icon
      class="mb-15px"
    />
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-table
      v-loading="loading"
      :data="list"
      :stripe="true"
      :show-overflow-tooltip="true"
    >
      <template #empty>
        <span v-if="!queryParams.deptId">请先选择部门后点击搜索</span>
        <span v-else>该部门下暂无关联用户</span>
      </template>
      <el-table-column label="用户昵称" align="center" prop="nickname" min-width="120px" />
      <el-table-column
        v-if="queryParams.includeChildren"
        label="所属部门"
        align="center"
        prop="deptName"
        min-width="140px"
      />
      <el-table-column label="角色" align="center" prop="role">
        <template #default="scope">
          <el-tag v-if="scope.row.role === 1" type="danger">管理员</el-tag>
          <el-tag v-else type="info">成员</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="创建时间"
        align="center"
        prop="createTime"
        :formatter="dateFormatter"
        width="180px"
      />
      <el-table-column label="操作" align="center" min-width="160px">
        <template #default="scope">
          <el-button
            link
            type="primary"
            @click="handleToggleRole(scope.row)"
            v-hasPermi="['kb:user-dept:update']"
          >
            {{ scope.row.role === 1 ? '设为成员' : '设为管理员' }}
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleRemove(scope.row)"
            v-hasPermi="['kb:user-dept:delete']"
          >
            移除
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

  <!-- 用户选择弹窗 -->
  <UserSelectForm ref="userSelectFormRef" @confirm="handleUserSelectConfirm" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { dateFormatter } from '@/utils/formatTime'
import { defaultProps, handleTree } from '@/utils/tree'
import * as DeptApi from '@/api/system/dept'
import { UserDeptApi, UserDept } from '@/api/kb/userdept'
import UserSelectForm from '@/components/UserSelectForm/index.vue'

/** 知识库用户部门关联 列表 */
defineOptions({ name: 'UserDept' })

const message = useMessage() // 消息弹窗
const { t } = useI18n() // 国际化

const loading = ref(false) // 列表的加载中
const list = ref<UserDept[]>([]) // 列表的数据
const total = ref(0) // 列表的总条目数
const queryParams = reactive({
  deptId: undefined as number | undefined,
  includeChildren: false,
  pageNo: 1,
  pageSize: 10
})
const queryFormRef = ref() // 搜索的表单
const deptTree = ref<any[]>([]) // 部门树形结构

/** 查询列表 */
const getList = async () => {
  if (!queryParams.deptId) {
    list.value = []
    total.value = 0
    loading.value = false
    return
  }
  loading.value = true
  try {
    const data = await UserDeptApi.getDeptMemberPage({
      deptId: queryParams.deptId,
      includeChildren: queryParams.includeChildren,
      pageNo: queryParams.pageNo,
      pageSize: queryParams.pageSize
    })
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
  queryParams.includeChildren = false
  list.value = []
  total.value = 0
}

/** 添加成员/管理员 */
const userSelectFormRef = ref()
const addType = ref('member') // member 或 admin
const openUserSelect = (type: string) => {
  if (!queryParams.deptId) {
    message.warning('请先选择部门')
    return
  }
  addType.value = type
  // 传入 deptId 作为活动ID，已选用户列表为当前列表中的用户ID
  const selectedList = list.value.map((item) => ({ id: item.userId }))
  userSelectFormRef.value.open(queryParams.deptId, selectedList)
}

/** 用户选择确认回调 */
const handleUserSelectConfirm = async (_deptId: number, userList: any[]) => {
  loading.value = true
  try {
    // 获取当前已有的用户ID列表
    const existingUserIds = list.value.map((item) => item.userId)
    // 筛选出新增的用户
    const newUserList = userList.filter((user) => !existingUserIds.includes(user.id))
    // 批量添加
    for (const user of newUserList) {
      if (addType.value === 'admin') {
        await UserDeptApi.addAdmin(user.id, queryParams.deptId)
      } else {
        await UserDeptApi.addMember(user.id, queryParams.deptId)
      }
    }
    message.success(t('common.createSuccess'))
    await getList()
  } finally {
    loading.value = false
  }
}

/** 切换角色（成员/管理员） */
const handleToggleRole = async (row: UserDept) => {
  try {
    await message.confirm(`确认将该用户设为${row.role === 1 ? '成员' : '管理员'}吗？`)
    const newRole = row.role === 1 ? 0 : 1
    await UserDeptApi.setRole(row.userId!, queryParams.deptId!, newRole)
    message.success(t('common.updateSuccess'))
    await getList()
  } catch {}
}

/** 移除用户 */
const handleRemove = async (row: UserDept) => {
  try {
    await message.delConfirm()
    await UserDeptApi.remove(row.userId!, queryParams.deptId!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 初始化：加载部门树 */
onMounted(async () => {
  const data = await DeptApi.getSimpleDeptList()
  deptTree.value = handleTree(data)
  // 构建部门名称映射（id → name）和父部门映射（id → parentId），用于显示部门路径
  const buildMaps = (items: any[]) => {
    items.forEach((item: any) => {
      deptNameMap.value[item.id] = item.name
      deptParentMap.value[item.id] = item.parentId
      if (item.children) buildMaps(item.children)
    })
  }
  buildMaps(data)
})

/** 部门名称映射（id → name） */
const deptNameMap = ref<Record<number, string>>({})
/** 部门父级映射（id → parentId） */
const deptParentMap = ref<Record<number, number>>({})

/** 获取部门完整路径（如：公司总部 > 水利院） */
const getDeptPath = (deptId: number): string => {
  const names: string[] = []
  let currentId: number | undefined = deptId
  while (currentId) {
    const name = deptNameMap.value[currentId]
    if (!name) break
    names.unshift(name)
    currentId = deptParentMap.value[currentId]
  }
  return names.join(' > ')
}

/** 当前选中部门的提示信息 */
const selectedDeptHint = computed(() => {
  if (!queryParams.deptId) return ''
  const path = getDeptPath(queryParams.deptId)
  const includeHint = queryParams.includeChildren ? '（包含子部门）' : ''
  return `当前部门：${path}${includeHint} — 在此添加的管理员可管理该部门对应的知识库（院级/公司级/咨询评估）`
})
</script>
