<template>
  <div class="wiki-browser">
    <!-- 工具栏：tab 切换 + 新建 -->
    <div class="wiki-toolbar">
      <el-tabs v-model="activeTab" class="wiki-tabs">
        <el-tab-pane label="目录浏览" name="tree" />
        <el-tab-pane label="知识图谱" name="graph" />
      </el-tabs>
      <el-button type="primary" plain @click="openEdit(null)" v-hasPermi="['kb:document:update']">
        <Icon icon="ep:plus" class="mr-3px" /> 新建页面
      </el-button>
      <!-- AI 巡检待修复问题徽标 -->
      <el-badge
        v-if="pendingIssueCount > 0"
        :value="pendingIssueCount"
        class="wiki-issue-badge"
        @click="openIssuesDrawer(true)"
      >
        <el-button size="small" type="warning" plain>
          <Icon icon="ep:warning" class="mr-3px" /> 待修复问题
        </el-button>
      </el-badge>
      <!-- 收尾重建：死链清理 + 交叉链接 + 入链重建 + index 兜底（纯算法，不含 LLM） -->
      <el-button
        size="small"
        plain
        :loading="rebuilding"
        @click="handleRebuildLinks"
        v-hasPermi="['kb:document:update']"
      >
        <Icon icon="ep:refresh" class="mr-3px" /> 重建链接
      </el-button>
      <!-- 质量检查 / 自动修复（lint 纯算法，不含 LLM） -->
      <el-button
        size="small"
        plain
        :loading="linting"
        @click="handleLint"
        v-hasPermi="['kb:document:query']"
      >
        <Icon icon="ep:first-aid-kit" class="mr-3px" /> 质量检查
      </el-button>
      <el-button
        size="small"
        plain
        :loading="autoFixing"
        @click="handleAutoFix"
        v-hasPermi="['kb:document:update']"
      >
        <Icon icon="ep:magic-stick" class="mr-3px" /> 自动修复
      </el-button>
      <!-- 独立目录实体：新建目录（P1-1） -->
      <el-button
        size="small"
        plain
        @click="handleCreateFolder"
        v-hasPermi="['kb:document:update']"
      >
        <Icon icon="ep:folder-add" class="mr-3px" /> 新建目录
      </el-button>
      <!-- 蒸馏进度（阶段② 攒批：显示批次状态与待处理文档数） -->
      <el-button size="small" plain :loading="batchLoading" @click="handleBatchProgress"
                 v-hasPermi="['kb:document:query']">
        <Icon icon="ep:loading" class="mr-3px" /> 蒸馏进度
      </el-button>
    </div>

    <div class="wiki-body">
      <!-- 目录浏览视图（对齐 WeKnora：左侧目录树 + 右侧内容区） -->
      <template v-if="activeTab === 'tree'">
        <div class="wiki-tree-layout">
          <!-- 左侧：Index 入口 + 摘要/知识 分栏 -->
          <aside class="wiki-sidebar">
            <!-- Index 独立入口（不再是树节点，消除与聚合视图的重复） -->
            <div
              class="wiki-nav-index"
              :class="{ active: currentView === 'index' }"
              @click="openIndex"
            >
              <Icon icon="ep:menu" class="node-icon" color="#409EFF" />
              <span class="node-label">Index</span>
            </div>
            <div class="wiki-sidebar-divider"></div>

            <!-- 分栏 Tab：摘要 / 知识 -->
            <div class="wiki-side-tabs">
              <div
                class="wiki-side-tab"
                :class="{ active: sideTab === 'summary' }"
                @click="switchSideTab('summary')"
              >
                <span>摘要</span>
                <span class="wiki-side-tab-count">{{ summaryPages.length }}</span>
              </div>
              <div
                class="wiki-side-tab"
                :class="{ active: sideTab === 'knowledge' }"
                @click="switchSideTab('knowledge')"
              >
                <span>知识</span>
                <span class="wiki-side-tab-count">{{ knowledgePages.length }}</span>
              </div>
            </div>

            <!-- 摘要分栏：按文档列的 summary 页列表 -->
            <div v-if="sideTab === 'summary'" class="wiki-side-list">
              <div
                v-for="p in summaryPages"
                :key="p.slug"
                class="wiki-side-item"
                :class="{ active: currentPage?.slug === p.slug }"
                @click="openView(p)"
              >
                <Icon icon="ep:document" class="node-icon" color="#909399" />
                <span class="node-label">{{ p.title }}</span>
              </div>
              <el-empty v-if="!summaryPages.length" description="暂无摘要" :image-size="40" />
            </div>

            <!-- 知识分栏：folder 树 + entity/concept 页 -->
            <div v-else class="wiki-side-tree">
              <el-tree
                ref="treeRef"
                :data="knowledgeTree"
                node-key="key"
                :props="{ label: 'label', children: 'children' }"
                highlight-current
                @node-click="handleKnowledgeClick"
              >
                <template #default="{ data }">
                  <span class="tree-node">
                    <Icon
                      v-if="data.type === 'folder'"
                      icon="ep:folder"
                      class="node-icon"
                      color="#E6A23C"
                    />
                    <Icon v-else icon="ep:document" class="node-icon" color="#909399" />
                    <span class="node-label">{{ data.label }}</span>
                    <el-tag
                      v-if="data.type === 'folder' && data.pageCount"
                      size="small"
                      effect="plain"
                      class="node-count"
                    >
                      {{ data.pageCount }}
                    </el-tag>
                    <!-- 目录 / 页面操作菜单（悬浮显示；写操作需 kb:document:update） -->
                    <span
                      v-hasPermi="['kb:document:update']"
                      class="tree-node-menu"
                      @click.stop
                    >
                      <el-dropdown trigger="click">
                        <Icon icon="ep:more" class="node-more" />
                        <template #dropdown>
                          <el-dropdown-menu>
                            <template v-if="data.type === 'folder'">
                              <el-dropdown-item @click="handleRenameFolder(data)">
                                重命名
                              </el-dropdown-item>
                              <el-dropdown-item @click="handleMoveFolder(data)">
                                移动到…
                              </el-dropdown-item>
                              <el-dropdown-item divided @click="handleDeleteFolder(data)">
                                删除
                              </el-dropdown-item>
                            </template>
                            <el-dropdown-item v-else @click="handleMovePage(data)">
                              移动到目录…
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </span>
                  </span>
                </template>
              </el-tree>
              <el-empty v-if="!knowledgeTree.length" description="暂无知识页面" :image-size="40" />
            </div>
          </aside>

          <!-- 右侧内容区 -->
          <div class="wiki-content" v-loading="contentLoading">
            <!-- index 视图：intro + 分组目录 -->
            <template v-if="currentView === 'index'">
              <div class="index-view">
                <div v-if="indexData?.intro" class="index-intro" v-html="renderMarkdown(indexData.intro)"></div>
                <el-empty v-else description="暂无 index 引言（上传文档后由蒸馏生成）" :image-size="60" />
                <div
                  v-for="group in indexData?.groups || []"
                  :key="group.type"
                  class="index-group"
                >
                  <div class="index-group-title">
                    {{ groupTypeLabel(group.type) }}
                    <el-tag size="small" effect="plain">{{ group.total }}</el-tag>
                  </div>
                  <el-table
                    :data="group.items"
                    size="small"
                    :show-overflow-tooltip="true"
                    @row-click="openBySlug"
                    class="index-table"
                  >
                    <el-table-column label="标题" prop="title" min-width="160px" />
                    <el-table-column label="摘要" prop="summary" min-width="240px" />
                  </el-table>
                </div>
              </div>
            </template>

            <!-- 页面视图 -->
            <template v-else-if="currentPage">
              <div class="view-actions">
                <el-button
                  type="primary"
                  size="small"
                  v-has-permi="['kb:document:update']"
                  @click="openEdit(currentPage)"
                >
                  编辑
                </el-button>
                <el-button type="warning" size="small" @click="revisionVisible = true">修订</el-button>
              </div>
              <WikiBriefContent
                :page="currentPage"
                :page-titles="pageTitles"
                @navigate="openBySlug"
                @open-source-doc="openSourceDoc"
              />
            </template>

            <el-empty v-else description="从左侧选择一个页面或 Index" :image-size="80" />
          </div>
        </div>
      </template>

      <!-- 图谱视图（对齐 WeKnora：全屏 canvas + 搜索/图例/状态卡 overlay + 页面详情抽屉） -->
      <template v-else>
        <div class="wiki-graph-view">
          <WikiGraph
            ref="graphRef"
            :graph="graph"
            :loading="graphLoading"
            :selected="graphSelected"
            :preserve-layout="preserveLayout"
            @select="handleGraphSelect"
            @bloom="handleGraphBloom"
            @pivot="handleGraphPivot"
          />

          <!-- 搜索 overlay（左上） -->
          <div v-if="graphReady" class="graph-overlay graph-search-overlay">
            <el-select
              v-model="graphSearchValue"
              filterable
              remote
              :remote-method="handleGraphRemoteSearch"
              :loading="graphSearchLoading"
              placeholder="搜索 Wiki 页面并定位到图谱…"
              clearable
              size="default"
              class="graph-search-select"
              @change="handleGraphSearchSelect"
              @clear="graphSearchOptions = []"
            >
              <el-option
                v-for="opt in graphSearchEffectiveOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>

          <!-- 图例 overlay（左下：类型过滤 + 操作按钮 + 状态卡） -->
          <div v-if="graphReady" class="graph-overlay graph-legend-overlay" :class="{ 'legend-shifted': graphDrawerVisible }">
            <div class="legend-items">
              <div
                v-for="item in legendTypes"
                :key="item.type"
                class="legend-item clickable"
                :class="{ disabled: !graphFilterTypes.has(item.type) }"
                @click="toggleGraphFilterType(item.type)"
              >
                <span class="legend-dot" :style="{ background: item.color }"></span>
                {{ item.label }}
              </div>
            </div>
            <div class="legend-divider"></div>
            <div class="legend-actions">
              <div class="legend-action" title="适应屏幕" @click="fitGraphToView">
                <Icon icon="ep:full-screen" class="legend-action-icon" />
                <span>适应屏幕</span>
              </div>
              <div class="legend-action" title="显示/隐藏箭头" @click="toggleArrows">
                <Icon icon="ep:aim" class="legend-action-icon" />
                <span>{{ showArrows ? '隐藏箭头' : '显示箭头' }}</span>
              </div>
              <div
                v-if="graphMode === 'ego' && graphFrontierCount > 0"
                class="legend-action"
                :title="`展开前沿节点（${graphFrontierCount}）`"
                @click="growFrontier"
              >
                <Icon icon="ep:connection" class="legend-action-icon" />
                <span>展开前沿 ({{ graphFrontierCount }})</span>
              </div>
              <div v-if="graphMode === 'ego'" class="legend-action" @click="loadGraph">
                <Icon icon="ep:back" class="legend-action-icon" />
                <span>返回概览</span>
              </div>
            </div>
            <template v-if="graphStatusCard">
              <div class="wiki-graph-status-card">
                <div class="status-card-header">
                  <Icon :icon="graphStatusCard.icon" class="status-card-icon" />
                  <span class="status-card-title">{{ graphStatusCard.title }}</span>
                </div>
                <div class="status-card-primary" :title="graphStatusCard.primary">{{ graphStatusCard.primary }}</div>
                <div v-if="graphStatusCard.secondary" class="status-card-secondary">
                  {{ graphStatusCard.secondary }}
                </div>
              </div>
            </template>
          </div>

          <div v-if="!graphReady && !graphLoading" class="graph-empty-tip">
            <el-empty description="暂无图谱数据" :image-size="48" />
          </div>
        </div>

        <!-- 图谱页面内容抽屉（对齐 WeKnora：点击节点直接加载并展示页面正文） -->
        <el-drawer v-model="graphDrawerVisible" :title="graphDrawerPage?.title || '节点信息'" size="480px">
          <div v-loading="graphDrawerLoading" class="graph-drawer-body">
            <template v-if="graphDrawerPage">
              <div class="graph-drawer-meta">
                <el-tag size="small" effect="plain">{{ graphDrawerPage.pageType }}</el-tag>
                <span v-if="graphDrawerPage.revision" class="graph-drawer-ver">v{{ graphDrawerPage.revision }}</span>
                <el-button
                  v-if="graphMode === 'ego' && graphCenter !== graphDrawerPage.slug"
                  size="small"
                  :loading="bloomLoading"
                  :disabled="!graphDrawerCanBloom"
                  @click="bloomNeighbors(graphDrawerPage.slug)"
                >
                  展开邻居
                </el-button>
                <el-button
                  v-if="graphMode !== 'ego' || graphCenter !== graphDrawerPage.slug"
                  size="small"
                  :loading="graphLoading"
                  @click="pivotEgo(graphDrawerPage.slug)"
                >
                  设为中心
                </el-button>
                <el-button
                  type="primary"
                  size="small"
                  v-has-permi="['kb:document:update']"
                  @click="openEdit(graphDrawerPage)"
                >
                  编辑
                </el-button>
              </div>
              <div v-if="graphDrawerNeighborHint" class="wiki-drawer-neighbor-hint">
                {{ graphDrawerNeighborHint }}
              </div>
              <WikiBriefContent
                :page="graphDrawerPage"
                :page-titles="pageTitles"
                @navigate="handleDrawerNavigate"
                @open-source-doc="openSourceDoc"
              />
            </template>
            <el-empty v-else description="未找到该页面" :image-size="60" />
          </div>
        </el-drawer>
      </template>
    </div>

    <!-- 编辑弹窗 -->
    <WikiEditDialog
      v-model:visible="editVisible"
      :kb-id="kbId"
      :page="editPage"
      @success="handleSaved"
    />

    <!-- 修订抽屉 -->
    <WikiRevisionDrawer
      v-model:visible="revisionVisible"
      :page="currentPage"
      :can-edit="canEdit"
      @reverted="handleReverted"
    />

    <!-- AI 巡检待修复问题抽屉 -->
    <el-drawer v-model="issuesVisible" title="待修复问题（AI 巡检）" size="480px">
      <div class="issue-list">
        <div v-for="issue in issues" :key="issue.slug + '-' + issue.issueType" class="issue-item">
          <div class="issue-tags">
            <el-tag v-if="issue.issueType === 'contradictory_facts'" size="small" type="danger">
              事实冲突
            </el-tag>
            <el-tag v-else-if="issue.issueType === 'mixed_entities'" size="small" type="warning">
              混合实体
            </el-tag>
            <el-tag v-else-if="issue.issueType === 'out_of_date'" size="small">过期信息</el-tag>
            <el-tag v-else size="small" type="info">关注</el-tag>
            <span class="issue-slug" @click="navigateToIssue(issue.slug)">[{{ issue.slug }}]</span>
          </div>
          <div class="issue-desc">{{ issue.description }}</div>
          <div class="issue-actions">
            <span class="issue-reporter">{{ aiReporterText(issue.reportedBy) }}</span>
            <el-button link type="primary" size="small" @click="handleIssueIgnore(issue)">标记误报</el-button>
            <el-button link type="success" size="small" @click="handleIssueResolved(issue)">已处理</el-button>
          </div>
        </div>
        <el-empty v-if="!issues.length" description="暂无待修复问题" :image-size="60" />
      </div>
    </el-drawer>

    <!-- 移动目录对话框（目标父目录已排除自身及其子树） -->
    <el-dialog v-model="folderMoveVisible" title="移动目录" width="420px" append-to-body>
      <div class="move-dialog-tip">选择目标父目录（已排除自身及其子树）</div>
      <el-tree-select
        v-model="folderMoveParent"
        :data="folderMoveSelectData"
        :props="{ label: 'label', children: 'children' }"
        value-key="value"
        check-strictly
        default-expand-all
        placeholder="请选择目标父目录"
        style="width: 100%"
      />
      <template #footer>
        <el-button @click="folderMoveVisible = false">取消</el-button>
        <el-button type="primary" :loading="folderMoveLoading" @click="confirmMoveFolder">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 移动页面对话框（folderId 为空 = 根目录，用「根目录」选项表示） -->
    <el-dialog v-model="pageMoveVisible" title="移动页面到目录" width="420px" append-to-body>
      <div class="move-dialog-tip">页面「{{ pageMoveTitle }}」将移动到：</div>
      <el-tree-select
        v-model="pageMoveFolder"
        :data="pageMoveSelectData"
        :props="{ label: 'label', children: 'children' }"
        value-key="value"
        check-strictly
        default-expand-all
        placeholder="请选择目标目录"
        style="width: 100%"
      />
      <template #footer>
        <el-button @click="pageMoveVisible = false">取消</el-button>
        <el-button type="primary" :loading="pageMoveLoading" @click="confirmMovePage">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { checkPermi } from '@/utils/permission'
import { WikiApi, type WikiFolderVO, type WikiIndexVO, type WikiIssueVO, type WikiPageVO, type WikiGraphData, type WikiGraphNode } from '@/api/kb/wiki'
import WikiGraph from './WikiGraph.vue'
import WikiBriefContent from './WikiBriefContent.vue'
import WikiEditDialog from './WikiEditDialog.vue'
import WikiRevisionDrawer from './WikiRevisionDrawer.vue'
import { useVectorTaskWs } from '@/views/kb/document/useVectorTaskWs'
import { ElMessageBox } from 'element-plus'

defineOptions({ name: 'WikiBrowser' })

const props = defineProps<{
  kbId: number
}>()

const emit = defineEmits<{
  /** 打开来源文档（source_refs 里的 doc_id，由父级 document 页处理） */
  (e: 'open-source-doc', docId: string): void
}>()

const message = useMessage()
/** 是否有编辑/回滚权限（与后端 kb:document:update 对齐） */
const canEdit = computed(() => checkPermi(['kb:document:update']))

/** slug → 标题映射（供 WikiBriefContent 把 in_links/out_links 显示为页面标题） */
const pageTitles = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const p of pages.value) {
    if (p.slug) map[p.slug] = p.title
  }
  return map
})

// ========== 视图切换 ==========
const activeTab = ref<'tree' | 'graph'>('tree')

// ========== 目录（摘要/知识 分栏） ==========
interface TreeNode {
  key: string
  type: 'folder' | 'page'
  label: string
  pageCount?: number
  page?: WikiPageVO
  children?: TreeNode[]
  /** 目录实体字段（buildKnowledgeTree 由 folderTree 实体构建时填充；页面节点无） */
  folderId?: string
  parentId?: string
  path?: string[]
}

const loading = ref(false)
const pages = ref<WikiPageVO[]>([])
const folders = ref<WikiFolderVO[]>([])
/** 目录实体树（folderTree 实体，含空目录；作为 knowledgeTree 目录节点的数据源） */
const folderEntityTree = ref<any[]>([])
const sideTab = ref<'summary' | 'knowledge'>('summary')

/** 摘要分栏：page_type=summary 的页面（标题=文档名） */
const summaryPages = computed(() =>
  pages.value.filter((p) => p.pageType === 'summary')
)

/** 知识分栏：entity/concept 页面 */
const knowledgePages = computed(() =>
  pages.value.filter((p) => p.pageType !== 'summary' && p.pageType !== 'index')
)

/** 知识树：根目录 folders + entity/concept 页（不含摘要，摘要独立分栏） */
const knowledgeTree = ref<TreeNode[]>([])
/** el-tree 实例引用（数据就绪后手动展开全部文件夹） */
const treeRef = ref()

const switchSideTab = (t: 'summary' | 'knowledge') => {
  sideTab.value = t
}

const loadTree = async () => {
  loading.value = true
  try {
    const [pageList, folderList, folderEntity] = await Promise.all([
      WikiApi.listPages(props.kbId),
      WikiApi.listFolders(props.kbId),
      // 目录实体树：失败降级为空数组 → buildKnowledgeTree 回退旧「页面派生 path」构建
      WikiApi.folderTree(props.kbId).catch(() => [])
    ])
    pages.value = pageList
    folders.value = folderList
    folderEntityTree.value = folderEntity || []
    buildKnowledgeTree()
  } catch {
    knowledgeTree.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 知识树：**优先用目录实体树**（folderTree，含空目录、带 folder_id）建目录节点，
 * 再按页面的 folderId 挂载 entity/concept 页。
 * 兼容：目录实体尚未生成的存量库（folderEntityTree 为空）回退旧的「页面派生 folder_path」构建。
 */
const buildKnowledgeTree = () => {
  const folderNodeByKey = new Map<string, TreeNode>()
  const folderNodeById = new Map<string, TreeNode>()
  const rootFolders: TreeNode[] = []

  // 1. 目录：优先目录实体树（递归，保留空目录）
  const walkEntity = (entity: any, parentNode?: TreeNode) => {
    const pathArr: string[] = Array.isArray(entity.path)
      ? entity.path.map((s: any) => String(s))
      : String(entity.path || '').split('/').filter(Boolean)
    const key = pathArr.join('/')
    if (!key) return
    const node: TreeNode = {
      key,
      type: 'folder',
      label: String(entity.name || pathArr[pathArr.length - 1] || key),
      pageCount: Number(entity.count || 0),
      children: [],
      folderId: String(entity.folder_id ?? entity.id ?? ''),
      parentId: String(entity.parent_id ?? ''),
      path: pathArr
    }
    folderNodeByKey.set(key, node)
    if (node.folderId) folderNodeById.set(node.folderId, node)
    if (parentNode) parentNode.children!.push(node)
    else rootFolders.push(node)
    for (const child of entity.children || []) walkEntity(child, node)
  }

  if (folderEntityTree.value.length) {
    folderEntityTree.value.forEach((e) => walkEntity(e))
  } else {
    // 回退：按页面派生 folder_path 逐级建链（存量库无目录实体时保持原行为）
    folders.value.forEach((f) => {
      const segs = Array.isArray(f.path)
        ? (f.path as string[])
        : String(f.path || '').split('/').filter(Boolean)
      let parentKey = ''
      let key = ''
      for (const seg of segs) {
        key = key ? `${key}/${seg}` : seg
        if (!folderNodeByKey.has(key)) {
          const node: TreeNode = { key, type: 'folder', label: seg, pageCount: 0, children: [], path: key.split('/') }
          folderNodeByKey.set(key, node)
          if (parentKey) {
            const parent = folderNodeByKey.get(parentKey)
            if (parent) parent.children!.push(node)
            else rootFolders.push(node)
          } else {
            rootFolders.push(node)
          }
        }
        parentKey = key
      }
      if (key && f.pageCount != null) {
        const node = folderNodeByKey.get(key)
        if (node) node.pageCount = f.pageCount
      }
    })
  }

  // 2. 挂页面：优先按 folderId 命中目录实体；回退 categoryPath 路径命中；都无则挂根
  const rootPages: TreeNode[] = []
  knowledgePages.value.forEach((p) => {
    const pageNode: TreeNode = { key: `page-${p.slug}`, type: 'page', label: p.title, page: p, children: [] }
    let folderNode: TreeNode | undefined
    if (p.folderId != null && String(p.folderId) !== '') {
      folderNode = folderNodeById.get(String(p.folderId))
    }
    if (!folderNode) {
      let segs: string[] = []
      try {
        segs = JSON.parse(p.categoryPath || '[]')
      } catch {
        segs = []
      }
      if (!Array.isArray(segs)) segs = []
      segs = segs.filter(Boolean)
      if (segs.length) folderNode = folderNodeByKey.get(segs.join('/'))
    }
    if (folderNode) {
      folderNode.children!.push(pageNode)
    } else {
      rootPages.push(pageNode)
    }
  })

  // 3. 根：目录树 + 根目录页
  knowledgeTree.value = [...rootFolders, ...rootPages]
  // 异步数据下 default-expand-all 不生效：数据就绪后手动展开全部文件夹（默认展开便于浏览）
  nextTick(() => {
    treeRef.value?.store?.expandAll?.()
  })
}

// ========== 内容区 ==========
const contentLoading = ref(false)
const currentView = ref<'index' | 'page' | 'none'>('none')
const indexData = ref<WikiIndexVO | null>(null)
const currentPage = ref<WikiPageVO | null>(null)

const handleKnowledgeClick = (node: TreeNode) => {
  if (node.type === 'page' && node.page) {
    openView(node.page)
  }
}

/** 打开 index 视图：intro + 分组目录 */
const openIndex = async () => {
  currentView.value = 'index'
  currentPage.value = null
  contentLoading.value = true
  try {
    indexData.value = await WikiApi.getIndex(props.kbId)
  } catch {
    indexData.value = { groups: [] }
  } finally {
    contentLoading.value = false
  }
}

/** 打开页面阅读 */
const openView = async (row: WikiPageVO) => {
  currentView.value = 'page'
  currentPage.value = row
  contentLoading.value = true
  try {
    currentPage.value = await WikiApi.getPage(props.kbId, row.slug)
  } catch {
    // 失败全局提示
  } finally {
    contentLoading.value = false
  }
}

/** 按 slug 跳转（内链/图谱/index 目录项） */
const openBySlug = (slugOrRow: string | { slug?: string }) => {
  const slug = typeof slugOrRow === 'string' ? slugOrRow : slugOrRow?.slug
  const target = pages.value.find((p) => p.slug === slug)
  if (target) {
    openView(target)
  } else {
    message.warning(`未找到页面：${slug}`)
  }
}

/** 简单 markdown 渲染（标题/段落/粗体），足以展示 index intro */
const renderMarkdown = (md: string) => {
  if (!md) return ''
  return md
    .replace(/^###\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^#\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

const groupTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    summary: '文档摘要',
    entity: '实体',
    concept: '概念',
    manual: '人工页面',
    index: '索引'
  }
  return map[type] || type
}

// ========== 编辑 ==========
const editVisible = ref(false)
const editPage = ref<WikiPageVO | null>(null)

const openEdit = (row: WikiPageVO | null) => {
  if (!canEdit.value) {
    message.error('您没有编辑 Wiki 页面的权限')
    return
  }
  editPage.value = row
  editVisible.value = true
}

/** 编辑/新建成功 */
const handleSaved = async () => {
  await loadTree()
  if (currentView.value === 'page' && currentPage.value) {
    try {
      currentPage.value = await WikiApi.getPage(props.kbId, currentPage.value.slug)
    } catch {}
  }
  if (currentView.value === 'index') {
    openIndex()
  }
}

// ========== 修订 ==========
const revisionVisible = ref(false)

/** 回滚成功 */
const handleReverted = async () => {
  await loadTree()
  if (currentView.value === 'page' && currentPage.value) {
    try {
      currentPage.value = await WikiApi.getPage(props.kbId, currentPage.value.slug)
    } catch {}
  }
}

// ========== 图谱（对齐 WeKnora：overview/ego/bloom/growFrontier/类型过滤/搜索/状态卡/抽屉） ==========
const graphLoading = ref(false)
const graph = ref<WikiGraphData | null>(null)
const graphSelected = ref('')
const preserveLayout = ref(false)
const graphRef = ref()
const bloomLoading = ref(false)
const graphReady = ref(false)
const showArrows = ref(true)
// 图谱页面内容抽屉
const graphDrawerVisible = ref(false)
const graphDrawerLoading = ref(false)
const graphDrawerPage = ref<WikiPageVO | null>(null)

// 类型过滤（allow-list，全选=不过滤）。图谱固定展示的页面类型集合，不含 index（index 为
// KB 级总览引言页，非图谱节点类型）：即便不过滤，后端也不会返回 index 节点。
const graphFilterTypes = ref<Set<string>>(new Set(['summary', 'entity', 'concept', 'synthesis', 'comparison']))
const legendTypes = [
  { type: 'summary', label: '摘要', color: '#0052d9' },
  { type: 'entity', label: '实体', color: '#2ba471' },
  { type: 'concept', label: '概念', color: '#e37318' },
  { type: 'synthesis', label: '综合', color: '#0594fa' },
  { type: 'comparison', label: '对比', color: '#d54941' }
]

const graphMode = ref<'overview' | 'ego'>('overview')
const graphCenter = ref<string>('')
const GRAPH_OVERVIEW_LIMIT = 500
const GRAPH_EGO_LIMIT = 500
const GRAPH_EGO_DEFAULT_DEPTH = 1
const BLOOM_MAX_NODES = 1500
const GROW_FRONTIER_CONCURRENCY = 4

function graphFilterTypesToArray(): string | undefined {
  const all = ['summary', 'entity', 'concept', 'synthesis', 'comparison']
  if (all.every(t => graphFilterTypes.value.has(t))) return undefined
  return Array.from(graphFilterTypes.value).join(',')
}
function graphFilterSelectsNothing(): boolean {
  return graphFilterTypes.value.size === 0
}

/** 切换类型过滤（对齐 WeKnora toggleGraphFilterType：改 allow-list 后重拉） */
async function toggleGraphFilterType(type: string) {
  const newSet = new Set(graphFilterTypes.value)
  if (newSet.has(type)) newSet.delete(type)
  else newSet.add(type)
  graphFilterTypes.value = newSet
  if (graphDrawerPage.value && !newSet.has(graphDrawerPage.value.pageType || '')) {
    graphDrawerVisible.value = false
  }
  if (graphMode.value === 'ego' && graphCenter.value) {
    await loadEgoGraph(graphCenter.value)
  } else {
    await loadGraph()
  }
}

/** overview：全库 top-N（按 link_count） */
async function loadGraph() {
  graphLoading.value = true
  graphReady.value = false
  graphMode.value = 'overview'
  graphCenter.value = ''
  if (graphFilterSelectsNothing()) {
    graph.value = { nodes: [], edges: [], meta: { mode: 'overview', total: 0, returned: 0, truncated: false } }
    graphReady.value = true
    graphLoading.value = false
    return
  }
  try {
    graph.value = await WikiApi.getGraph({
      kbId: props.kbId, mode: 'overview', limit: GRAPH_OVERVIEW_LIMIT,
      types: graphFilterTypesToArray()
    })
    graphSelected.value = ''
  } catch {
    graph.value = { nodes: [], edges: [], meta: { mode: 'overview', total: 0, returned: 0, truncated: false } }
  } finally {
    graphLoading.value = false
    graphReady.value = true
  }
}

/** ego：以某页为中心 BFS 邻居（替换整图） */
async function loadEgoGraph(slug: string, depth = GRAPH_EGO_DEFAULT_DEPTH) {
  if (!slug) return
  graphLoading.value = true
  graphReady.value = false
  graphMode.value = 'ego'
  graphCenter.value = slug
  if (graphFilterSelectsNothing()) {
    graph.value = { nodes: [], edges: [], meta: { mode: 'ego', total: 0, returned: 0, truncated: false, center: slug, depth } }
    graphReady.value = true
    graphLoading.value = false
    return
  }
  try {
    graph.value = await WikiApi.getGraph({
      kbId: props.kbId, mode: 'ego', centerSlug: slug, depth,
      limit: GRAPH_EGO_LIMIT, types: graphFilterTypesToArray()
    })
    graphSelected.value = slug
  } catch {
    graph.value = { nodes: [], edges: [], meta: { mode: 'ego', total: 0, returned: 0, truncated: false, center: slug, depth } }
  } finally {
    graphLoading.value = false
    graphReady.value = true
  }
}

// ---------- 节点/边合并（bloom / growFrontier 用） ----------
function mergeGraphData(base: WikiGraphData, incoming: WikiGraphData): WikiGraphData {
  const nodeBySlug = new Map<string, WikiGraphData['nodes'][number]>()
  for (const n of base.nodes) nodeBySlug.set(n.slug, n)
  for (const n of incoming.nodes) if (!nodeBySlug.has(n.slug)) nodeBySlug.set(n.slug, n)
  const edgeKey = (e: { source: string; target: string }) => `${e.source}→${e.target}`
  const edgeSeen = new Set<string>()
  const edges: WikiGraphData['edges'] = []
  for (const e of base.edges) { const k = edgeKey(e); if (!edgeSeen.has(k)) { edgeSeen.add(k); edges.push(e) } }
  for (const e of incoming.edges) { const k = edgeKey(e); if (!edgeSeen.has(k)) { edgeSeen.add(k); edges.push(e) } }
  const nodes = Array.from(nodeBySlug.values())
  const meta = { ...(incoming.meta || base.meta), returned: nodes.length }
  return { nodes, edges, meta: meta as WikiGraphData['meta'] }
}

function evictBloomOverflow(data: WikiGraphData) {
  if (data.nodes.length <= BLOOM_MAX_NODES) return
  const removeSlugs = new Set(data.nodes.slice(BLOOM_MAX_NODES).map(n => n.slug))
  const keep = data.nodes.filter(n => !removeSlugs.has(n.slug))
  const keepSet = new Set(keep.map(n => n.slug))
  data.nodes = keep
  data.edges = data.edges.filter(e => keepSet.has(e.source) && keepSet.has(e.target))
}

/** 展开邻居（bloom）：增量拉取该节点邻居合并进当前图（preserveLayout 保留坐标） */
async function bloomNeighbors(slug: string) {
  if (!slug || !graph.value) return
  if (graphMode.value !== 'ego') {
    await loadEgoGraph(slug)
    return
  }
  bloomLoading.value = true
  try {
    const ego = await WikiApi.getGraph({
      kbId: props.kbId, mode: 'ego', centerSlug: slug, depth: GRAPH_EGO_DEFAULT_DEPTH,
      limit: GRAPH_EGO_LIMIT, types: graphFilterTypesToArray()
    })
    if (!ego || !ego.nodes?.length) return
    preserveLayout.value = true
    const merged = mergeGraphData(graph.value, ego)
    evictBloomOverflow(merged)
    graph.value = merged
  } catch {
    // 失败全局提示
  } finally {
    bloomLoading.value = false
  }
}

/** 设为中心：以该节点为 ego 中心重建图 */
async function pivotEgo(slug: string) {
  if (!slug) return
  preserveLayout.value = false
  await loadEgoGraph(slug)
}

/** 图内前沿节点（对齐 WeKnora isFrontierCandidate：可见度 < link_count 且非 ego 中心） */
function isFrontierCandidate(node: WikiGraphNode, centerSlug: string, visibleDegree: number): boolean {
  if (node.pageType === 'index') return false
  if (node.slug === centerSlug) return false
  return (node.linkCount || 0) > visibleDegree
}

const graphFrontierCount = computed(() => {
  const data = graph.value
  if (!data || data.meta?.mode !== 'ego') return 0
  const visibleDegree = new Map<string, number>()
  for (const e of data.edges) {
    visibleDegree.set(e.source, (visibleDegree.get(e.source) ?? 0) + 1)
    visibleDegree.set(e.target, (visibleDegree.get(e.target) ?? 0) + 1)
  }
  let count = 0
  const centerSlug = data.meta?.center || ''
  for (const n of data.nodes) {
    if (isFrontierCandidate(n, centerSlug, visibleDegree.get(n.slug) ?? 0)) count += 1
  }
  return count
})

/** 展开前沿：并发拉取所有可展开节点邻居，合并进当前图（对齐 WeKnora growFrontier） */
async function growFrontier() {
  const data = graph.value
  if (!data || graphMode.value !== 'ego' || graphFilterSelectsNothing()) return
  const visibleDegree = new Map<string, number>()
  for (const e of data.edges) {
    visibleDegree.set(e.source, (visibleDegree.get(e.source) ?? 0) + 1)
    visibleDegree.set(e.target, (visibleDegree.get(e.target) ?? 0) + 1)
  }
  const frontier: string[] = []
  for (const n of data.nodes) {
    if (isFrontierCandidate(n, graphCenter.value, visibleDegree.get(n.slug) ?? 0)) frontier.push(n.slug)
  }
  if (frontier.length === 0) return

  graphLoading.value = true
  try {
    const responses: WikiGraphData[] = []
    let cursor = 0
    async function worker() {
      while (cursor < frontier.length) {
        const idx = cursor++
        const slug = frontier[idx]
        try {
          const res = await WikiApi.getGraph({
            kbId: props.kbId, mode: 'ego', centerSlug: slug, depth: GRAPH_EGO_DEFAULT_DEPTH,
            limit: GRAPH_EGO_LIMIT, types: graphFilterTypesToArray()
          })
          if (res?.nodes?.length) responses.push(res)
        } catch {
          // 单个失败不阻塞整批
        }
      }
    }
    const workers: Promise<void>[] = []
    const workerCount = Math.min(GROW_FRONTIER_CONCURRENCY, frontier.length)
    for (let i = 0; i < workerCount; i++) workers.push(worker())
    await Promise.all(workers)
    if (responses.length === 0) return

    const current = graph.value
    if (!current) return

    preserveLayout.value = true
    let merged: WikiGraphData = current
    for (const incoming of responses) merged = mergeGraphData(merged, incoming)
    evictBloomOverflow(merged)
    graph.value = merged
  } finally {
    graphLoading.value = false
  }
}

/** 点击图节点 → 打开抽屉并加载该页面正文（对齐 WeKnora openGraphDrawer） */
const handleGraphSelect = (slug: string) => {
  if (!slug) {
    graphDrawerVisible.value = false
    graphDrawerPage.value = null
    return
  }
  graphSelected.value = slug
  openGraphDrawer(slug)
}

/** 图内 ⊕ 展开按钮 / shift+单击 */
const handleGraphBloom = (slug: string) => {
  bloomNeighbors(slug)
}

/** 双击 → 设为中心 */
const handleGraphPivot = (slug: string) => {
  pivotEgo(slug)
}

/** 加载页面内容到抽屉（对齐 WeKnora openGraphDrawer：getWikiPage + 渲染正文） */
const openGraphDrawer = async (slug: string) => {
  if (!slug) return
  graphDrawerVisible.value = true
  graphDrawerLoading.value = true
  try {
    graphDrawerPage.value = await WikiApi.getPage(props.kbId, slug)
    graphSelected.value = slug
  } catch {
    graphDrawerPage.value = null
    message.warning(`未找到页面：${slug}`)
  } finally {
    graphDrawerLoading.value = false
  }
}

/** 抽屉内 wiki 链接跳转：若目标在当前子图则直接打开，否则以目标为中心 ego 重拉 */
const handleDrawerNavigate = async (slug: string) => {
  const inGraph = graph.value?.nodes?.some(n => n.slug === slug)
  if (!inGraph) {
    await loadEgoGraph(slug)
  }
  openGraphDrawer(slug)
}

/** 打开来源文档（source_refs 里的 doc_id）→ 转发父级 document 页处理 */
const openSourceDoc = (docId: string) => {
  emit('open-source-doc', docId)
}

/** 抽屉邻居状态（对齐 WeKnora graphDrawerNeighborStatus） */
const graphDrawerNeighborStatus = computed(() => {
  const page = graphDrawerPage.value
  const data = graph.value
  if (!page || !data) return null
  const node = data.nodes.find(n => n.slug === page.slug)
  if (!node) return null
  const neighbors = new Set<string>()
  for (const e of data.edges) {
    if (e.source === page.slug) neighbors.add(e.target)
    else if (e.target === page.slug) neighbors.add(e.source)
  }
  const visible = neighbors.size
  const total = node.linkCount || 0
  const hidden = Math.max(0, total - visible)
  const isEgoCenter = data.meta?.mode === 'ego' && data.meta.center === page.slug
  const isOverview = data.meta?.mode === 'overview'
  return { visible, total, hidden, isEgoCenter, isOverview, fullyExplored: total === 0 || visible >= total || isEgoCenter }
})

const graphDrawerNeighborHint = computed(() => {
  const s = graphDrawerNeighborStatus.value
  if (!s) return ''
  if (s.total === 0) return '该页面暂无关联'
  if (s.visible >= s.total) return `已显示全部 ${s.total} 个关联页面`
  if (s.isEgoCenter) return `中心页面（已含全部可达邻居）· 已显示 ${s.visible}/${s.total}`
  if (s.isOverview) return `概览中显示 ${s.visible}/${s.total}，点击"设为中心"查看全部邻居`
  return `已显示 ${s.visible}/${s.total} 个关联，可展开剩余 ${s.hidden} 个`
})

const graphDrawerCanBloom = computed(() => {
  const s = graphDrawerNeighborStatus.value
  if (!s) return true
  if (s.isEgoCenter) return false
  return s.hidden > 0
})

/** 状态卡（对齐 WeKnora graphStatusCard） */
const graphStatusCard = computed<{ icon: string; title: string; primary: string; secondary: string } | null>(() => {
  const data = graph.value
  if (!data?.meta) return null
  const meta = data.meta
  if (meta.mode === 'ego' && meta.center) {
    const centerNode = data.nodes.find(n => n.slug === meta.center)
    const centerTitle = centerNode?.title || meta.center
    const typeLabel = centerNode?.pageType ? groupTypeLabel(centerNode.pageType) : ''
    const relatedCount = Math.max(0, meta.returned - 1)
    return {
      icon: 'ep:aim',
      title: '当前视图：邻居',
      primary: centerTitle,
      secondary: [typeLabel, `${relatedCount} 个关联节点`].filter(Boolean).join(' · ')
    }
  }
  if (meta.mode === 'overview') {
    return {
      icon: 'ep:connection',
      title: '当前视图：全库概览',
      primary: `显示 ${meta.returned} / ${meta.total} 个节点`,
      secondary: meta.truncated ? '已按关联度截断，点击节点可展开邻居' : '已展示全部页面'
    }
  }
  return null
})

// ========== 图谱搜索（对齐 WeKnora：空关键词回退 top-500 快照，输入远程检索） ==========
const graphSearchValue = ref('')
const graphSearchOptions = ref<{ label: string; value: string }[]>([])
const graphSearchLoading = ref(false)
let graphSearchDebounce: ReturnType<typeof setTimeout> | null = null
let graphSearchSeq = 0

const graphSearchEffectiveOptions = computed(() => graphSearchOptions.value)

const handleGraphRemoteSearch = async (keyword: string) => {
  const q = (keyword || '').trim()
  if (graphSearchDebounce) { clearTimeout(graphSearchDebounce); graphSearchDebounce = null }
  if (!q) {
    graphSearchOptions.value = []
    graphSearchLoading.value = false
    return
  }
  graphSearchLoading.value = true
  const seq = ++graphSearchSeq
  graphSearchDebounce = setTimeout(async () => {
    try {
      const res = await WikiApi.listPages(props.kbId)
      if (seq !== graphSearchSeq) return
      const lower = q.toLowerCase()
      graphSearchOptions.value = res
        .filter(p => (p.title || '').toLowerCase().includes(lower) || (p.slug || '').toLowerCase().includes(lower))
        .slice(0, 20)
        .map(p => ({ label: p.title, value: p.slug }))
    } catch {
      if (seq !== graphSearchSeq) return
      graphSearchOptions.value = []
    } finally {
      if (seq === graphSearchSeq) graphSearchLoading.value = false
    }
  }, 200)
}

/** 搜索选择：定位到图谱并打开抽屉（目标不在子图则 ego 重拉） */
const handleGraphSearchSelect = async (value: string) => {
  if (!value) return
  let node = graph.value?.nodes?.find(n => n.slug === value)
  if (!node) {
    await loadEgoGraph(value)
  }
  graphSelected.value = value
  openGraphDrawer(value)
  graphSearchValue.value = ''
}

// ========== 图例操作 ==========
const fitGraphToView = () => {
  graphRef.value?.fitView?.()
}
const toggleArrows = () => {
  showArrows.value = graphRef.value?.toggleArrows?.() ?? !showArrows.value
}

watch(
  () => activeTab.value,
  (v) => {
    if (v === 'graph') loadGraph()
  }
)

// ========== 新文档入库自动刷新（事件驱动，非轮询） ==========
// 文档解析任务完成（COMPLETED/FAILED）后，蒸馏页面会落库：
// 停留在"目录浏览"则重建树，停留在"知识图谱"则重拉图谱，让新录入的文档立即反映出来。
const { taskStatusMap } = useVectorTaskWs()
let refreshTimer: ReturnType<typeof setTimeout> | null = null

watch(
  taskStatusMap,
  () => {
    const hasTerminal = Array.from(taskStatusMap.values()).some(
      (m) => m.status === 'COMPLETED' || m.status === 'FAILED'
    )
    if (!hasTerminal || !props.kbId) return
    // 防抖：任务终态消息可能连续多条，合并为一次刷新
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      if (activeTab.value === 'graph') {
        loadGraph()
      } else {
        loadTree()
      }
      loadPendingIssueCount()
    }, 1500)
  },
  { deep: true }
)

// ========== AI 巡检待修复问题 ==========
const issuesVisible = ref(false)
const issues = ref<WikiIssueVO[]>([])
const pendingIssueCount = ref(0)

/** 重建链接进行中标记 */
const rebuilding = ref(false)

/** 收尾重建：死链清理 + 交叉链接 + 入链重建 + index 兜底（python 纯算法，不调 LLM） */
async function handleRebuildLinks() {
  if (!props.kbId) return
  rebuilding.value = true
  try {
    const stat = await WikiApi.rebuildLinks(props.kbId)
    message.success(
      `重建完成：清理死链 ${stat?.dead_removed ?? 0} · 补交叉链 ${stat?.cross_added ?? 0} · 重建入链 ${stat?.relinked ?? 0}`
    )
  } catch (e) {
    message.error('重建链接失败')
  } finally {
    rebuilding.value = false
  }
}

/** 质量检查进行中标记 */
const linting = ref(false)
/** 自动修复进行中标记 */
const autoFixing = ref(false)

/** Wiki 质量检查（lint）：展示健康分与问题统计 */
async function handleLint() {
  if (!props.kbId) return
  linting.value = true
  try {
    const r = await WikiApi.lint(props.kbId)
    const c = r?.counts || {}
    message.success(
      `健康分 ${r?.health_score ?? '-'}/100：共 ${c.total ?? 0} 个问题（${c.error ?? 0} 错误 / ${c.warning ?? 0} 警告 / ${c.info ?? 0} 建议）`
    )
  } catch (e) {
    message.error('质量检查失败')
  } finally {
    linting.value = false
  }
}

/** 自动修复可修项（死链 / 空内容 / 失效来源），修完自动重建入链 */
async function handleAutoFix() {
  if (!props.kbId) return
  autoFixing.value = true
  try {
    const r = await WikiApi.autoFix(props.kbId)
    const d = r?.details || {}
    message.success(
      `已修复 ${r?.fixed ?? 0} 项：死链 ${d.broken_link ?? 0} · 空内容 ${d.empty_content ?? 0} · 失效来源 ${d.stale_ref ?? 0} · 删页 ${d.deleted_page ?? 0}`
    )
  } catch (e) {
    message.error('自动修复失败')
  } finally {
    autoFixing.value = false
  }
}

/** 攒批进度进行中标记 */
const batchLoading = ref(false)

/** Wiki 蒸馏进度（阶段② 攒批：批次状态 + 待处理文档数） */
async function handleBatchProgress() {
  if (!props.kbId) return
  batchLoading.value = true
  try {
    const r = await WikiApi.getBatchLatest(props.kbId)
    const st = r?.state || {}
    const pending = r?.pending ?? 0
    if (!r?.batch_id) {
      message.info(`暂无蒸馏批次；待处理文档 ${pending} 篇`)
      return
    }
    const metrics = st.metrics || {}
    message.info(
      `最近批次 ${st.status || '-'}（${st.progress ?? 0}%）：${st.step || '-'}；` +
      `文档 ${metrics.docs ?? '-'} 篇 · 生成 ${metrics.pages ?? '-'} 页 · 待处理 ${pending} 篇`
    )
  } catch (e) {
    message.error('获取蒸馏进度失败')
  } finally {
    batchLoading.value = false
  }
}

/** 新建目录（当前建在根目录下；目录名不得含分隔符） */
async function handleCreateFolder() {
  if (!props.kbId) return
  try {
    const { value } = await ElMessageBox.prompt('请输入目录名称', '新建目录', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /^[^/｜|／]+$/,
      inputErrorMessage: '目录名不得为空或含分隔符'
    })
    const name = (value || '').trim()
    if (!name) return
    await WikiApi.createFolder(props.kbId, name, '')
    message.success('目录已创建')
    await loadTree()
  } catch (e) {
    // 用户取消或创建失败（失败由请求拦截提示）
  }
}

// ========== 目录 / 页面 操作（重命名 / 移动 / 删除） ==========
/** el-tree-select 的「根目录」哨兵值（API 约定：空串 = 根） */
const ROOT_FOLDER_VALUE = '__root__'

interface FolderSelectNode {
  value: string
  label: string
  children?: FolderSelectNode[]
}

/** 目录实体索引（folder_id → 实体），源自 folderEntityTree 缓存，避免每次操作重复请求后端 */
const folderEntityById = computed<Map<string, any>>(() => {
  const map = new Map<string, any>()
  const walk = (nodes: any[]) => {
    for (const n of nodes || []) {
      const id = String(n?.folder_id ?? n?.id ?? '')
      if (id) map.set(id, n)
      walk(n?.children || [])
    }
  }
  walk(folderEntityTree.value)
  return map
})

/** 目录实体索引（物化 path → 实体），用于无 folderId 的旧节点回退匹配 */
const folderEntityByPath = computed<Map<string, any>>(() => {
  const map = new Map<string, any>()
  const walk = (nodes: any[]) => {
    for (const n of nodes || []) {
      const p = Array.isArray(n?.path) ? n.path.join('/') : String(n?.path || '')
      if (p) map.set(p, n)
      walk(n?.children || [])
    }
  }
  walk(folderEntityTree.value)
  return map
})

/** 收集目录自身及整棵子树的 folder_id（移动目录时需排除，避免移入自身子树） */
const collectFolderIds = (node: any, acc: Set<string>) => {
  const id = String(node?.folder_id ?? node?.id ?? '')
  if (id) acc.add(id)
  for (const c of node?.children || []) collectFolderIds(c, acc)
}

/** 目录实体树 → el-tree-select 数据（可排除指定 folder_id 集合） */
const toFolderSelectData = (nodes: any[], exclude?: Set<string>): FolderSelectNode[] => {
  const out: FolderSelectNode[] = []
  for (const n of nodes || []) {
    const id = String(n.folder_id ?? n.id ?? '')
    if (exclude?.has(id)) continue
    out.push({ value: id, label: String(n.name || ''), children: toFolderSelectData(n.children || [], exclude) })
  }
  return out
}

/** 把知识树目录节点解析成目录实体；优先用节点自带 folderId（免请求），失败给出提示并返回 null */
const resolveFolderEntity = (node: TreeNode): any | null => {
  const byId = node.folderId ? folderEntityById.value.get(node.folderId) : undefined
  if (byId) return byId
  const byPath = folderEntityByPath.value.get(node.key)
  if (byPath) return byPath
  message.warning('该目录暂无对应目录实体，无法管理（上传文档重新入库后可用）')
  return null
}

/** 重命名目录 */
const handleRenameFolder = async (node: TreeNode) => {
  const folder = resolveFolderEntity(node)
  if (!folder) return
  let name = ''
  try {
    const { value } = await ElMessageBox.prompt('请输入新的目录名称', '重命名目录', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: String(folder.name || ''),
      inputPattern: /^[^/｜|／]+$/,
      inputErrorMessage: '目录名不得为空或含分隔符'
    })
    name = (value || '').trim()
  } catch {
    return // 用户取消，不报错
  }
  if (!name || name === folder.name) return
  try {
    await WikiApi.renameFolder(props.kbId, String(folder.folder_id), name)
    message.success('目录已重命名')
    await loadTree()
  } catch {
    // 失败由请求拦截统一提示
  }
}

/** 删除目录（连同整棵子树；子树内页面归位到根目录） */
const handleDeleteFolder = async (node: TreeNode) => {
  const folder = resolveFolderEntity(node)
  if (!folder) return
  try {
    await ElMessageBox.confirm(
      `确认删除目录「${folder.name}」及其全部子目录？该目录子树内页面将归位到根目录。`,
      '删除目录',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return // 用户取消，不报错
  }
  try {
    await WikiApi.deleteFolder(props.kbId, String(folder.folder_id))
    message.success('目录已删除')
    await loadTree()
  } catch {
    // 失败由请求拦截统一提示
  }
}

// ---------- 移动目录 ----------
const folderMoveVisible = ref(false)
const folderMoveLoading = ref(false)
const folderMoveTarget = ref<any | null>(null)
const folderMoveParent = ref<string>(ROOT_FOLDER_VALUE)
const folderMoveOptions = ref<FolderSelectNode[]>([])
/** 下拉数据：根目录选项 + 过滤后的目录实体（已排除自身子树） */
const folderMoveSelectData = computed<FolderSelectNode[]>(() => [
  { value: ROOT_FOLDER_VALUE, label: '根目录' },
  ...folderMoveOptions.value
])

/** 打开移动目录对话框（目标父级排除自身及子树；下拉数据取自组件内缓存，不再请求后端） */
const handleMoveFolder = (node: TreeNode) => {
  const folder = resolveFolderEntity(node)
  if (!folder) return
  const exclude = new Set<string>()
  collectFolderIds(folder, exclude)
  folderMoveOptions.value = toFolderSelectData(folderEntityTree.value, exclude)
  folderMoveTarget.value = folder
  // 当前父级：优先节点自带 parentId，回退实体字段
  const parentId = String(node.parentId ?? folder.parent_id ?? '')
  folderMoveParent.value = parentId || ROOT_FOLDER_VALUE
  folderMoveVisible.value = true
}

const confirmMoveFolder = async () => {
  const folder = folderMoveTarget.value
  if (!folder || !props.kbId) return
  folderMoveLoading.value = true
  try {
    const parentId = folderMoveParent.value === ROOT_FOLDER_VALUE ? '' : (folderMoveParent.value || '')
    await WikiApi.moveFolder(props.kbId, String(folder.folder_id), parentId)
    message.success('目录已移动')
    folderMoveVisible.value = false
    await loadTree()
  } catch {
    // 失败由请求拦截统一提示
  } finally {
    folderMoveLoading.value = false
  }
}

// ---------- 移动页面 ----------
const pageMoveVisible = ref(false)
const pageMoveLoading = ref(false)
const pageMoveSlug = ref('')
const pageMoveTitle = ref('')
const pageMoveFolder = ref<string>(ROOT_FOLDER_VALUE)
const pageMoveOptions = ref<FolderSelectNode[]>([])
const pageMoveSelectData = computed<FolderSelectNode[]>(() => [
  { value: ROOT_FOLDER_VALUE, label: '根目录' },
  ...pageMoveOptions.value
])

/** 打开移动页面对话框（目录下拉取自组件内缓存；无目录实体时提示后返回） */
const handleMovePage = (node: TreeNode) => {
  const page = node.page
  if (!page || !props.kbId) return
  if (!folderEntityTree.value.length) {
    message.warning('尚无目录实体，请先新建目录（或上传文档重新入库生成）后再整理')
    return
  }
  pageMoveOptions.value = toFolderSelectData(folderEntityTree.value)
  pageMoveSlug.value = page.slug
  pageMoveTitle.value = page.title
  pageMoveFolder.value = page.folderId ? String(page.folderId) : ROOT_FOLDER_VALUE
  pageMoveVisible.value = true
}

const confirmMovePage = async () => {
  if (!pageMoveSlug.value || !props.kbId) return
  pageMoveLoading.value = true
  try {
    const folderId = pageMoveFolder.value === ROOT_FOLDER_VALUE ? '' : (pageMoveFolder.value || '')
    await WikiApi.movePage(props.kbId, pageMoveSlug.value, folderId)
    message.success('页面已移动')
    pageMoveVisible.value = false
    await loadTree()
  } catch {
    // 失败由请求拦截统一提示
  } finally {
    pageMoveLoading.value = false
  }
}

const loadPendingIssueCount = async () => {
  try {
    const list = await WikiApi.listIssues(props.kbId, undefined, 'pending')
    pendingIssueCount.value = list.length
  } catch {
    pendingIssueCount.value = 0
  }
}

watch(
  () => props.kbId,
  () => {
    pages.value = []
    folders.value = []
    folderEntityTree.value = []
    knowledgeTree.value = []
    graph.value = { nodes: [], edges: [], meta: { mode: 'overview', total: 0, returned: 0, truncated: false } }
    graphReady.value = false
    currentView.value = 'none'
    currentPage.value = null
    issues.value = []
    pendingIssueCount.value = 0
    if (props.kbId) {
      loadTree()
      loadPendingIssueCount()
      if (activeTab.value === 'graph') loadGraph()
    }
  },
  { immediate: true }
)

const openIssuesDrawer = async (reload = false) => {
  issuesVisible.value = true
  if (reload) {
    try {
      issues.value = await WikiApi.listIssues(props.kbId, undefined, 'pending')
    } catch {
      issues.value = []
    }
  }
}

/** 标记误报 → 状态置 ignored */
const handleIssueIgnore = async (issue: WikiIssueVO) => {
  try {
    await WikiApi.updateIssueStatus(props.kbId, issue.slug, issue.issueType, 'ignored')
    issues.value = issues.value.filter((i) => i.slug === issue.slug && i.issueType === issue.issueType)
    pendingIssueCount.value = issues.value.length
  } catch {}
}

/** 已处理 → 状态置 resolved */
const handleIssueResolved = async (issue: WikiIssueVO) => {
  try {
    await WikiApi.updateIssueStatus(props.kbId, issue.slug, issue.issueType, 'resolved')
    issues.value = issues.value.filter((i) => i.slug === issue.slug && i.issueType === issue.issueType)
    pendingIssueCount.value = issues.value.length
  } catch {}
}

/** 跳转到问题对应页面 */
const navigateToIssue = (slug: string) => {
  issuesVisible.value = false
  openBySlug(slug)
}

const aiReporterText = (r?: string) => {
  return r === 'wiki-researcher-agent' ? 'AI 巡检' : r || '用户'
}
</script>
<style scoped>
.wiki-browser {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.wiki-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}
.wiki-tabs {
  flex: 1;
  min-width: 0;
}
.wiki-tabs :deep(.el-tabs__header) {
  margin-bottom: 8px;
}
.wiki-body {
  min-height: 300px;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.wiki-tree-layout {
  display: flex;
  gap: 12px;
  min-height: 420px;
  flex: 1;
  align-items: stretch;
}
.wiki-sidebar {
  flex: 0 0 280px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 8px;
  align-self: stretch;
}
.wiki-content {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 16px;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}
.wiki-nav-index {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.wiki-nav-index:hover,
.wiki-nav-index.active {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}
.wiki-sidebar-divider {
  border-top: 1px solid var(--el-border-color-lighter);
  margin: 8px 0;
}
.wiki-side-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.wiki-side-tab {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 4px;
  padding: 6px 0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.wiki-side-tab:hover {
  background: var(--el-fill-color-light);
}
.wiki-side-tab.active {
  color: var(--el-color-primary);
  font-weight: 600;
  background: var(--el-fill-color-light);
}
.wiki-side-tab-count {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.wiki-side-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wiki-side-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.wiki-side-item:hover {
  background: var(--el-fill-color-light);
}
.wiki-side-item.active {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}
.wiki-side-tree {
  min-height: 100px;
}
/* 树节点操作菜单：默认隐藏，节点悬浮时显示 */
.tree-node-menu {
  margin-left: 6px;
  flex: none;
  opacity: 0;
  transition: opacity 0.2s;
}
.tree-node:hover .tree-node-menu {
  opacity: 1;
}
.node-more {
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 14px;
}
.node-more:hover {
  color: var(--el-color-primary);
}
.move-dialog-tip {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.wiki-issue-badge {
  cursor: pointer;
}
.issue-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.issue-item {
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.issue-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.issue-slug {
  color: var(--el-color-primary);
  cursor: pointer;
  font-size: 12px;
}
.issue-slug:hover {
  text-decoration: underline;
}
.issue-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  line-height: 1.5;
}
.issue-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.issue-reporter {
  margin-right: auto;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.node-icon {
  flex: none;
}
.node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-count {
  margin-left: auto;
}
.index-group {
  margin-top: 16px;
}
.index-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.index-table {
  cursor: pointer;
}
.view-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.graph-drawer-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.graph-drawer-meta .el-button {
  margin-left: auto;
}
.graph-drawer-ver {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.wiki-drawer-neighbor-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 4px;
  padding: 6px 10px;
  margin-bottom: 12px;
}

/* ===== 图谱视图（对齐 WeKnora overlay 布局） ===== */
.wiki-graph-view {
  position: relative;
  min-height: 520px;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.graph-overlay {
  position: absolute;
  z-index: 10;
}
.graph-search-overlay {
  top: 12px;
  left: 12px;
  width: 320px;
}
.graph-search-select {
  width: 100%;
}
.graph-search-select :deep(.el-select__wrapper) {
  background: var(--el-bg-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.graph-legend-overlay {
  top: 12px;
  right: 12px;
  bottom: auto;
  left: auto;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 10px 12px;
  max-width: 260px;
}
.graph-legend-overlay.legend-shifted {
  /* 抽屉打开时整体左移，避免被 480px 抽屉遮挡 */
  transform: translateX(0);
}
.legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  user-select: none;
}
.legend-item.clickable {
  cursor: pointer;
}
.legend-item.clickable.disabled {
  opacity: 0.35;
  text-decoration: line-through;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
.legend-divider {
  border-top: 1px solid var(--el-border-color-lighter);
  margin: 8px 0;
}
.legend-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.legend-action {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  padding: 2px 0;
}
.legend-action:hover {
  color: var(--el-color-primary);
}
.legend-action-icon {
  font-size: 15px;
  flex: none;
}
.wiki-graph-status-card {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.status-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.status-card-icon {
  font-size: 14px;
}
.status-card-title {
  font-weight: 600;
}
.status-card-primary {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-card-secondary {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.graph-empty-tip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 图谱抽屉样式优化 ===== */
.graph-drawer-body {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.graph-drawer-body :deep(.wiki-brief) {
  flex: 1;
  overflow: auto;
}
.graph-drawer-body :deep(.brief-content) {
  flex: 1;
  min-height: 200px;
}
</style>
