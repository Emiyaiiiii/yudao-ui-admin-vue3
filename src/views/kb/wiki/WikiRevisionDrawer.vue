<template>
  <el-drawer
    :model-value="visible"
    :title="drawerTitle"
    size="860px"
    :destroy-on-close="true"
    @close="emit('update:visible', false)"
  >
    <div v-loading="loading" class="wiki-revision-drawer">
      <el-empty v-if="!loading && revisions.length === 0" description="暂无修订记录" />
      <div v-else class="revision-body">
        <!-- 左：版本列表 -->
        <div class="revision-list">
          <div
            v-for="(rev, idx) in revisions"
            :key="rev.id"
            class="revision-item"
            :class="{ active: selectedRevision === rev.revision }"
            @click="selectRevision(rev.revision)"
          >
            <div class="rev-head">
              <span class="rev-no">[{{ rev.revision }}]</span>
              <span class="rev-title">{{ rev.title || '（无标题）' }}</span>
              <el-tag v-if="idx === 0" type="success" size="small" effect="plain">当前</el-tag>
            </div>
            <div class="rev-meta">
              <el-tag v-if="rev.editSource" size="small" type="info" effect="plain">
                {{ rev.editSource }}
              </el-tag>
              <span>{{ rev.operatorName || '—' }}</span>
              <span class="rev-time">{{ formatTime(rev.createTime) }}</span>
            </div>
          </div>
        </div>
        <!-- 右：diff / 内容 -->
        <div class="revision-detail">
          <div class="detail-toolbar">
            <el-radio-group v-model="viewMode" size="small">
              <el-radio-button value="diff">差异</el-radio-button>
              <el-radio-button value="raw">原文</el-radio-button>
            </el-radio-group>
            <el-popconfirm
              :title="`回滚到版本 v${selectedRevision}，当前内容将被替换，确定吗？`"
              width="280"
              @confirm="handleRevert"
            >
              <template #reference>
                <el-button
                  v-if="selectedRevision != null && selectedRevision < currentRevision"
                  type="danger"
                  size="small"
                  :disabled="!canEdit"
                >
                  回滚到此版本
                </el-button>
              </template>
            </el-popconfirm>
          </div>
          <div class="detail-content">
            <template v-if="viewMode === 'diff'">
              <div v-if="!selectedRevision" class="diff-empty">选择左侧版本查看差异</div>
              <div v-else-if="selectedRevision === currentRevision" class="diff-empty">
                当前版本，无差异
              </div>
              <div v-else class="diff-view">
                <div class="diff-section">
                  <div class="diff-label removed-label">回滚后（选中版本 v{{ selectedRevision }}）</div>
                  <div class="diff-title">{{ selectedRevisionTitle || '（无标题）' }}</div>
                  <div
                    v-for="(seg, si) in diffOldSegments"
                    :key="'old' + si"
                    class="diff-line"
                    :class="seg.type"
                  >
                    <span class="line-prefix">{{ seg.type === 'removed' ? '−' : '' }}</span>
                    <span v-for="(line, li) in seg.lines" :key="li" class="line-text">{{ line || ' ' }}</span>
                  </div>
                </div>
                <div class="diff-section">
                  <div class="diff-label added-label">当前（v{{ currentRevision }}）</div>
                  <div class="diff-title">{{ page?.title || '（无标题）' }}</div>
                  <div
                    v-for="(seg, si) in diffNewSegments"
                    :key="'new' + si"
                    class="diff-line"
                    :class="seg.type"
                  >
                    <span class="line-prefix">{{ seg.type === 'added' ? '+' : '' }}</span>
                    <span v-for="(line, li) in seg.lines" :key="li" class="line-text">{{ line || ' ' }}</span>
                  </div>
                </div>
              </div>
            </template>
            <pre v-else class="raw-content">{{
              selectedRevisionContent || '选择左侧版本查看内容'
            }}</pre>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { WikiApi, type WikiPageVO, type WikiRevisionVO } from '@/api/kb/wiki'
import { diffLines, type DiffSegment } from '@/utils/chunkDiff'
import { formatDate } from '@/utils/formatTime'

defineOptions({ name: 'WikiRevisionDrawer' })

const props = defineProps<{
  visible: boolean
  page: WikiPageVO | null
  canEdit: boolean
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'reverted'): void
}>()

const message = useMessage()
const loading = ref(false)
const revisions = ref<WikiRevisionVO[]>([])
const selectedRevision = ref<number | null>(null)
const viewMode = ref<'diff' | 'raw'>('diff')

const drawerTitle = computed(() => `修订历史 · ${props.page?.title || ''}`)
const currentRevision = computed(() =>
  props.page?.revision != null ? props.page.revision : revisions.value[0]?.revision || 0
)
const selectedRevisionContent = computed(() => {
  const rev = revisions.value.find((r) => r.revision === selectedRevision.value)
  return rev?.content ?? ''
})
const selectedRevisionTitle = computed(() => {
  const rev = revisions.value.find((r) => r.revision === selectedRevision.value)
  return rev?.title ?? ''
})

/** 差异分段：选中版本为"旧"、当前版本为"新"（回滚方向），复用 utils/chunkDiff */
const diffOldSegments = computed<DiffSegment[]>(() => {
  if (selectedRevision.value == null || selectedRevision.value === currentRevision.value) return []
  return diffLines(selectedRevisionContent.value, props.page?.content || '')
})
const diffNewSegments = computed<DiffSegment[]>(() => {
  if (selectedRevision.value == null || selectedRevision.value === currentRevision.value) return []
  return diffLines(props.page?.content || '', selectedRevisionContent.value)
})

const load = async () => {
  if (!props.page) return
  loading.value = true
  try {
    const list = await WikiApi.listRevisions(props.page.kbId, props.page.slug)
    revisions.value = list
    selectedRevision.value = list.length ? list[0].revision! : null
  } finally {
    loading.value = false
  }
}

const selectRevision = (rev: number) => {
  selectedRevision.value = rev
}

const handleRevert = async () => {
  if (!props.page || selectedRevision.value == null) return
  try {
    await message.confirm(
      `确定回滚到版本 v${selectedRevision.value} 吗？当前内容将被替换。`
    )
  } catch {
    return
  }
  loading.value = true
  try {
    await WikiApi.revertPage({
      kbId: props.page.kbId,
      slug: props.page.slug,
      targetRevision: selectedRevision.value,
      expectedRevision: currentRevision.value
    })
    message.success('已回滚')
    emit('reverted')
    await load()
  } catch {
    // 冲突（错误码 53）由全局拦截提示
  } finally {
    loading.value = false
  }
}

const formatTime = (t?: string) => (t ? formatDate(t) : '')

watch(
  () => props.visible,
  (v) => {
    if (v) load()
  }
)
</script>
<style scoped>
.wiki-revision-drawer {
  min-height: 320px;
}
.revision-body {
  display: flex;
  gap: 16px;
  height: calc(100vh - 200px);
}
.revision-list {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 12px;
}
.revision-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 6px;
  border: 1px solid transparent;
}
.revision-item:hover {
  background: var(--el-fill-color-light);
}
.revision-item.active {
  background: var(--el-fill-color);
  border-color: var(--el-border-color);
}
.rev-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rev-no {
  font-weight: 600;
  font-size: 13px;
}
.rev-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rev-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rev-time {
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}
.revision-detail {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.detail-content {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px;
}
.diff-empty {
  color: var(--el-text-color-secondary);
  text-align: center;
  padding-top: 40px;
}
.diff-section {
  margin-bottom: 10px;
}
.diff-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}
.removed-label {
  color: var(--el-color-danger);
}
.added-label {
  color: var(--el-color-success);
}
.diff-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.diff-line {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  padding: 0 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
.diff-line.removed {
  background: rgba(245, 108, 108, 0.15);
  color: var(--el-color-danger);
}
.diff-line.added {
  background: rgba(103, 194, 58, 0.15);
  color: var(--el-color-success);
}
.line-prefix {
  display: inline-block;
  width: 14px;
  user-select: none;
}
.raw-content {
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>