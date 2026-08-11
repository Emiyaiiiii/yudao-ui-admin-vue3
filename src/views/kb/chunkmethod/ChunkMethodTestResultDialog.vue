<template>
  <Dialog v-model="dialogVisible" title="测试结果" width="900">
    <div v-if="resultData" class="test-result">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="方法名称">
          {{ resultData.methodName }}
        </el-descriptions-item>
        <el-descriptions-item label="测试文本长度">
          {{ (resultData.testTextLength || 0).toLocaleString() }} 字符
        </el-descriptions-item>
        <el-descriptions-item label="分片数量">
          <el-tag type="primary">{{ resultData.chunkCount || 0 }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="处理时间">
          {{ resultData.processingTimeSeconds?.toFixed(3) || '0.000' }} 秒
        </el-descriptions-item>
        <el-descriptions-item label="处理速度">
          {{ (resultData.processingSpeedCharsPerSecond || 0).toLocaleString() }} 字符/秒
        </el-descriptions-item>
        <el-descriptions-item label="平均分片大小">
          {{ (resultData.avgChunkSize || 0).toLocaleString() }} 字符
        </el-descriptions-item>
      </el-descriptions>

      <el-divider>分片预览</el-divider>

      <div
        v-for="(chunk, index) in (resultData.chunksPreview || [])"
        :key="index"
        class="chunk-preview"
      >
        <div class="chunk-header">
          <span>分片 {{ index + 1 }}</span>
          <span class="size">大小: {{ (chunk.size || 0).toLocaleString() }} 字符</span>
        </div>
        <div class="chunk-content">
          {{ chunk.text || '' }}
        </div>
      </div>

      <div v-if="resultData.chunkCount > 3" class="more-chunks">
        还有 {{ resultData.chunkCount - 3 }} 个分片未显示...
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ChunkMethodTestResult } from '@/api/kb/chunkmethod'

defineOptions({ name: 'ChunkMethodTestResultDialog' })

const dialogVisible = ref(false)
const result = ref<ChunkMethodTestResult | null>(null)

const resultData = computed(() => result.value || null)

const open = (data: ChunkMethodTestResult) => {
  result.value = data
  dialogVisible.value = true
}

defineExpose({ open })
</script>

<style scoped>
.test-result .chunk-preview {
  margin-bottom: 20px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}
.chunk-preview .chunk-header {
  padding: 10px 15px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chunk-preview .chunk-header .size {
  color: #909399;
  font-size: 12px;
}
.chunk-preview .chunk-content {
  padding: 15px;
  max-height: 200px;
  overflow-y: auto;
  line-height: 1.5;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.more-chunks {
  text-align: center;
  color: #909399;
  font-size: 14px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  margin-top: 10px;
}
</style>
