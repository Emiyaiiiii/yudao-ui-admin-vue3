<template>
  <Dialog v-model="dialogVisible" :title="`测试切片方法 - ${methodData?.name || ''}`" width="800">
    <el-form :model="testForm" label-width="100px">
      <el-form-item label="方法名称">
        <el-input :value="methodData?.name || ''" disabled />
      </el-form-item>
      <el-form-item label="方法类型">
        <el-tag>{{ getMethodTypeDisplay(methodData?.methodType) }}</el-tag>
      </el-form-item>
      <el-form-item label="测试文本" required>
        <el-input
          v-model="testForm.testText"
          type="textarea"
          :rows="8"
          placeholder="请输入要测试的文本内容..."
          show-word-limit
          maxlength="10000"
        />
      </el-form-item>
      <el-form-item label="文本长度">
        {{ testForm.testText.length }} 字符
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button
        type="primary"
        @click="handleSubmit"
        :loading="testing"
        :disabled="!testForm.testText"
      >
        {{ testing ? '测试中...' : '开始测试' }}
      </el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useMessage } from '@/hooks/web/useMessage'
import { ChunkMethodApi, type ChunkMethod } from '@/api/kb/chunkmethod'

defineOptions({ name: 'ChunkMethodTestDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const testing = ref(false)
const methodData = ref<ChunkMethod | null>(null)

const testForm = reactive({
  testText: ''
})

const emit = defineEmits(['testSuccess'])

const methodTypeDisplayMap: Record<string, string> = {
  fixed_size: '固定大小', semantic: '语义分段', hierarchical: '层次分段',
  recursive: '递归分割', sentence: '按句子', paragraph: '按段落',
  section: '按章节', custom: '自定义'
}

const getMethodTypeDisplay = (type?: string) => methodTypeDisplayMap[type || ''] || type || '-'

const open = (row: ChunkMethod) => {
  methodData.value = row
  testForm.testText = ''
  dialogVisible.value = true
}

defineExpose({ open })

const handleSubmit = async () => {
  if (!testForm.testText) {
    message.warning('请输入测试文本')
    return
  }

  testing.value = true
  try {
    const result = await ChunkMethodApi.test({
      id: methodData.value!.id,
      testText: testForm.testText
    })
    message.success('测试完成')
    dialogVisible.value = false
    emit('testSuccess', result)
  } catch {
    message.error('测试失败')
  } finally {
    testing.value = false
  }
}
</script>
