<template>
  <Dialog v-model="dialogVisible" title="批量分配角色" width="500">
    <div v-loading="formLoading">
      <el-alert
        :title="`已选择 ${userIds.length} 个用户，将统一分配以下角色（覆盖原有角色）`"
        type="info"
        :closable="false"
        show-icon
        class="mb-20px"
      />
      <el-form ref="formRef" :model="formData" label-width="80px">
        <el-form-item label="角色">
          <el-select v-model="formData.roleIds" multiple placeholder="请选择角色" class="!w-full">
            <el-option v-for="item in roleList" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button :disabled="formLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script lang="ts" setup>
import * as PermissionApi from '@/api/system/permission'
import * as RoleApi from '@/api/system/role'

defineOptions({ name: 'SystemUserBatchAssignRoleForm' })

const { t } = useI18n()
const message = useMessage()

const dialogVisible = ref(false)
const formLoading = ref(false)
const formData = ref({
  roleIds: []
})
const formRef = ref()
const roleList = ref([] as RoleApi.RoleVO[])
const userIds = ref<number[]>([])

/** 打开弹窗 */
const open = async (ids: number[]) => {
  dialogVisible.value = true
  resetForm()
  userIds.value = ids
  // 获得角色列表
  formLoading.value = true
  try {
    roleList.value = await RoleApi.getSimpleRoleList()
  } finally {
    formLoading.value = false
  }
}
defineExpose({ open })

/** 提交表单 */
const emit = defineEmits(['success'])
const submitForm = async () => {
  formLoading.value = true
  try {
    await PermissionApi.batchAssignUserRole({
      userIds: userIds.value,
      roleIds: formData.value.roleIds
    })
    message.success('批量分配角色成功')
    dialogVisible.value = false
    emit('success', true)
  } finally {
    formLoading.value = false
  }
}

/** 重置表单 */
const resetForm = () => {
  formData.value = {
    roleIds: []
  }
  formRef.value?.resetFields()
}
</script>
