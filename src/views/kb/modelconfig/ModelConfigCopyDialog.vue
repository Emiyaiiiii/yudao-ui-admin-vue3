<template>
  <Dialog v-model="dialogVisible" title="复制模型配置" width="520">
    <el-form :model="copyForm" label-width="110px">
      <el-form-item label="新配置名称" prop="newName">
        <el-input v-model="copyForm.newName" placeholder="请输入新配置名称" />
      </el-form-item>
      <el-form-item label="新配置UID" prop="newUid">
        <el-input v-model="copyForm.newUid" placeholder="请输入新配置UID" />
      </el-form-item>
      <el-form-item label="初始状态">
        <el-switch
          v-model="copyForm.isActiveBool"
          active-text="激活"
          inactive-text="停用"
          :active-value="1"
          :inactive-value="0"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleCopy" :loading="copying">
        {{ copying ? '复制中...' : '确认复制' }}
      </el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useMessage } from '@/hooks/web/useMessage'
import { ModelConfigApi, type ModelConfig } from '@/api/kb/modelconfig'

defineOptions({ name: 'ModelConfigCopyDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const copying = ref(false)
const sourceConfig = ref<ModelConfig | null>(null)

const copyForm = reactive({
  newName: '',
  newUid: '',
  isActiveBool: 0
})

const emit = defineEmits(['success'])

const open = (row: ModelConfig) => {
  sourceConfig.value = row
  copyForm.newName = `${row.name} - 副本`
  copyForm.newUid = `${row.uid}-copy`
  copyForm.isActiveBool = 0
  dialogVisible.value = true
}

defineExpose({ open })

const handleCopy = async () => {
  if (!sourceConfig.value) return
  copying.value = true
  try {
    await ModelConfigApi.copy({
      id: sourceConfig.value.id,
      newName: copyForm.newName,
      newUid: copyForm.newUid,
      isActive: copyForm.isActiveBool
    })
    message.success('复制成功')
    dialogVisible.value = false
    emit('success')
  } catch {
    message.error('复制失败')
  } finally {
    copying.value = false
  }
}
</script>
