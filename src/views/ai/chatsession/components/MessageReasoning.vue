<template>
  <div v-if="reasoningContent" class="reasoning-shell">
    <div
      class="reasoning-header"
      :class="expanded ? 'reasoning-header-expanded' : 'reasoning-header-collapsed'"
      @click="expanded = !expanded"
    >
      <Icon icon="ep:chat-dot-square" />
      <span>{{ expanded ? '已深度思考' : '深度思考中' }}</span>
      <Icon icon="ep:arrow-down" :class="{ 'rotate-180': expanded }" />
    </div>
    <div v-show="expanded" class="reasoning-body">
      <MarkdownView :content="reasoningContent" class="reasoning-markdown" />
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownView from '@/components/MarkdownView/index.vue'

/** 思考过程展示组件 */
const props = defineProps<{
  reasoningContent?: string
}>()

const reasoningContent = computed(() =>
  (props.reasoningContent || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
)
const expanded = ref(false)
</script>

<style scoped>
.reasoning-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 10px;
  background: transparent;
  overflow: visible;
}

.reasoning-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.reasoning-header-collapsed {
  color: var(--el-text-color-secondary);
  background: rgba(255, 255, 255, 0.03);
}

.reasoning-header-expanded {
  color: var(--el-color-primary);
  background: rgba(var(--el-color-primary-rgb), 0.08);
}

.reasoning-body {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.08);
}

.reasoning-markdown {
  padding: 12px 14px;
  color: var(--el-text-color-primary);
  background: transparent;
}

:deep(.markdown-view) {
  color: var(--el-text-color-primary);
  background: transparent;
}
</style>
