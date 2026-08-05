<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible" width="700">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="110px"
      v-loading="formLoading"
    >
      <el-form-item label="知识库名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入知识库名称" />
      </el-form-item>
      <el-form-item label="所属分类" prop="categoryId">
        <el-tree-select
          v-model="formData.categoryId"
          :data="categoryTree"
          :props="defaultTreeProps"
          check-strictly
          default-expand-all
          placeholder="请选择知识库分类"
          style="width: 100%"
          @change="handleCategoryChange"
          :disabled="categoryDisabled"
        />
      </el-form-item>
      <!-- 层级配置由分类自动决定，仅展示 -->
      <el-form-item v-if="selectedLevelName" label="层级配置">
        <el-tag type="info" size="large">
          {{ selectedLevelName }}（{{ visibilityRuleLabel(selectedVisibilityRule) }}）
        </el-tag>
      </el-form-item>

      <!-- 所有者：根据选中的层级配置动态切换 -->
      <!-- ownerDim=1（用户）→ 个人知识库，自动设为当前用户 -->
      <el-form-item v-if="selectedOwnerDim === 1" label="所有者">
        <el-tag type="primary" size="large">{{ currentUserNickname }}</el-tag>
      </el-form-item>
      <el-form-item v-else-if="selectedOwnerDim === 2" label="所属部门" prop="ownerId">
        <el-tree-select
          v-model="formData.ownerId"
          :data="deptTree"
          :props="defaultTreeProps"
          check-strictly
          default-expand-all
          placeholder="请选择所属部门"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="封面图片" prop="coverUrl">
        <UploadImg v-model="formData.coverUrl" width="200px" height="120px" />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <Editor v-model="formData.description" height="150px" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :value="0">启用</el-radio>
          <el-radio :value="1">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
      <!-- 只有个人知识库（rule=1）才能公开到广场 -->
      <el-form-item v-if="selectedVisibilityRule === 1" label="公开到广场" prop="isPublic">
        <el-switch
          v-model="formData.isPublic"
          :active-value="1"
          :inactive-value="0"
          active-text="公开"
          inactive-text="不公开"
        />
      </el-form-item>
      <el-form-item label="共享部门" prop="shareDeptIds" v-if="selectedVisibilityRule === 5">
        <el-select
          v-model="formData.shareDeptIds"
          multiple
          filterable
          placeholder="请选择共享部门"
          style="width: 100%"
        >
          <el-option
            v-for="dept in deptOptions"
            :key="dept.id"
            :label="dept.name"
            :value="dept.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitForm" type="primary" :disabled="formLoading">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { LibraryApi, Library } from '@/api/kb/library'
import { CategoryApi } from '@/api/kb/category'
import { LevelConfigApi } from '@/api/kb/levelconfig'
import { UserDeptApi } from '@/api/kb/userdept'
import { ref, reactive, computed } from 'vue'
import * as SystemApi from '@/api/system/dept'
import { useUserStore } from '@/store/modules/user'
import { handleTree } from '@/utils/tree'
import { defaultProps } from '@/utils/tree'

/** 知识库 表单 */
defineOptions({ name: 'LibraryForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref({
  id: undefined,
  name: undefined,
  categoryId: undefined,
  kbLevelId: undefined,
  ownerId: undefined,
  description: undefined,
  coverUrl: undefined,
  docCount: undefined,
  status: 0,
  isPublic: 0,
  shareDeptIds: []
})
const formRules = reactive({
  name: [{ required: true, message: '知识库名称不能为空', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择知识库分类', trigger: 'change' }]
})
const formRef = ref() // 表单 Ref

// 分类树
const categoryTree = ref<any[]>([])
const defaultTreeProps = { ...defaultProps, label: 'name' }

// 层级配置
const levelConfigMap = ref<Record<number, any>>({})      // 层级配置ID → 完整配置
const categoryKbLevelMap = ref<Record<number, number>>({}) // 分类ID → 层级配置ID
const selectedLevelName = ref('')   // 当前选中层级配置名称（仅展示用）
const selectedOwnerDim = ref(0)     // 当前选中层级配置的 owner_dim
const selectedVisibilityRule = ref(0) // 当前选中层级配置的 visibilityRule

// 部门列表
const deptTree = ref<any[]>([])
const deptOptions = ref<any[]>([])

// 当前用户
const userStore = useUserStore()
const currentUserId = computed(() => userStore.getUser?.id)
const currentUserNickname = computed(() => userStore.getUser?.nickname || '当前用户')
// 是否为超管/租户管理员（跳过过滤，显示全部）
const isSuperAdmin = computed(() => {
  const roles = userStore.roles || []
  return roles.includes('super_admin') || roles.includes('tenant_admin')
})

// 可见规则标签映射
const visibilityRuleLabel = (rule: number) => {
  const map: Record<number, string> = {
    1: '按所有者',
    2: '按归属部门',
    3: '全员',
    5: '指定部门列表'
  }
  return map[rule] || `规则${rule}`
}

/** 层级配置变更时，更新 owner_dim、visibilityRule 和显示名称 */
const applyLevelConfig = (kbLevelId: number) => {
  const cfg = levelConfigMap.value[kbLevelId]
  if (cfg) {
    formData.value.kbLevelId = kbLevelId
    selectedLevelName.value = cfg.levelName || ''
    selectedOwnerDim.value = cfg.ownerDim ?? 0
    selectedVisibilityRule.value = cfg.visibilityRule ?? 0
    // ownerDim=1（用户）→ 个人知识库，自动设为当前用户
    // ownerDim=2（部门）→ 清除，等待用户选择部门
    formData.value.ownerId = (cfg.ownerDim === 1) ? currentUserId.value : undefined
    // 非个人知识库不能公开到广场
    if (cfg.visibilityRule !== 1) {
      formData.value.isPublic = 0
    }
  } else {
    selectedLevelName.value = ''
    selectedOwnerDim.value = 0
    selectedVisibilityRule.value = 0
  }
}

/** 分类变更时，自动填入对应的层级配置 */
const handleCategoryChange = (categoryId: number) => {
  if (!categoryId) {
    formData.value.kbLevelId = undefined
    selectedLevelName.value = ''
    selectedOwnerDim.value = 0
    selectedVisibilityRule.value = 0
    return
  }
  const kbLevelId = categoryKbLevelMap.value[categoryId]
  if (kbLevelId) {
    applyLevelConfig(kbLevelId)
  }
}

/** 加载初始化数据 */
const loadOptions = async () => {
  // 并行加载分类、层级配置、部门、管理员部门
  const [categoryData, levelData, deptData, adminDeptIds] = await Promise.all([
    CategoryApi.getCategoryList(),
    LevelConfigApi.getSimpleLevelConfigList(),
    SystemApi.getSimpleDeptList(),
    UserDeptApi.getMyAdminDepts()
  ])

  // 构建层级配置ID → 完整配置映射
  levelConfigMap.value = {}
  levelData.forEach((item: any) => {
    levelConfigMap.value[item.id] = item
  })

  // 超管/租户管理员 → 显示全部，不过滤
  if (isSuperAdmin.value) {
    categoryTree.value = handleTree(categoryData, 'id', 'parentId')
    deptTree.value = handleTree(deptData)
    deptOptions.value = deptData
    // 构建分类ID → 层级配置ID 映射
    const catMap: Record<number, number> = {}
    const flatten = (items: any[]) => {
      items.forEach((item: any) => {
        if (item.kbLevelId) catMap[item.id] = item.kbLevelId
        if (item.children) flatten(item.children)
      })
    }
    flatten(categoryData)
    categoryKbLevelMap.value = catMap
    return
  }

  // 构建管理员部门ID集合（用于过滤）
  const adminDeptSet = new Set<number>(adminDeptIds || [])
  const hasAnyAdminDept = adminDeptSet.size > 0

  // 过滤分类树：只显示用户有权限创建的分类
  // - rule=1（个人知识库）：所有人可见
  // - 其他：只有管理员可见
  const filterCategories = (items: any[]): any[] => {
    return items
      .map((item: any) => {
        const children = item.children ? filterCategories(item.children) : []
        const kbLevelId = item.kbLevelId
        if (!kbLevelId) return null
        const cfg = levelConfigMap.value[kbLevelId]
        if (!cfg) return null
        // 个人知识库（rule=1）→ 所有人可见
        if (cfg.visibilityRule === 1) return { ...item, children }
        // 其他 → 仅管理员可见
        if (hasAnyAdminDept) return { ...item, children }
        // 不满足条件但子节点有内容 → 保留父节点作为分组
        if (children.length > 0) return { ...item, children }
        return null
      })
      .filter(Boolean) as any[]
  }
  const filteredCategoryData = filterCategories(categoryData)
  categoryTree.value = handleTree(filteredCategoryData, 'id', 'parentId')

  // 构建分类ID → 层级配置ID 映射
  const catMap: Record<number, number> = {}
  const flatten = (items: any[]) => {
    items.forEach((item: any) => {
      if (item.kbLevelId) catMap[item.id] = item.kbLevelId
      if (item.children) flatten(item.children)
    })
  }
  flatten(filteredCategoryData)
  categoryKbLevelMap.value = catMap

  // 过滤部门树：只显示用户作为管理员的部门（及其祖先节点以保持树结构）
  const filterDeptTree = (items: any[]): any[] => {
    return items
      .map((item: any) => {
        const children = item.children ? filterDeptTree(item.children) : []
        // 保留：是管理员部门 或 有管理员子节点
        if (adminDeptSet.has(item.id) || children.length > 0) {
          return { ...item, children }
        }
        return null
      })
      .filter(Boolean) as any[]
  }
  const filteredDeptTree = filterDeptTree(handleTree(deptData))
  deptTree.value = filteredDeptTree
  deptOptions.value = deptData
}

const categoryDisabled = ref(false) // 分类选择是否禁用（从总览页预选时禁用）

/** 打开弹窗 */
const open = async (type: string, id?: number, presetCategoryId?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  categoryDisabled.value = false
  // 加载备选项
  await loadOptions()
  // 如果传入了预选分类，直接选中并禁用分类选择
  if (presetCategoryId) {
    formData.value.categoryId = presetCategoryId
    categoryDisabled.value = true
    handleCategoryChange(presetCategoryId)
  }
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      const data = await LibraryApi.getLibrary(id)
      formData.value = data
      // 回显时同步层级配置信息
      if (data.kbLevelId) {
        applyLevelConfig(data.kbLevelId)
      }
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗

/** 提交表单 */
const emit = defineEmits(['success']) // 定义 success 事件，用于操作成功后的回调
const submitForm = async () => {
  // 校验表单
  await formRef.value.validate()
  // 提交请求
  formLoading.value = true
  try {
    const data = formData.value as unknown as Library
    // 删除 docCount，创建时不需要
    delete (data as any).docCount
    if (formType.value === 'create') {
      await LibraryApi.createLibrary(data)
      message.success(t('common.createSuccess'))
    } else {
      await LibraryApi.updateLibrary(data)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    // 发送操作成功的事件
    emit('success')
  } finally {
    formLoading.value = false
  }
}

/** 重置表单 */
const resetForm = () => {
  formData.value = {
    id: undefined,
    name: undefined,
    categoryId: undefined,
    kbLevelId: undefined,
    ownerId: undefined,
    description: undefined,
    coverUrl: undefined,
    docCount: undefined,
    status: 0,
    isPublic: 0,
    shareDeptIds: []
  }
  selectedLevelName.value = ''
  selectedOwnerDim.value = 0
  selectedVisibilityRule.value = 0
  formRef.value?.resetFields()
}
</script>
