<template>
  <div v-if="usage" class="flex items-center gap-12px text-12px text-gray-400 mt-6px">
    <span class="flex items-center gap-4px">
      <Icon icon="ep:coin" />
      <span>Token: {{ usage.totalTokens }}</span>
    </span>
    <span class="flex items-center gap-4px">
      <Icon icon="ep:upload" />
      <span>输入: {{ usage.promptTokens }}</span>
    </span>
    <span class="flex items-center gap-4px">
      <Icon icon="ep:download" />
      <span>输出: {{ usage.completionTokens }}</span>
    </span>
    <span v-if="usage.modelName" class="text-gray-300">|</span>
    <span v-if="usage.modelName">{{ usage.modelName }}</span>
  </div>
</template>

<script setup lang="ts">
import type { TokenUsage } from '@/api/ai/chatsession'

/** Token 用量展示组件 */
defineProps<{
  usage?: TokenUsage
}>()
</script>
