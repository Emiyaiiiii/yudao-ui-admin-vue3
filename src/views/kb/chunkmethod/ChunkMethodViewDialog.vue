<template>
  <Dialog v-model="dialogVisible" title="查看切片方法" width="800">
    <el-descriptions :column="2" border>
      <el-descriptions-item label="方法名称">
        {{ viewData.name || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="方法代码">
        {{ viewData.code || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="方法类型">
        <el-tag>{{ getMethodTypeDisplay(viewData.methodType) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="viewData.isActive ? 'success' : 'danger'" size="small">
          {{ viewData.isActive ? '启用' : '停用' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="是否默认">
        <el-tag :type="viewData.isDefaultMethod ? 'warning' : 'info'" size="small">
          {{ viewData.isDefaultMethod ? '默认方法' : '普通方法' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="处理器类">
        {{ viewData.handlerClass || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="单块大小">
        {{ getCoreParam(viewData, 'chunk_size', '1000') }} 字符
      </el-descriptions-item>
      <el-descriptions-item label="块间重叠">
        {{ getCoreParam(viewData, 'chunk_overlap', '200') }} 字符
      </el-descriptions-item>
      <el-descriptions-item label="创建时间">
        {{ formatDateDisplay(viewData.createTime) }}
      </el-descriptions-item>
      <el-descriptions-item label="更新时间">
        {{ formatDateDisplay(viewData.updateTime) }}
      </el-descriptions-item>
      <el-descriptions-item label="描述" :span="2">
        {{ viewData.description || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="参数模板" :span="2">
        <pre class="json-preview">{{ formatJson(viewData.parametersTemplate) }}</pre>
      </el-descriptions-item>
      <el-descriptions-item label="默认参数" :span="2">
        <pre class="json-preview">{{ formatJson(viewData.defaultParameters) }}</pre>
      </el-descriptions-item>
    </el-descriptions>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ChunkMethod } from '@/api/kb/chunkmethod'

defineOptions({ name: 'ChunkMethodViewDialog' })

const dialogVisible = ref(false)
const methodData = ref<ChunkMethod | null>(null)

const viewData = computed(() => methodData.value || ({} as ChunkMethod))

const methodTypeDisplayMap: Record<string, string> = {
  fixed_size: '固定大小',
  sentence: '按句子',
  paragraph: '按段落',
  recursive: '递归分割',
  semantic: '语义分段'
}

const getMethodTypeDisplay = (type?: string) => methodTypeDisplayMap[type || ''] || type || '-'

const formatDateDisplay = (val?: string | number) => {
  if (!val) return '-'
  if (typeof val === 'number') {
    return new Date(val).toISOString().substring(0, 10)
  }
  return String(val).substring(0, 10) || '-'
}

// 从 defaultParameters 中解析核心切片参数，缺省时返回兜底值
const getCoreParam = (row: ChunkMethod, key: string, fallback: string) => {
  if (!row.defaultParameters) return fallback
  try {
    const params =
      typeof row.defaultParameters === 'string'
        ? JSON.parse(row.defaultParameters)
        : row.defaultParameters
    const val = params?.[key]
    return val === null || val === undefined ? fallback : String(val)
  } catch {
    return fallback
  }
}

const formatJson = (data?: string) => {
  if (!data) return '-'
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}

const open = (row: ChunkMethod) => {
  methodData.value = row
  dialogVisible.value = true
}

defineExpose({ open })
</script>

<style scoped>
.json-preview {
  margin: 0;
  padding: 8px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.4;
  max-height: 200px;
  overflow-y: auto;
}
</style>
