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
      <el-form-item label="分类名称" prop="name">
        <el-input
          v-model="queryParams.name"
          placeholder="请输入分类名称"
          clearable
          @keyup.enter="handleQuery"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item label="层级配置" prop="kbLevelId">
        <el-select v-model="queryParams.kbLevelId" placeholder="请选择层级配置" clearable class="!w-240px">
          <el-option v-for="item in levelConfigOptions" :key="item.id" :label="item.levelName" :value="item.id" />
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
          v-hasPermi="['kb:category:create']"
        >
          <Icon icon="ep:plus" class="mr-5px" /> 新增
        </el-button>
        <el-button
          type="success"
          plain
          @click="handleExport"
          :loading="exportLoading"
          v-hasPermi="['kb:category:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-button type="danger" plain @click="toggleExpandAll">
          <Icon icon="ep:sort" class="mr-5px" /> 展开/折叠
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
      row-key="id"
      :default-expand-all="isExpandAll"
      v-if="refreshTable"
    >
      <el-table-column label="分类名称" align="center" prop="name" min-width="150px" />
      <el-table-column label="层级配置" align="center" prop="kbLevelId" :formatter="levelConfigFormatter" min-width="120px" />
      <el-table-column label="父分类" align="center" prop="parentId" :formatter="parentCategoryFormatter" min-width="120px" />
      <el-table-column label="排序" align="center" prop="sort" width="60px" />
      <el-table-column label="状态" align="center" width="80px">
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
            v-hasPermi="['kb:category:update']"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(scope.row.id)"
            v-hasPermi="['kb:category:delete']"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <!-- 表单弹窗：添加/修改 -->
  <CategoryForm ref="formRef" @success="getList" />
</template>

<script setup lang="ts">
import { isEmpty } from '@/utils/is'
import { dateFormatter } from '@/utils/formatTime'
import { handleTree } from '@/utils/tree'
import download from '@/utils/download'
import { CategoryApi, Category } from '@/api/kb/category'
import { LevelConfigApi } from '@/api/kb/levelconfig'
import CategoryForm from './CategoryForm.vue'

/** 知识库分类 列表 */
defineOptions({ name: 'Category' })

const message = useMessage() // 消息弹窗
const { t } = useI18n() // 国际化

const loading = ref(true) // 列表的加载中
const list = ref<Category[]>([]) // 列表的数据
const queryParams = reactive({
  name: undefined,
  kbLevelId: undefined,
  parentId: undefined,
  sort: undefined,
  status: undefined,
  createTime: []
})
const queryFormRef = ref() // 搜索的表单
const exportLoading = ref(false) // 导出的加载中
const levelConfigOptions = ref<any[]>([])
const levelConfigMap = ref<Record<number, string>>({})

/** 层级配置ID → 名称 */
const levelConfigFormatter = (_row: any, _column: any, cellValue: number) => {
  return levelConfigMap.value[cellValue] || cellValue
}

/** 父分类ID → 名称 */
const parentCategoryFormatter = (_row: any, _column: any, cellValue: number) => {
  if (cellValue === 0 || cellValue === null) return '—'
  return categoryNameMap.value[cellValue] || cellValue
}
const categoryNameMap = ref<Record<number, string>>({})

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    // 使用按部门过滤的接口，普通用户看不到无权访问的分类
    const data = await CategoryApi.listCategoriesForUser()
    list.value = handleTree(data, 'id', 'parentId')
    // 构建分类名称映射（用于父分类显示）
    const map: Record<number, string> = {}
    const flatten = (items: any[]) => {
      items.forEach((item: any) => {
        map[item.id] = item.name
        if (item.children) flatten(item.children)
      })
    }
    flatten(data)
    categoryNameMap.value = map
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
    await CategoryApi.deleteCategory(id)
    message.success(t('common.delSuccess'))
    // 刷新列表
    await getList()
  } catch {}
}


/** 导出按钮操作 */
const handleExport = async () => {
  try {
    // 导出的二次确认
    await message.exportConfirm()
    // 发起导出
    exportLoading.value = true
    const data = await CategoryApi.exportCategory(queryParams)
    download.excel(data, '知识库分类.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 展开/折叠操作 */
const isExpandAll = ref(true) // 是否展开，默认全部展开
const refreshTable = ref(true) // 重新渲染表格状态
const toggleExpandAll = async () => {
  refreshTable.value = false
  isExpandAll.value = !isExpandAll.value
  await nextTick()
  refreshTable.value = true
}

/** 初始化 **/
onMounted(() => {
  getList()
  loadLevelConfigOptions()
})

const loadLevelConfigOptions = async () => {
  const data = await LevelConfigApi.getSimpleLevelConfigList()
  levelConfigOptions.value = data
  const map: Record<number, string> = {}
  data.forEach((item: any) => { map[item.id] = item.levelName })
  levelConfigMap.value = map
}
</script>