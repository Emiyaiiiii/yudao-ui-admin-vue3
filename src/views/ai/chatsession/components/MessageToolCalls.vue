<template>
  <div v-if="normalizedTools.length > 0" class="tool-shell">
    <div
      v-for="tool in normalizedTools"
      :key="tool.callId"
      class="tool-card"
    >
      <div
        class="tool-header"
        @click="toggleExpanded(tool.callId)"
      >
        <div class="tool-title">
          <Icon icon="ep:tools" class="text-[var(--el-color-warning)]" />
          <span>{{ tool.name || '工具调用' }}</span>
        </div>
        <div class="tool-actions">
          <el-tag size="small" :type="tool.output ? 'success' : 'warning'">
            {{ tool.output ? '已完成' : '调用中' }}
          </el-tag>
          <Icon icon="ep:arrow-down" :class="{ 'rotate-180': expandedMap[tool.callId] }" />
        </div>
      </div>
      <div v-show="expandedMap[tool.callId]" class="tool-body">
        <div v-if="tool.arguments" class="tool-section">
          <div class="tool-label">参数</div>
          <pre>{{ formatJson(tool.arguments) }}</pre>
        </div>
        <div v-if="tool.output" class="tool-section">
          <div class="tool-label">结果</div>
          <pre>{{ formatJson(tool.output) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolCall } from '@/api/ai/chatsession'

/** 工具调用/结果展示组件 */
const props = defineProps<{
  toolCalls?: string | ToolCall[]
}>()

const expandedMap = reactive<Record<string, boolean>>({})

const normalizedTools = computed<ToolCall[]>(() => {
  if (!props.toolCalls) return []
  if (Array.isArray(props.toolCalls)) return props.toolCalls
  try {
    const parsed = JSON.parse(props.toolCalls)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})

const toggleExpanded = (callId: string) => {
  expandedMap[callId] = !expandedMap[callId]
}

const formatJson = (value?: string) => {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

watch(
  normalizedTools,
  (tools) => {
    tools.forEach((tool) => {
      if (expandedMap[tool.callId] === undefined) {
        expandedMap[tool.callId] = false
      }
    })
  },
  { immediate: true }
)
</script>

<style scoped>
.tool-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  overflow: hidden;
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
}

.tool-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.tool-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tool-body {
  padding: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.06);
}

.tool-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-section + .tool-section {
  margin-top: 10px;
}

.tool-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.tool-body pre {
  margin: 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
}
</style>
