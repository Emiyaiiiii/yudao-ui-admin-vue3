<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      v-loading="formLoading"
    >
      <el-form-item label="层级编码" prop="levelCode">
        <el-input v-model="formData.levelCode" placeholder="请输入层级编码" />
      </el-form-item>
      <el-form-item label="层级名称" prop="levelName">
        <el-input v-model="formData.levelName" placeholder="请输入层级名称" />
      </el-form-item>
      <el-form-item label="可见规则" prop="visibilityRule">
        <el-select v-model="formData.visibilityRule" placeholder="请选择可见规则" style="width: 100%">
          <el-option label="按所有者（个人知识库）" :value="1" />
          <el-option label="按归属部门（院级知识库）" :value="2" />
          <el-option label="全员（公司级知识库）" :value="3" />
          <el-option label="指定部门列表" :value="5" />
          <el-option label="查询公开（知识库广场）" :value="6" />
        </el-select>
      </el-form-item>
      <el-form-item label="归属维度" prop="ownerDim">
        <el-select v-model="formData.ownerDim" placeholder="请选择归属维度" style="width: 100%">
          <el-option label="无" :value="0" />
          <el-option label="用户" :value="1" />
          <el-option label="部门" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item label="部门可见范围" prop="deptScope">
        <el-tree-select
          v-model="formData.deptScope"
          :data="deptTree"
          :props="{ label: 'name', children: 'children', value: 'id' }"
          node-key="id"
          multiple
          check-strictly
          filterable
          placeholder="请选择可见部门（不选=全员可见）"
          style="width: 100%"
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
import { LevelConfigApi, LevelConfig } from '@/api/kb/levelconfig'
import * as DeptApi from '@/api/system/dept'
import { handleTree } from '@/utils/tree'

/** 知识库层级配置 表单 */
defineOptions({ name: 'LevelConfigForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref({
  id: undefined,
  levelCode: undefined,
  levelName: undefined,
  visibilityRule: undefined,
  ownerDim: undefined,
  deptScope: undefined,
  sort: undefined,
  status: undefined
})
const formRules = reactive({
  levelCode: [{ required: true, message: '层级编码不能为空', trigger: 'blur' }],
  levelName: [{ required: true, message: '层级名称不能为空', trigger: 'blur' }],
  visibilityRule: [{ required: true, message: '可见规则: 1=按所有者, 2=按归属部门, 3=全员, 5=指定部门列表不能为空', trigger: 'blur' }]
})
const formRef = ref() // 表单 Ref
const deptTree = ref<any[]>([])

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  // 加载部门树
  const deptData = await DeptApi.getSimpleDeptList()
  deptTree.value = handleTree(deptData)
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      const data = await LevelConfigApi.getLevelConfig(id)
      // deptScope 后端返回的是 JSON 字符串，需要解析为数组供 tree-select 使用
      if (typeof data.deptScope === 'string' && data.deptScope) {
        try {
          const parsed = JSON.parse(data.deptScope)
          data.deptScope = Array.isArray(parsed) ? parsed.map(Number) : [Number(parsed)]
        } catch {
          data.deptScope = []
        }
      } else {
        data.deptScope = []
      }
      formData.value = data
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
    const data = formData.value as unknown as LevelConfig
    if (Array.isArray(data.deptScope)) {
      data.deptScope = data.deptScope.length > 0 ? JSON.stringify(data.deptScope) : null
    }
    if (formType.value === 'create') {
      await LevelConfigApi.createLevelConfig(data)
      message.success(t('common.createSuccess'))
    } else {
      await LevelConfigApi.updateLevelConfig(data)
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
    levelCode: undefined,
    levelName: undefined,
    visibilityRule: undefined,
    ownerDim: undefined,
    deptScope: undefined,
    sort: undefined,
    status: undefined
  }
  formRef.value?.resetFields()
}
</script>