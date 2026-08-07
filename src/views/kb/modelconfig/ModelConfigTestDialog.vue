<template>
  <Dialog v-model="dialogVisible" title="测试模型连接" width="650">
    <el-form :model="testForm" label-width="110px">
      <el-form-item label="测试消息">
        <el-input
          v-model="testForm.testMessage"
          type="textarea"
          :rows="4"
          placeholder="请输入测试消息"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="Temperature">
        <div style="display: flex; align-items: center; gap: 20px; width: 100%;">
          <el-slider
            v-model="testForm.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            style="flex: 1;"
          />
          <el-input-number
            v-model="testForm.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :precision="1"
            size="small"
            style="width: 100px;"
          />
        </div>
      </el-form-item>
      <el-form-item label="Max Tokens">
        <el-input-number
          v-model="testForm.maxTokens"
          :min="1"
          :max="1000000"
          class="w-full"
        />
      </el-form-item>
    </el-form>

    <!-- 测试结果 -->
    <div v-if="testResult" class="mt-20px">
      <div
        class="flex items-center gap-8px p-14px rounded-lg mb-20px"
        :style="{ background: testResult.success ? 'rgba(103,194,58,0.08)' : 'rgba(245,108,108,0.08)' }"
      >
        <Icon :icon="testResult.success ? 'ep:circle-check' : 'ep:circle-close'" :size="24"
          :color="testResult.success ? '#67c23a' : '#f56c6c'" />
        <span class="text-16px fw-600" :style="{ color: testResult.success ? '#67c23a' : '#f56c6c' }">
          {{ testResult.success ? '测试成功' : '测试失败' }}
        </span>
        <span v-if="testResult.responseTime" class="ml-auto text-14px" style="color: #666;">
          响应时间: {{ testResult.responseTime.toFixed(2) }}s
        </span>
      </div>

      <div v-if="testResult.error" class="mb-20px">
        <h4 class="mb-8px text-14px" style="color: #333;">错误信息:</h4>
        <pre class="p-12px rounded-lg text-12px" style="background: #fef0f0; color: #f56c6c; white-space: pre-wrap; line-height: 1.5;">{{ testResult.error }}</pre>
      </div>

      <div v-if="testResult.response" class="mb-20px">
        <h4 class="mb-8px text-14px" style="color: #333;">模型回复:</h4>
        <pre class="p-12px rounded-lg text-12px" style="background: #f6f8fa; color: #333; white-space: pre-wrap; line-height: 1.5;">{{ testResult.response }}</pre>
      </div>

      <div v-if="testResult.modelInfo" class="mb-20px">
        <h4 class="mb-8px text-14px" style="color: #333;">模型信息:</h4>
        <div class="p-12px rounded-lg text-12px" style="background: #f6f8fa; line-height: 1.6;">
          <div>名称: {{ testResult.modelInfo.name }}</div>
          <div>UID: {{ testResult.modelInfo.uid }}</div>
          <div>部署类型: {{ testResult.modelInfo.deploy }}</div>
          <div>API地址: {{ testResult.modelInfo.url }}</div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleTest" :loading="testing">
        {{ testing ? '测试中...' : '开始测试' }}
      </el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useMessage } from '@/hooks/web/useMessage'
import { ModelConfigApi, type ModelConfigTestResult } from '@/api/kb/modelconfig'

defineOptions({ name: 'ModelConfigTestDialog' })

const message = useMessage()

const dialogVisible = ref(false)
const testing = ref(false)
const testResult = ref<ModelConfigTestResult | null>(null)
const configId = ref<number>(0)

const testForm = reactive({
  testMessage: '你好，请回复"测试成功"',
  temperature: 0.7,
  maxTokens: 100
})

const open = (row: { id: number }) => {
  configId.value = row.id
  testResult.value = null
  testForm.testMessage = '你好，请回复"测试成功"'
  testForm.temperature = 0.7
  testForm.maxTokens = 100
  dialogVisible.value = true
}

defineExpose({ open })

const handleTest = async () => {
  testing.value = true
  try {
    const res = await ModelConfigApi.test({
      id: configId.value,
      testMessage: testForm.testMessage,
      temperature: testForm.temperature,
      maxTokens: testForm.maxTokens
    })
    testResult.value = res
    if (res.success) {
      message.success('测试成功')
    } else {
      message.warning('测试失败: ' + (res.error || '未知错误'))
    }
  } catch {
    message.error('测试请求失败')
  } finally {
    testing.value = false
  }
}
</script>
