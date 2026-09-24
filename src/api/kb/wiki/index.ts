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
  folderId?: number
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
  folderId?: number
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
  }
}