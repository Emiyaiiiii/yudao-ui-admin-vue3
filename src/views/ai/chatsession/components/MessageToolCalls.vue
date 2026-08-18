<template>
  <div v-if="normalizedTools.length > 0" class="mb-8px flex flex-col gap-8px">
    <div
      v-for="tool in normalizedTools"
      :key="tool.callId"
      class="rounded-8px border-1px border-solid border-[var(--el-border-color-lighter)] overflow-hidden"
    >
      <!-- 工具调用头部 -->
      <div
        class="flex items-center gap-8px px-12px py-8px bg-[var(--el-fill-color-light)] cursor-pointer"
        @click="toggleExpanded(tool.callId)"
      >
        <Icon icon="ep:tools" class="text-[var(--el-color-warning)]" />
        <span class="text-13px font-500 flex-1">{{ tool.name || '工具调用' }}</span>
        <el-tag size="small" :type="tool.output ? 'success' : 'warning'" class="!mr-8px">
          {{ tool.output ? '已完成' : '调用中' }}
        </el-tag>
        <Icon icon="ep:arrow-down" :class="{ 'rotate-180': expandedMap[tool.callId] }" />
      </div>
      <!-- 工具调用详情 -->
      <div v-show="expandedMap[tool.callId]" class="px-12px py-10px text-12px">
        <div v-if="tool.arguments" class="mb-8px">
          <div class="text-gray-400 mb-4px">参数</div>
          <pre class="bg-[var(--el-fill-color-lighter)] p-8px rounded-6px overflow-x-auto">{{ formatJson(tool.arguments) }}</pre>
        </div>
        <div v-if="tool.output">
          <div class="text-gray-400 mb-4px">结果</div>
          <pre class="bg-[var(--el-fill-color-lighter)] p-8px rounded-6px overflow-x-auto">{{ formatJson(tool.output) }}</pre>
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
        expandedMap[tool.callId] = true
      }
    })
  },
  { immediate: true }
)
</script>
