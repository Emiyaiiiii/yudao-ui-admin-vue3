<template>
  <div v-if="!page" class="wiki-brief-empty">
    <el-empty description="请选择页面" :image-size="60" />
  </div>
  <div v-else class="wiki-brief">
    <!-- 标题 -->
    <h1 class="brief-title">{{ page.title }}</h1>
    <el-tag v-if="page.pageType" size="small" class="brief-type">{{ page.pageType }}</el-tag>
    <el-tag v-if="page.revision" size="small" type="info" effect="plain" class="brief-rev">
      v{{ page.revision }}
    </el-tag>
    <div class="brief-meta" v-if="page.slug || page.lastEditorName || page.updateTime">
      <span v-if="page.slug">slug：{{ page.slug }}</span>
      <span v-if="page.lastEditorName">· {{ page.lastEditorName }}</span>
      <span v-if="page.updateTime">· {{ formatDate(page.updateTime) }}</span>
    </div>

    <!-- 摘要 -->
    <div v-if="page.summary" class="brief-summary">{{ page.summary }}</div>

    <!-- 正文 markdown（[[slug|name]] 解析为可点击链接） -->
    <div
      ref="contentRef"
      class="brief-content markdown-body"
      v-html="renderedMarkdown"
      @click="handleContentClick"
    ></div>

    <!-- 页面 footer：被引用 + 来源文档（对齐 WeKnora wiki-reader-footer） -->
    <footer class="brief-backlinks" v-if="inLinks.length || sourceRefs.length">
      <template v-if="inLinks.length">
        <div class="backlinks-title">被引用（{{ inLinks.length }}）</div>
        <div class="backlinks-list">
          <a
            v-for="slug in inLinks"
            :key="'in' + slug"
            href="#"
            class="wiki-content-link"
            @click.prevent="emit('navigate', slug)"
          >
            {{ linkLabel(slug) }}
          </a>
        </div>
      </template>
      <template v-if="sourceRefs.length">
        <div class="backlinks-title">来源文档（{{ sourceRefs.length }}）</div>
        <div class="backlinks-list">
          <a
            v-for="ref in sourceRefs"
            :key="'src' + ref"
            href="#"
            class="wiki-content-link"
            @click.prevent="emit('open-source-doc', ref.id)"
          >
            {{ ref.title }}
          </a>
        </div>
      </template>
    </footer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { formatDate } from '@/utils/formatTime'
import type { WikiPageVO } from '@/api/kb/wiki'

defineOptions({ name: 'WikiBriefContent' })

const props = defineProps<{
  page: WikiPageVO | null
  /** slug → 标题映射（用于把 in_links/out_links 的 slug 显示为页面标题） */
  pageTitles?: Record<string, string>
}>()
const emit = defineEmits<{
  (e: 'navigate', slug: string): void
  (e: 'open-source-doc', docId: string): void
}>()

const contentRef = ref()

/** markdown 渲染（复用现有 markdown-it，不新增依赖） */
const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true
})

/** 把 [[slug|name]] / [[slug]] 解析成带 data-slug 的可点击链接 */
const renderWikiLinks = (content: string): string => {
  if (!content) return content
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, slug: string, name?: string) =>
      `<a class="wiki-link" data-slug="${slug ?? ''}" href="#">${name || slug || ''}</a>`
  )
}

const renderedMarkdown = computed(() => {
  if (!props.page) return ''
  return md.render(renderWikiLinks(props.page.content || ''))
})

const inLinks = computed<string[]>(() => {
  const raw = props.page?.inLinks
  return Array.isArray(raw) ? raw : []
})
const outLinks = computed<string[]>(() => {
  const raw = props.page?.outLinks
  return Array.isArray(raw) ? raw : []
})
const sourceRefs = computed<{ id: string; title: string }[]>(() => {
  const raw = props.page?.sourceRefs
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r) => r && typeof r === 'string')
    .map((r) => {
      const idx = r.indexOf('|')
      if (idx > 0) return { id: r.substring(0, idx), title: r.substring(idx + 1) }
      return { id: r, title: r }
    })
})

/** slug → 标题（优先页面映射；回退为 slug 可读名，对齐 WeKnora slugDisplayName） */
const linkLabel = (slug: string): string => {
  const t = props.pageTitles?.[slug]
  if (t) return t
  return slug
}

/** 点击正文内 wiki 链接 → 发射 navigate */
const handleContentClick = (e: MouseEvent) => {
  const target = (e.target as HTMLElement)?.closest?.('.wiki-link') as HTMLElement | null
  if (target?.dataset?.slug) {
    e.preventDefault()
    emit('navigate', target.dataset.slug)
  }
}

/** 页面切换时重置滚动 */
watch(
  () => props.page?.slug,
  () => {
    if (contentRef.value) {
      contentRef.value.scrollTop = 0
    }
  }
)
</script>
<style scoped>
.wiki-brief-empty {
  padding-top: 60px;
}
.wiki-brief {
  max-width: 100%;
}
.brief-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 6px;
}
.brief-type {
  margin-right: 6px;
  vertical-align: middle;
}
.brief-rev {
  vertical-align: middle;
}
.brief-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 4px 0 10px;
}
.brief-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-left: 3px solid var(--el-border-color);
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
}
.brief-content {
  font-family: 'PingFang SC';
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  overflow-y: auto;
}
.brief-content :deep(.wiki-link) {
  color: var(--el-color-primary);
  cursor: pointer;
  text-decoration: underline;
}
.brief-backlinks {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.backlinks-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.backlinks-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.backlinks-list .wiki-content-link {
  font-size: 13px;
  color: var(--el-color-primary);
  text-decoration: none;
  cursor: pointer;
}
.backlinks-list .wiki-content-link:hover {
  text-decoration: underline;
}
</style>