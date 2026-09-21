<template>
  <div class="chunk-view" v-loading="loading">
    <el-empty v-if="!loading && chunks.length === 0" description="该文档暂无切片" />
    <div v-else class="chunk-body">
      <!-- 左：切片列表（parent_child 按父块分组） -->
      <div class="chunk-list">
        <div v-for="(group, gi) in groupedChunks" :key="gi" class="chunk-group">
          <div v-if="group.parent" class="chunk-parent">
            <div class="parent-head">
              <el-tag size="small" type="info" effect="plain">父块</el-tag>
              <span class="parent-index">#{{ group.parent.chunkIndex }}</span>
              <span class="parent-title">{{ group.parent.contextHeader || group.parent.documentTitle || '' }}</span>
            </div>
            <div class="parent-content">{{ truncate(group.parent.content) }}</div>
          </div>
          <div
            v-for="chunk in group.children"
            :key="chunk.chunkId"
            class="chunk-item"
            :class="{ active: selected?.chunkId === chunk.chunkId }"
            @click="selectChunk(chunk)"
          >
            <div class="chunk-item-head">
              <span class="chunk-index">#{{ chunk.chunkIndex }}</span>
              <el-tag v-if="chunk.isImage" size="small" type="warning">图片</el-tag>
              <el-tag v-if="chunk.revision && chunk.revision > 0" size="small" type="success" effect="plain">
                已编辑 v{{ chunk.revision }}
              </el-tag>
              <span v-if="chunk.tags?.length" class="chunk-tags">{{ chunk.tags.slice(0, 3).join(' · ') }}</span>
            </div>
            <div class="chunk-preview">{{ truncate(chunk.content) }}</div>
          </div>
        </div>
      </div>
      <!-- 右：选中块详情 + 操作 -->
      <div class="chunk-detail">
        <div v-if="!selected" class="detail-empty">选择左侧切片查看详情</div>
        <template v-else>
          <div class="detail-head">
            <span class="detail-title">切片 #{{ selected.chunkIndex }}</span>
            <div class="detail-actions">
              <el-button
                v-if="!selected.isImage && selected.chunkRole !== 'parent'"
                type="primary"
                size="small"
                :disabled="!canEdit"
                @click="editVisible = true"
              >
                编辑
              </el-button>
              <el-button
                type="info"
                size="small"
                @click="revisionVisible = true"
              >
                修订历史
              </el-button>
            </div>
          </div>
          <div class="detail-meta">
            <el-tag v-if="selected.isImage" size="small" type="warning">图片切片（只读）</el-tag>
            <el-tag v-else-if="selected.chunkRole === 'parent'" size="small" type="info">父块（只读上下文）</el-tag>
            <span v-if="selected.contextHeader" class="meta-context">{{ selected.contextHeader }}</span>
            <span v-if="selected.charCount != null" class="meta-char">{{ selected.charCount }} 字符</span>
            <span v-if="selected.tokenCount != null" class="meta-token">{{ selected.tokenCount }} token</span>
            <span v-if="selected.recallWeight != null" class="meta-weight">权重 {{ selected.recallWeight }}</span>
          </div>
          <pre class="detail-content">{{ selected.content }}</pre>
          <div v-if="selected.questions?.length" class="detail-questions">
            <div class="questions-label">已生成问题（{{ selected.questions.length }}）</div>
            <ul>
              <li v-for="(q, qi) in selected.questions" :key="qi">{{ q }}</li>
            </ul>
          </div>
        </template>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <ChunkEditDialog
      v-model:visible="editVisible"
      :doc-id="docId"
      :kb-id="kbId"
      :chunk="selected"
      @success="handleEditSuccess"
    />
    <!-- 修订历史抽屉 -->
    <ChunkRevisionDrawer
      v-model:visible="revisionVisible"
      :doc-id="docId"
      :chunk-index="selected?.chunkIndex || 0"
      :current-content="selected?.content || ''"
      :can-edit="canEdit"
      @reverted="handleReverted"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChunkApi, type ChunkItem } from '@/api/kb/chunk'
import ChunkEditDialog from './ChunkEditDialog.vue'
import ChunkRevisionDrawer from './ChunkRevisionDrawer.vue'

defineOptions({ name: 'ChunkView' })

const props = defineProps<{
  docId: number
  kbId: number
  canEdit: boolean
}>()

const message = useMessage()
const loading = ref(false)
const chunks = ref<ChunkItem[]>([])
const selected = ref<ChunkItem | null>(null)
const editVisible = ref(false)
const revisionVisible = ref(false)

/** 父-子分组：父块做分组头（只读），子块按 parentChunkIndex 归组 */
const groupedChunks = computed(() => {
  const parents = chunks.value.filter((c) => c.chunkRole === 'parent' || c.isParent)
  const children = chunks.value.filter((c) => !(c.chunkRole === 'parent' || c.isParent))
  if (parents.length === 0) {
    return [{ parent: null, children }]
  }
  return parents.map((parent) => ({
    parent,
    children: children.filter((c) => c.parentChunkIndex === parent.chunkIndex)
  }))
})

const truncate = (text?: string, len = 80) => {
  if (!text) return ''
  return text.length > len ? text.slice(0, len) + '…' : text
}

const selectChunk = (chunk: ChunkItem) => {
  selected.value = chunk
  editVisible.value = false
  revisionVisible.value = false
}

const load = async () => {
  loading.value = true
  try {
    chunks.value = await ChunkApi.listChunks(props.docId, props.kbId)
    if (!selected.value && chunks.value.length) {
      selected.value = chunks.value[0]
    }
  } catch {
  } finally {
    loading.value = false
  }
}

const handleEditSuccess = async () => {
  message.success('切片已更新')
  await load()
}

const handleReverted = async () => {
  await load()
}

defineExpose({ load })
</script>
<style scoped>
.chunk-view {
  min-height: 300px;
}
.chunk-body {
  display: flex;
  gap: 16px;
  height: calc(100vh - 260px);
}
.chunk-list {
  width: 46%;
  flex-shrink: 0;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 8px;
}
.chunk-group {
  margin-bottom: 12px;
}
.chunk-parent {
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
  border-left: 3px solid var(--el-border-color);
}
.parent-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.parent-index {
  font-weight: 600;
  font-size: 12px;
}
.parent-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.parent-content {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.chunk-item {
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  border: 1px solid transparent;
}
.chunk-item:hover {
  background: var(--el-fill-color-light);
}
.chunk-item.active {
  background: var(--el-fill-color);
  border-color: var(--el-border-color);
}
.chunk-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.chunk-index {
  font-weight: 600;
  font-size: 12px;
}
.chunk-tags {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}
.chunk-preview {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.chunk-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.detail-empty {
  color: var(--el-text-color-secondary);
  text-align: center;
  padding-top: 60px;
}
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.detail-title {
  font-weight: 600;
  font-size: 14px;
}
.detail-actions {
  display: flex;
  gap: 6px;
}
.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.meta-context {
  font-size: 12px;
  color: var(--el-color-primary);
}
.meta-char,
.meta-token,
.meta-weight {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.detail-content {
  flex: 1;
  overflow-y: auto;
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px;
  margin: 0;
}
.detail-questions {
  margin-top: 10px;
  max-height: 160px;
  overflow-y: auto;
}
.questions-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}
.detail-questions ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
