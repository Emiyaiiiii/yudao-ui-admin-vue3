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
      <el-form-item label="知识库名称" prop="name">
        <el-input
          v-model="queryParams.name"
          placeholder="请输入知识库名称"
          clearable
          @keyup.enter="handleQuery"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item label="所属分类" prop="categoryId">
        <el-tree-select
          v-model="queryParams.categoryId"
          :data="categoryTree"
          node-key="id"
          :props="{ label: 'name', children: 'children' }"
          check-strictly
          clearable
          placeholder="请选择分类"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item label="层级配置" prop="kbLevelId">
        <el-select
          v-model="queryParams.kbLevelId"
          placeholder="请选择层级配置"
          clearable
          class="!w-240px"
        >
          <el-option
            v-for="item in levelConfigOptions"
            :key="item.id"
            :label="item.levelName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="公开状态" prop="isPublic">
        <el-select
          v-model="queryParams.isPublic"
          placeholder="请选择公开状态"
          clearable
          class="!w-240px"
        >
          <el-option label="公开" :value="1" />
          <el-option label="不公开" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable class="!w-240px">
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
          v-hasPermi="['kb:library:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增
        </el-button>
        <el-button
          type="success"
          plain
          @click="handleExport"
          :loading="exportLoading"
          v-hasPermi="['kb:library:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="isEmpty(checkedIds)"
          @click="handleDeleteBatch"
          v-hasPermi="['kb:library:delete']"
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
      <el-table-column label="知识库名称" align="center" prop="name" min-width="150px" />
      <el-table-column
        label="所属分类"
        align="center"
        prop="categoryId"
        :formatter="categoryFormatter"
        min-width="120px"
      />
      <el-table-column
        label="层级配置"
        align="center"
        prop="kbLevelId"
        :formatter="levelConfigFormatter"
        min-width="100px"
      />
      <el-table-column
        label="所有者"
        align="center"
        prop="ownerId"
        :formatter="ownerFormatter"
        min-width="100px"
      />
      <el-table-column label="描述" align="center" prop="description" min-width="120px" />
      <el-table-column label="封面" align="center" min-width="100px">
        <template #default="scope">
          <el-image
            v-if="scope.row.coverUrl"
            :src="scope.row.coverUrl"
            style="width: 40px; height: 40px"
            fit="cover"
          />
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="文档数" align="center" prop="docCount" width="70px" />
      <el-table-column label="状态" align="center" prop="status">
        <template #default="scope">
          <el-tag :type="scope.row.status === 0 ? 'success' : 'danger'" size="small">
            {{ scope.row.status === 0 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="广场公开" align="center" prop="isPublic">
        <template #default="scope">
          <el-tag :type="scope.row.isPublic === 1 ? 'success' : 'info'" size="small">
            {{ scope.row.isPublic === 1 ? '是' : '否' }}
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
            v-hasPermi="['kb:library:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['kb:library:delete']"
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
  <LibraryForm ref="formRef" @success="getList" />
</template>

<script setup lang="ts">
import { isEmpty } from '@/utils/is'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import { LibraryApi, Library } from '@/api/kb/library'
import { CategoryApi } from '@/api/kb/category'
import { LevelConfigApi } from '@/api/kb/levelconfig'
import { handleTree } from '@/utils/tree'
import { getSimpleUserList } from '@/api/system/user'
import * as DeptApi from '@/api/system/dept'
import LibraryForm from './LibraryForm.vue'

/** 知识库 列表 */
defineOptions({ name: 'Library' })

const message = useMessage() // 消息弹窗
const { t } = useI18n() // 国际化

const loading = ref(true) // 列表的加载中
const list = ref<Library[]>([]) // 列表的数据
const total = ref(0) // 列表的总页数
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  name: undefined,
  categoryId: undefined,
  kbLevelId: undefined,
  isPublic: undefined,
  status: undefined,
  createTime: []
})
const queryFormRef = ref() // 搜索的表单
const exportLoading = ref(false) // 导出的加载中

const categoryTree = ref<any[]>([]) // 分类树
const categoryMap = ref<Record<number, string>>({}) // 分类ID→名称
const levelConfigOptions = ref<any[]>([]) // 层级配置选项
const levelConfigMap = ref<Record<number, any>>({}) // 层级配置ID→完整配置
const userMap = ref<Record<number, string>>({}) // 用户ID→昵称
const deptMap = ref<Record<number, string>>({}) // 部门ID→名称

/** 分类ID → 分类名称 */
const categoryFormatter = (_row: any, _column: any, cellValue: number) => {
  return categoryMap.value[cellValue] || cellValue
}

/** 层级配置ID → 层级名称 */
const levelConfigFormatter = (_row: any, _column: any, cellValue: number) => {
  const cfg = levelConfigMap.value[cellValue]
  return cfg ? cfg.levelName : cellValue
}

/** 所有者ID → 名称（根据层级配置的 ownerDim 判断是用户还是部门） */
const ownerFormatter = (_row: any, _column: any, cellValue: number) => {
  if (!cellValue) return '—'
  const row = _row as Library
  const cfg = row ? levelConfigMap.value[row.kbLevelId] : null
  const ownerDim = cfg ? cfg.ownerDim : 0
  if (ownerDim === 1) {
    // 用户维度
    return userMap.value[cellValue] || cellValue
  } else if (ownerDim === 2) {
    // 部门维度
    return deptMap.value[cellValue] || cellValue
  }
  return cellValue
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await LibraryApi.getLibraryPage(queryParams)
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
    await LibraryApi.deleteLibrary(id)
    message.success(t('common.delSuccess'))
    // 刷新列表
    await getList()
  } catch {}
}

/** 批量删除知识库 */
const handleDeleteBatch = async () => {
  try {
    // 删除的二次确认
    await message.delConfirm()
    await LibraryApi.deleteLibraryList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (records: Library[]) => {
  checkedIds.value = records.map((item) => item.id!)
}

/** 导出按钮操作 */
const handleExport = async () => {
  try {
    // 导出的二次确认
    await message.exportConfirm()
    // 发起导出
    exportLoading.value = true
    const data = await LibraryApi.exportLibrary(queryParams)
    download.excel(data, '知识库.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(() => {
  getList()
  loadSearchOptions()
})

/** 加载搜索选项 */
const loadSearchOptions = async () => {
  const [categoryData, levelData, userData, deptData] = await Promise.all([
    CategoryApi.getCategoryList(undefined),
    LevelConfigApi.getSimpleLevelConfigList(),
    getSimpleUserList(),
    DeptApi.getSimpleDeptList()
  ])
  categoryTree.value = handleTree(categoryData, 'id', 'parentId')
  // 构建分类ID→名称映射
  const catMap: Record<number, string> = {}
  const flatten = (items: any[]) => {
    items.forEach((item: any) => {
      catMap[item.id] = item.name
      if (item.children) flatten(item.children)
    })
  }
  flatten(categoryData)
  categoryMap.value = catMap

  levelConfigOptions.value = levelData
  // 构建层级配置ID→完整配置映射
  const lvMap: Record<number, any> = {}
  levelData.forEach((item: any) => {
    lvMap[item.id] = item
  })
  levelConfigMap.value = lvMap

  // 构建用户ID→昵称映射
  const uMap: Record<number, string> = {}
  userData.forEach((u: any) => {
    uMap[u.id] = u.nickname
  })
  userMap.value = uMap

  // 构建部门ID→名称映射
  const dMap: Record<number, string> = {}
  const flattenDept = (items: any[]) => {
    items.forEach((item: any) => {
      dMap[item.id] = item.name
      if (item.children) flattenDept(item.children)
    })
  }
  flattenDept(deptData)
  deptMap.value = dMap
}
</script>
