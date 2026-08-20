<template>
  <div ref="contentRef" class="markdown-view" v-html="renderedMarkdown"></div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import MarkdownIt from 'markdown-it'
import markdownItMultimdTable from 'markdown-it-multimd-table'
import hljs from 'highlight.js'

// 定义组件属性
const props = defineProps({
  content: {
    type: String,
    required: true
  }
})

const message = useMessage() // 消息弹窗
const { copy } = useClipboard({ legacy: true }) // 初始化 copy 到粘贴板
const contentRef = ref()

const md = new MarkdownIt({
  breaks: true, // 单换行渲染为 <br>，避免普通文本被折叠成一行
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const copyHtml = `<div id="copy" data-copy='${str}' style="position: absolute; right: 10px; top: 5px; color: var(--el-text-color-secondary); cursor: pointer;">复制</div>`
        return `<pre style="position: relative;">${copyHtml}<code class="hljs">${hljs.highlight(lang, str, true).value}</code></pre>`
      } catch (__) {}
    }
    return ``
  }
})

md.use(markdownItMultimdTable, {
  multiline: true,
  rowspan: true,
  headerless: false,
})

/**
 * 松散块压缩：当内容绝大多数「空行分隔的块」都是单行（即"每行一段"的松散排版）
 * 时，把行间空行压成单换行，避免 markdown 按标准语义把每一行渲染成独立段落，
 * 导致显示成「每行都空一行」。代码块内容原样保留，多行段落型 markdown 不受影响。
 */
const compactLooseBlocks = (content: string): string => {
  if (!content) return content
  // 1. 保护围栏代码块
  const fences: string[] = []
  const masked = content.replace(/```[\s\S]*?```/g, (m) => {
    fences.push(m)
    return `\u0000${fences.length - 1}\u0000`
  })
  // 2. 统计空行分隔的块，判断是否为"每行一段"
  const nonEmpty = masked.split(/\n\s*\n/).filter((b) => b.trim())
  if (nonEmpty.length === 0) return content
  const singleLineCount = nonEmpty.filter((b) => !b.includes('\n')).length
  // 3. 绝大多数块是单行 → 压缩行间空行
  if (singleLineCount / nonEmpty.length >= 0.7) {
    const compacted = masked.replace(/\n\s*\n/g, '\n')
    // 4. 恢复代码块
    return compacted.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => fences[Number(i)] ?? '')
  }
  return content
}

/** 渲染 markdown */
const renderedMarkdown = computed(() => {
  return md.render(compactLooseBlocks(props.content))
})

/** 初始化 **/
onMounted(async () => {
  // 添加 copy 监听
  contentRef.value.addEventListener('click', (e: any) => {
    if (e.target.id === 'copy') {
      copy(e.target?.dataset?.copy)
      message.success('复制成功!')
    }
  })
})
</script>

<style lang="scss">
.markdown-view {
  max-width: 100%;
  font-family: 'PingFang SC';
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.6rem;
  letter-spacing: 0;
  color: var(--el-text-color-primary);
  background: transparent !important;
  text-align: left;
  margin: 0;
  padding: 0;
  border: none;
  box-shadow: none;

  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }

  > * {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }

  pre {
    position: relative;
    background: var(--el-fill-color-light) !important;
    border: 1px solid var(--el-border-color-lighter) !important;
    border-radius: 8px;
    color: var(--el-text-color-primary) !important;
    overflow-x: auto;
    box-shadow: none;
    margin: 0 0 0.5rem 0;
    padding: 12px;
  }

  pre code.hljs,
  .hljs {
    width: auto;
    background: transparent !important;
    color: var(--el-text-color-primary) !important;
    display: block;
    padding: 0;
    margin: 0;
  }

  code.hljs {
    width: auto;
    padding: 2px 6px;
    border-radius: 6px;
    background: transparent !important;
    color: var(--el-text-color-primary) !important;

    @media screen and (width >= 1536px) {
      width: 960px;
    }

    @media screen and (width <= 1536px) and (width >= 1024px) {
      width: calc(100vw - 400px - 64px - 32px * 2);
    }

    @media screen and (width <= 1024px) and (width >= 768px) {
      width: calc(100vw - 32px * 2);
    }

    @media screen and (width <= 768px) {
      width: calc(100vw - 16px * 2);
    }
  }

  p,
  code.hljs {
    margin-bottom: 0;
  }

  code:not(pre code) {
    background: var(--el-fill-color-light) !important;
    color: var(--el-text-color-primary) !important;
    border: 1px solid var(--el-border-color-lighter) !important;
    border-radius: 4px;
    padding: 2px 6px;
  }

  p {
    //margin-bottom: 1rem !important;
    margin: 0;
    margin-bottom: 3px;
  }

  /* 标题通用格式 */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 24px 0 8px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  h1 {
    font-size: 22px;
    line-height: 32px;
  }

  h2 {
    font-size: 20px;
    line-height: 30px;
  }

  h3 {
    font-size: 18px;
    line-height: 28px;
  }

  h4 {
    font-size: 16px;
    line-height: 26px;
  }

  h5 {
    font-size: 16px;
    line-height: 24px;
  }

  h6 {
    font-size: 16px;
    line-height: 24px;
  }

  /* 列表（有序，无序） */
  ul,
  ol {
    padding: 0;
    margin: 0 0 8px;
    font-size: 16px;
    line-height: 24px;
    color: var(--el-text-color-primary);
  }

  li {
    margin: 0 0 0 20px;
    color: var(--el-text-color-primary);
  }

  li:last-child {
    margin-bottom: 0; /* 列表结尾不留 16px 空白 */
  }

  ol > li {
    margin-bottom: 0;
    list-style-type: decimal;
    // 表达式,修复有序列表序号展示不全的问题
    // &:nth-child(n + 10) {
    //     margin-left: 30px;
    // }

    // &:nth-child(n + 100) {
    //     margin-left: 30px;
    // }
  }

  ul > li {
    margin-right: 11px;
    margin-bottom: 4px;
    font-size: 16px;
    line-height: 24px;
    color: var(--el-text-color-primary);
    list-style-type: disc;
  }

  ol ul,
  ol ul > li,
  ul ul,
  ul ul li {
    margin-bottom: 4px;
    margin-left: 6px;
    font-size: 16px;
    list-style: none;
    color: var(--el-text-color-primary);
  }

  blockquote {
    margin: 12px 0;
    padding: 8px 12px;
    border-left: 3px solid var(--el-color-primary);
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    border-radius: 6px;
  }

  table {
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    margin: 12px 0;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: transparent;
    table-layout: auto;
  }

  thead {
    background: var(--el-fill-color-light);
  }

  th,
  td {
    padding: 8px 10px;
    border: 1px solid var(--el-border-color-lighter);
    vertical-align: top;
    text-align: left;
    color: var(--el-text-color-primary);
    background: transparent;
    word-break: break-word;
  }

  th {
    font-weight: 600;
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
  }

  tbody tr:nth-child(even) {
    background: rgba(0, 0, 0, 0.015);
  }

  .dark tbody tr:nth-child(even) {
    background: rgba(255, 255, 255, 0.02);
  }

  ul ul ul,
  ul ul ul li,
  ol ol,
  ol ol > li,
  ol ul ul,
  ol ul ul > li,
  ul ol,
  ul ol > li {
    list-style: square;
  }
}
</style>
