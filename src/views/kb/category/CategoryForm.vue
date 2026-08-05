<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      v-loading="formLoading"
    >
      <el-form-item label="分类名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入分类名称" />
      </el-form-item>
      <el-form-item label="关联层级配置" prop="kbLevelId">
        <el-select v-model="formData.kbLevelId" placeholder="请选择层级配置" style="width: 100%">
          <el-option
            v-for="item in levelConfigOptions"
            :key="item.id"
            :label="item.levelName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="父分类ID: 0=顶级分类" prop="parentId">
        <el-tree-select
          v-model="formData.parentId"
          :data="categoryTree"
          :props="defaultProps"
          check-strictly
          default-expand-all
          placeholder="请选择父分类ID: 0=顶级分类"
        />
      </el-form-item>
      <el-form-item label="排序" prop="sort">
        <el-input v-model="formData.sort" placeholder="请输入排序" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :value="0">启用</el-radio>
          <el-radio :value="1">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitForm" type="primary" :disabled="formLoading">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { CategoryApi, Category } from '@/api/kb/category'
import { LevelConfigApi } from '@/api/kb/levelconfig'
import { defaultProps, handleTree } from '@/utils/tree'

/** 知识库分类 表单 */
defineOptions({ name: 'CategoryForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref({
  id: undefined,
  name: undefined,
  kbLevelId: undefined,
  parentId: undefined,
  sort: undefined,
  status: undefined
})
const formRules = reactive({
  name: [{ required: true, message: '分类名称不能为空', trigger: 'blur' }]
})
const formRef = ref() // 表单 Ref
const categoryTree = ref() // 树形结构
const levelConfigOptions = ref<any[]>([])

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      formData.value = await CategoryApi.getCategory(id)
    } finally {
      formLoading.value = false
    }
  }
  await getCategoryTree()
  await getLevelConfigOptions()
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗

/** 获得层级配置列表 */
const getLevelConfigOptions = async () => {
  levelConfigOptions.value = await LevelConfigApi.getSimpleLevelConfigList()
}

/** 提交表单 */
const emit = defineEmits(['success']) // 定义 success 事件，用于操作成功后的回调
const submitForm = async () => {
  // 校验表单
  await formRef.value.validate()
  // 提交请求
  formLoading.value = true
  try {
    const data = formData.value as unknown as Category
    if (formType.value === 'create') {
      await CategoryApi.createCategory(data)
      message.success(t('common.createSuccess'))
    } else {
      await CategoryApi.updateCategory(data)
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
    kbLevelId: undefined,
    parentId: undefined,
    sort: undefined,
    status: undefined
  }
  formRef.value?.resetFields()
}

/** 获得知识库分类树 */
const getCategoryTree = async () => {
  categoryTree.value = []
  const data = await CategoryApi.getCategoryList(undefined)
  const root: Tree = { id: 0, name: '顶级知识库分类', children: [] }
  root.children = handleTree(data, 'id', 'parentId')
  categoryTree.value.push(root)
}
</script>
