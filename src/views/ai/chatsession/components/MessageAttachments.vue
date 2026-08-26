<template>
  <div v-if="list.length" class="msg-attachments">
    <div
      v-for="(att, i) in list"
      :key="i"
      class="msg-attachment"
      :class="{ 'att-image-wrap': isImage(att) }"
    >
      <!-- 图片：经鉴权接口取 Blob URL 渲染，支持预览 -->
      <el-image
        v-if="isImage(att)"
        :src="previews[i]"
        :preview-src-list="imageSrcs"
        fit="cover"
        class="att-image"
        :preview-teleported="true"
      />
      <!-- 视频 / 音频 -->
      <video v-else-if="isVideo(att)" :src="previews[i]" controls class="att-media" />
      <audio v-else-if="isAudio(att)" :src="previews[i]" controls class="att-audio" />
      <!-- 其他文件：小卡片，点击下载 -->
      <el-tooltip v-else :content="att.name || '文件'" placement="top">
        <div class="att-file" @click="handleDownload(att)">
          <Icon icon="ep:document" class="att-file-icon" />
          <span class="att-file-name">{{ att.name || '文件' }}</span>
        </div>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChatAttachment, ChatSessionApi } from '@/api/ai/chatsession'

/** 消息附件展示（图片缩略图 / 视频 / 音频 / 文件下载） */
const props = defineProps<{
  agentId: number
  attachments?: ChatAttachment[]
}>()

const list = computed(() => props.attachments || [])
const previews = ref<Record<number, string>>({})
const objectUrls: string[] = []

const isImage = (a: ChatAttachment) => (a.type || '').startsWith('image')
const isVideo = (a: ChatAttachment) => (a.type || '').startsWith('video')
const isAudio = (a: ChatAttachment) => (a.type || '').startsWith('audio')

/** 经鉴权接口加载媒体预览 URL（Blob 对象 URL） */
const loadPreview = async (i: number) => {
  const att = list.value[i]
  if (!att || !att.url || !props.agentId) return
  try {
    const url = await ChatSessionApi.loadFilePreviewUrl(props.agentId, att.url)
    objectUrls.push(url)
    previews.value = { ...previews.value, [i]: url }
  } catch (e) {
    console.warn('[MessageAttachments] 预览加载失败', e)
  }
}

const imageSrcs = computed(() =>
  list.value.map((_, i) => previews.value[i] || '').filter(Boolean)
)

/** 触发浏览器下载 */
const handleDownload = async (att: ChatAttachment) => {
  if (!props.agentId || !att.url) return
  try {
    const url = await ChatSessionApi.loadFilePreviewUrl(props.agentId, att.url)
    const a = document.createElement('a')
    a.href = url
    a.download = att.name || 'file'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    console.warn('[MessageAttachments] 下载失败', e)
  }
}

watch(
  () => [props.agentId, list.value.map((a) => a.url).join('|')],
  () => {
    previews.value = {}
    list.value.forEach((_, i) => {
      const att = list.value[i]
      if (att && (isImage(att) || isVideo(att) || isAudio(att))) {
        loadPreview(i)
      }
    })
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  objectUrls.forEach((u) => URL.revokeObjectURL(u))
  objectUrls.length = 0
})
</script>

<style scoped>
.msg-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.att-image-wrap {
  max-width: 160px;
}

.att-image {
  width: 100%;
  max-width: 160px;
  max-height: 160px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  display: block;
}

.att-media {
  max-width: 260px;
  max-height: 180px;
  border-radius: 8px;
}

.att-audio {
  max-width: 260px;
}

.att-file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background-color 0.2s;
}
.att-file:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.att-file-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}
.att-file:hover .att-file-icon {
  color: var(--el-color-primary);
}
.att-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
