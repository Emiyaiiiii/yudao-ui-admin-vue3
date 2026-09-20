<template>
  <div v-if="stages && stages.length" class="vector-task-timeline">
    <div class="timeline-header">
      <span class="timeline-title">处理时间线</span>
      <span v-if="totalDuration" class="timeline-total">总耗时 {{ formatDuration(totalDuration) }}</span>
    </div>
    <div class="timeline-body">
      <div
        v-for="(s, i) in stages"
        :key="i"
        class="timeline-stage"
        :class="[`stage-${s.status}`, { 'is-last': i === stages.length - 1 }]"
      >
        <div class="stage-dot" />
        <div class="stage-content">
          <div class="stage-row">
            <span class="stage-name">{{ stageLabel(s.stage) }}</span>
            <span class="stage-status">{{ stageStatusLabel(s.status) }}</span>
            <span v-if="s.duration_s != null" class="stage-duration">{{ formatDuration(s.duration_s) }}</span>
          </div>
          <!-- 阶段指标（chunk 数/向量数/字数等） -->
          <div v-if="stageMetricsText(s)" class="stage-metrics">{{ stageMetricsText(s) }}</div>
          <div v-if="s.metrics?.error" class="stage-error">{{ s.metrics.error }}</div>
          <div v-else-if="s.metrics?.skip_reason" class="stage-skip">{{ s.metrics.skip_reason }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { VectorTaskStage } from '@/api/kb/vectorTask'

defineOptions({ name: 'VectorTaskTimeline' })

const props = defineProps<{ stages?: VectorTaskStage[] }>()

/** 阶段显示名映射（对齐 python state_bus 阶段名） */
const STAGE_LABELS: Record<string, string> = {
  starting: '初始化',
  download: '下载文件',
  parse: '解析文档',
  chunk: '文本切分',
  embed: '向量化',
  store: '写入存储',
  postprocess: '后处理',
  done: '完成'
}
const STATUS_LABELS: Record<string, string> = {
  processing: '处理中',
  completed: '完成',
  failed: '失败',
  skipped: '跳过',
  cancelled: '已取消'
}

const stageLabel = (s: string) => STAGE_LABELS[s] || s
const stageStatusLabel = (s: string) => STATUS_LABELS[s] || s

/** 总耗时：所有已结束阶段 duration_s 之和 */
const totalDuration = computed(() => {
  const d = (props.stages || []).reduce(
    (sum, s) => sum + (typeof s.duration_s === 'number' ? s.duration_s : 0),
    0
  )
  return d > 0 ? d : null
})

const formatDuration = (sec: number) => {
  if (sec < 60) return `${sec.toFixed(1)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m${s}s`
}

/** 阶段指标文本（排除 error/skip_reason 等控制字段） */
const stageMetricsText = (s: VectorTaskStage) => {
  const m = s.metrics
  if (!m || typeof m !== 'object') return ''
  const parts: string[] = []
  if (m.chunk_count != null) parts.push(`${m.chunk_count} 分片`)
  if (m.text_chars != null) parts.push(`${m.text_chars} 字符`)
  if (m.image_count != null) parts.push(`${m.image_count} 图片`)
  if (m.vector_count != null) parts.push(`${m.vector_count} 向量`)
  if (m.es_indexed != null) parts.push(`ES ${m.es_indexed}`)
  if (m.strategy) parts.push(`策略 ${m.strategy}`)
  if (m.parser) parts.push(m.parser)
  return parts.join(' · ')
}
</script>
<style scoped>
.vector-task-timeline {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 12px;
}
.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.timeline-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.timeline-total {
  color: var(--el-text-color-secondary);
}
.timeline-body {
  display: flex;
  flex-direction: column;
}
.timeline-stage {
  display: flex;
  gap: 8px;
  position: relative;
}
.timeline-stage:not(.is-last)::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 10px;
  bottom: -4px;
  width: 2px;
  background: var(--el-border-color);
}
.stage-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--el-border-color);
  position: relative;
  z-index: 1;
}
.timeline-stage.stage-completed .stage-dot {
  background: var(--el-color-success);
}
.timeline-stage.stage-processing .stage-dot {
  background: var(--el-color-primary);
  animation: pulse 1.2s infinite;
}
.timeline-stage.stage-failed .stage-dot {
  background: var(--el-color-danger);
}
.timeline-stage.stage-skipped .stage-dot,
.timeline-stage.stage-cancelled .stage-dot {
  background: var(--el-color-info);
}
.stage-content {
  flex: 1;
  padding-bottom: 6px;
}
.stage-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.stage-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.stage-status {
  color: var(--el-text-color-secondary);
}
.stage-duration {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.stage-metrics {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
}
.stage-error {
  margin-top: 2px;
  color: var(--el-color-danger);
}
.stage-skip {
  margin-top: 2px;
  color: var(--el-color-info);
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
