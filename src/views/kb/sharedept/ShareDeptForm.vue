<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
      v-loading="formLoading"
    >
      <el-form-item label="选择知识库" prop="kbId">
        <el-select v-model="formData.kbId" placeholder="请选择知识库" filterable style="width: 100%">
          <el-option v-for="item in libraryOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="共享目标部门" prop="deptId">
        <el-tree-select
          v-model="formData.deptId"
          :data="deptTree"
          :props="{ label: 'name', children: 'children' }"
          check-strictly
          default-expand-all
          placeholder="请选择共享部门"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitForm" type="primary" :disabled="formLoading">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { ShareDeptApi, ShareDept } from '@/api/kb/sharedept'
import { LibraryApi } from '@/api/kb/library'
import * as DeptApi from '@/api/system/dept'
import { handleTree } from '@/utils/tree'
import { ref, reactive } from 'vue'

/** 知识库共享部门关联 表单 */
defineOptions({ name: 'ShareDeptForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref({
  id: undefined,
  kbId: undefined,
  deptId: undefined
})
const formRules = reactive({
  kbId: [{ required: true, message: '请选择知识库', trigger: 'change' }],
  deptId: [{ required: true, message: '请选择共享部门', trigger: 'change' }]
})
const formRef = ref() // 表单 Ref

// 知识库选项
const libraryOptions = ref<any[]>([])
// 部门树
const deptTree = ref<any[]>([])

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  // 加载备选项
  const [libraryData, deptData] = await Promise.all([
    LibraryApi.getSimpleLibraryList(),
    DeptApi.getSimpleDeptList()
  ])
  libraryOptions.value = libraryData
  deptTree.value = handleTree(deptData)
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      formData.value = await ShareDeptApi.getShareDept(id)
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
    const data = formData.value as unknown as ShareDept
    if (formType.value === 'create') {
      await ShareDeptApi.createShareDept(data)
      message.success(t('common.createSuccess'))
    } else {
      await ShareDeptApi.updateShareDept(data)
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
    kbId: undefined,
    deptId: undefined
  }
  formRef.value?.resetFields()
}
</script>