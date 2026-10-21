import request from '@/config/axios'

/** Wiki 页面（Java GET /kb/wiki/list 与 /kb/wiki/get 返回字段，snake 风格） */
export interface WikiPageVO {
  id: number
  kbId: number
  slug: string
  title: string
  content: string
  summary?: string
  aliases?: string // JSON 数组字符串（昵称/别名）
  pageType?: string // wiki 页面分类知名（概念/文档等，由后端定义）
  folderId?: string // 所属目录实体ID（空=根；目录实体 id 为字符串）
  categoryPath?: string
  depth?: number
  /** 来源文档 ID 列表（doc_id） */
  sourceRefs?: string[]
  /** 关联 chunk ID 列表 */
  chunkRefs?: string[]
  /** 被哪些 slug 引用（反向链接） */
  inLinks?: string[]
  /** 本页引用哪些 slug（外链） */
  outLinks?: string[]
  status?: number
  revision: number // 当前版本号（乐观锁）
  version?: number
  lastEditSource?: string
  lastEditorName?: string
  createTime?: string
  updateTime?: string
}

/** 页面保存/编辑请求（乐观锁：编辑时传 expectedRevision，冲突返回 53） */
export interface WikiPageSaveReqVO {
  kbId: number
  slug: string
  title: string
  content: string
  summary?: string
  aliases?: string
  pageType?: string
  folderId?: string // 所属目录实体ID（空=根）
  status?: number
  expectedRevision?: number
}

/** 页面修订记录 */
export interface WikiRevisionVO {
  id: number
  revision: number
  title: string
  content: string
  summary?: string
  pageType?: string
  editSource?: string
  operatorName?: string
  createTime?: string
}

/** 页面回滚请求（slug 键控） */
export interface WikiRevertReqVO {
  kbId: number
  slug: string
  targetRevision: number
  expectedRevision: number
}

/** 图谱节点 */
export interface WikiGraphNode {
  slug: string
  title: string
  pageType?: string
  linkCount: number
  familiar?: boolean
}

/** 图谱边 */
export interface WikiGraphEdge {
  source: string
  target: string
}

/** 图谱元信息（对齐 WeKnora WikiGraphMeta：截断提示/ego 状态） */
export interface WikiGraphMeta {
  mode: 'overview' | 'ego'
  total: number
  returned: number
  truncated: boolean
  center?: string
  depth?: number
  familiarCount?: number
}

/** 图谱数据 */
export interface WikiGraphData {
  nodes: WikiGraphNode[]
  edges: WikiGraphEdge[]
  meta?: WikiGraphMeta
}

/** 图谱查询参数（对齐 WeKnora /graph：mode/center/depth/types/limit） */
export interface WikiGraphParams {
  kbId: number
  mode: 'overview' | 'ego'
  centerSlug?: string
  depth?: number
  /** page_type 白名单，逗号分隔字符串（如 "entity,concept"）；空/缺省=不过滤 */
  types?: string
  limit?: number
}

/** 目录树节点（Java GET /kb/wiki/folder/list） */
export interface WikiFolderVO {
  id: number
  kbId: number
  parentId: number
  name: string
  path: string
  depth: number
  sortOrder: number
  pageCount: number
}

/** index 聚合（Java GET /kb/wiki/index） */
export interface WikiIndexVO {
  intro?: string
  version?: number
  groups: Array<{
    type: string
    total: number
    items: Array<{ slug: string; title: string; summary?: string; categoryPath?: string }>
  }>
}

/** Wiki 待修复问题（Java GET /kb/wiki/issues） */
export interface WikiIssueVO {
  id: number
  kbId: number
  slug: string
  issueType: string // contradictory_facts/mixed_entities/out_of_date/attention
  description?: string
  /** 怀疑导致污染的来源文档 ID 列表（对齐 WeKnora suspected_knowledge_ids） */
  suspectedKnowledgeIds?: string[]
  status: string // pending/ignored/resolved
  reportedBy?: string
  createTime?: string
}

// 知识库 Wiki 相关 API（全部经 CommonResult 包裹，request 自动解包）
export const WikiApi = {
  /** 列出知识库全部 Wiki 页面 */
  listPages: async (kbId: number): Promise<WikiPageVO[]> => {
    const data = await request.get({ url: `/kb/wiki/list`, params: { kbId } })
    return data as WikiPageVO[]
  },

  /** 获取单个页面详情（KB+slug 键控） */
  getPage: async (kbId: number, slug: string): Promise<WikiPageVO> => {
    const data = await request.get({ url: `/kb/wiki/get`, params: { kbId, slug } })
    return data as WikiPageVO
  },

  /** 新建/保存页面（正文写 ES） */
  savePage: async (data: WikiPageSaveReqVO): Promise<void> => {
    await request.post({ url: `/kb/wiki/save`, data })
  },

  /** 回滚页面到指定版本（返回新 revision） */
  revertPage: async (data: WikiRevertReqVO): Promise<number> => {
    return await request.put({ url: `/kb/wiki/revert`, data })
  },

  /** 查询页面修订历史 */
  listRevisions: async (kbId: number, slug: string): Promise<WikiRevisionVO[]> => {
    const data = await request.get({ url: `/kb/wiki/revisions`, params: { kbId, slug } })
    return data as WikiRevisionVO[]
  },

  /** 查询页面图谱（overview：全库辐射；ego：以 centerSlug 为中心） */
  getGraph: async (params: WikiGraphParams): Promise<WikiGraphData> => {
    const data = await request.get({ url: `/kb/wiki/graph`, params })
    return data as WikiGraphData
  },

  /** 列出知识库全部目录树（含各目录挂载页数，前端组树） */
  listFolders: async (kbId: number): Promise<WikiFolderVO[]> => {
    const data = await request.get({ url: `/kb/wiki/folder/list`, params: { kbId } })
    return data as WikiFolderVO[]
  },

  /** 知识库 index 聚合（intro + 按 page_type 分组目录） */
  getIndex: async (kbId: number): Promise<WikiIndexVO> => {
    const data = await request.get({ url: `/kb/wiki/index`, params: { kbId } })
    return data as WikiIndexVO
  },

  /** 列出知识库待修复问题（AI 巡检产物；可按 slug/status 过滤） */
  listIssues: async (kbId: number, slug?: string, status?: string): Promise<WikiIssueVO[]> => {
    const data = await request.get({
      url: `/kb/wiki/issues`,
      params: { kbId, slug, status }
    })
    return data as WikiIssueVO[]
  },

  /** 更新问题状态（pending/ignored/resolved）——处理或标记误报 */
  updateIssueStatus: async (kbId: number, slug: string, issueType: string, status: string): Promise<void> => {
    await request.put({
      url: `/kb/wiki/issue/status`,
      params: { kbId, slug, issueType, status }
    })
  },

  /** 收尾重建：死链清理 + 交叉链接 + 入链重建 + index 兜底（纯算法，不含 LLM） */
  rebuildLinks: async (kbId: number): Promise<Record<string, any>> => {
    const data = await request.post({ url: `/kb/wiki/rebuild-links`, params: { kbId } })
    return data as Record<string, any>
  },

  /** Wiki 健康统计：页数/链接数/孤立页/死链数/待处理问题数 */
  getStats: async (kbId: number): Promise<Record<string, any>> => {
    const data = await request.get({ url: `/kb/wiki/stats`, params: { kbId } })
    return data as Record<string, any>
  },

  /** 最近一次 Wiki 攒批状态（阶段② 蒸馏进度 + 待处理文档数） */
  getBatchLatest: async (kbId: number): Promise<Record<string, any>> => {
    const data = await request.get({ url: `/kb/wiki/batch/latest`, params: { kbId } })
    return data as Record<string, any>
  },

  /** Wiki 质量检查（lint）：孤立页/死链/空内容/失效来源/缺失交叉链接 + 健康分 */
  lint: async (kbId: number): Promise<Record<string, any>> => {
    const data = await request.get({ url: `/kb/wiki/lint`, params: { kbId } })
    return data as Record<string, any>
  },

  /** 自动修复可修项：死链拆文本 / 空内容归档 / 失效来源清理 */
  autoFix: async (kbId: number): Promise<Record<string, any>> => {
    const data = await request.post({ url: `/kb/wiki/auto-fix`, params: { kbId } })
    return data as Record<string, any>
  },

  // ---- 独立目录实体（P1-1） ----

  /** 目录实体树（含每目录直接挂载页数） */
  folderTree: async (kbId: number): Promise<any[]> => {
    const data = await request.get({ url: `/kb/wiki/folder-tree`, params: { kbId } })
    return data as any[]
  },

  /** 创建目录（parentId 为空表示根） */
  createFolder: async (kbId: number, name: string, parentId = ''): Promise<Record<string, any>> => {
    const data = await request.post({ url: `/kb/wiki/folder`, params: { kbId, name, parentId } })
    return data as Record<string, any>
  },

  /** 重命名目录（级联更新子树与页面派生路径） */
  renameFolder: async (kbId: number, folderId: string, name: string): Promise<Record<string, any>> => {
    const data = await request.put({ url: `/kb/wiki/folder/rename`, params: { kbId, folderId, name } })
    return data as Record<string, any>
  },

  /** 移动目录到新父级（禁止移入自身子树） */
  moveFolder: async (kbId: number, folderId: string, parentId = ''): Promise<Record<string, any>> => {
    const data = await request.put({ url: `/kb/wiki/folder/move`, params: { kbId, folderId, parentId } })
    return data as Record<string, any>
  },

  /** 删除目录及整棵子树（子树内页面归位到根） */
  deleteFolder: async (kbId: number, folderId: string): Promise<Record<string, any>> => {
    const data = await request.delete({ url: `/kb/wiki/folder`, params: { kbId, folderId } })
    return data as Record<string, any>
  },

  /** 移动页面到指定目录（folderId 为空表示根） */
  movePage: async (kbId: number, slug: string, folderId = ''): Promise<Record<string, any>> => {
    const data = await request.put({ url: `/kb/wiki/page/move`, params: { kbId, slug, folderId } })
    return data as Record<string, any>
  }
}