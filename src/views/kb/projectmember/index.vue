<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="80px"
    >
      <el-form-item label="项目成果库" prop="kbId">
        <el-select
          v-model="queryParams.kbId"
          placeholder="请选择项目成果库"
          clearable
          filterable
          class="!w-240px"
        >
          <el-option v-for="item in libraryOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="primary"
          plain
          @click="openUserSelect"
          v-hasPermi="['kb:project-member:update']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 添加成员
        </el-button>
      </el-form-item>
    </el-form>
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
        <span v-if="!queryParams.kbId">请先选择项目成果库后点击搜索</span>
        <span v-else>该知识库暂无项目成员</span>
      </template>
      <el-table-column label="所属知识库" align="center" prop="kbId" :formatter="kbIdFormatter" min-width="150px" />
      <el-table-column label="成员昵称" align="center" prop="nickname" min-width="120px" />
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
            type="danger"
            @click="handleRemove(scope.row)"
            v-hasPermi="['kb:project-member:delete']"
          >
            移除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <!-- 用户选择弹窗 -->
  <UserSelectForm ref="userSelectFormRef" @confirm="handleUserSelectConfirm" />
</template>

<script setup lang="ts">
import { dateFormatter } from '@/utils/formatTime'
import { ProjectMemberApi, ProjectMember } from '@/api/kb/projectmember'
import { LibraryApi } from '@/api/kb/library'
import UserSelectForm from '@/components/UserSelectForm/index.vue'

/** 知识库项目成员 列表 */
defineOptions({ name: 'ProjectMember' })

const message = useMessage() // 消息弹窗
const { t } = useI18n() // 国际化

const loading = ref(false) // 列表的加载中
const list = ref<ProjectMember[]>([]) // 列表的数据
const queryParams = reactive({
  kbId: undefined
})
const queryFormRef = ref() // 搜索的表单
const libraryOptions = ref<any[]>([])
const libraryMap = ref<Record<number, string>>({})

/** 知识库ID → 名称 */
const kbIdFormatter = (_row: any, _column: any, cellValue: number) => {
  return libraryMap.value[cellValue] || cellValue
}

/** 查询列表 */
const getList = async () => {
  if (!queryParams.kbId) {
    list.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    list.value = await ProjectMemberApi.getMemberList(queryParams.kbId)
  } finally {
    loading.value = false
  }
}

/** 搜索按钮操作 */
const handleQuery = () => {
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  list.value = []
}

/** 添加成员 */
const userSelectFormRef = ref()
const openUserSelect = () => {
  if (!queryParams.kbId) {
    message.warning('请先选择项目成果库')
    return
  }
  // 传入 kbId 作为活动ID，已选用户列表为当前列表中的用户ID
  const selectedList = list.value.map((item) => ({ id: item.userId }))
  userSelectFormRef.value.open(queryParams.kbId, selectedList)
}

/** 用户选择确认回调 */
const handleUserSelectConfirm = async (_kbId: number, userList: any[]) => {
  loading.value = true
  try {
    // 获取当前已有的用户ID列表
    const existingUserIds = list.value.map((item) => item.userId)
    // 筛选出新增的用户
    const newUserList = userList.filter((user) => !existingUserIds.includes(user.id))
    // 批量添加
    for (const user of newUserList) {
      await ProjectMemberApi.addMember(queryParams.kbId, user.id)
    }
    message.success(t('common.createSuccess'))
    await getList()
  } finally {
    loading.value = false
  }
}

/** 移除成员 */
const handleRemove = async (row: ProjectMember) => {
  try {
    await message.delConfirm()
    await ProjectMemberApi.removeMember(queryParams.kbId, row.userId!)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 初始化：加载项目成果库列表 */
onMounted(async () => {
  const libs = await LibraryApi.getSimpleLibraryList(1)
  libraryOptions.value = libs
  const map: Record<number, string> = {}
  libs.forEach((lib: any) => { map[lib.id] = lib.name })
  libraryMap.value = map
})
</script>
