<template>
  <div v-if="reasoningContent" class="mb-8px">
    <div
      class="inline-flex items-center gap-6px px-8px py-4px rounded-6px text-12px text-gray-500 bg-[var(--el-fill-color-light)] cursor-pointer hover:text-[var(--el-color-primary)]"
      @click="expanded = !expanded"
    >
      <Icon icon="ep:chat-dot-square" />
      <span>{{ expanded ? '已深度思考' : '深度思考中' }}</span>
      <Icon icon="ep:arrow-down" :class="{ 'rotate-180': expanded }" />
    </div>
    <div
      v-show="expanded"
      class="mt-6px px-12px py-8px rounded-8px text-13px text-gray-600 bg-[var(--el-fill-color-lighter)] border-l-3px border-[var(--el-color-primary)] whitespace-pre-wrap leading-20px"
    >
      {{ reasoningContent }}
    </div>
  </div>
</template>

<script setup lang="ts">
/** 思考过程展示组件 */
const props = defineProps<{
  reasoningContent?: string
}>()

const expanded = ref(true)
</script>
