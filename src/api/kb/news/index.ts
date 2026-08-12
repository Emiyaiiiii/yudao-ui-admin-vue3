import request from '@/config/axios'

// ==================== 类型定义 ====================

/** 新闻数据源 */
export interface NewsSource {
  id: number
  name: string
  dbHost: string
  dbPort: number
  dbName: string
  dbUser: string
  tableName: string
  // 字段映射
  idField: string
  titleField: string
  contentField: string
  channelField?: string
  timeField?: string
  urlField?: string
  crdeptField?: string
  cruserField?: string
  // 同步配置
  syncEnabled: number
  syncInterval: number
  lastSyncTime?: string
  // 统计
  totalRecords: number
  processedRecords: number
  errorCount: number
  // 扩展
  recordsCount?: number
  pendingCount?: number
  completedCount?: number
  createTime?: string
  updateTime?: string
}

/** 新闻数据源分页请求 */
export interface NewsSourcePageReq {
  pageNo: number
  pageSize: number
  search?: string
  syncEnabled?: number
}

/** 新闻记录 */
export interface NewsRecord {
  id: number
  sourceId: number
  sourceName?: string
  externalId: string
  externalTitle?: string
  externalContent?: string
  externalChannel?: string
  externalTime?: string
  externalUrl?: string
  externalCrdept?: string
  externalCruser?: string
  status: 'pending' | 'completed' | 'failed' | 'skipped'
  statusDisplay?: string
  processingStatus?: string
  errorMessage?: string
  retryCount: number
  lastProcessedAt?: string
  processedAt?: string
  externalUpdatedAt?: string
  createTime?: string
  updateTime?: string
  // 前端扩展
  _parsing?: boolean
}

/** 新闻记录分页请求 */
export interface NewsRecordPageReq {
  pageNo: number
  pageSize: number
  search?: string
  sourceId?: number
  status?: string
  externalChannel?: string
}

/** 同步日志 */
export interface NewsSyncLog {
  id: number
  sourceId: number
  sourceName?: string
  syncType: 'full' | 'incremental' | 'manual'
  syncTypeDisplay?: string
  status: 'started' | 'running' | 'completed' | 'failed'
  statusDisplay?: string
  totalFetched: number
  newRecords: number
  updatedRecords: number
  skippedRecords: number
  failedRecords: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  details?: string
  createTime?: string
}

/** 同步日志分页请求 */
export interface NewsSyncLogPageReq {
  pageNo: number
  pageSize: number
  sourceId?: number
  syncType?: string
  status?: string
}

/** 全局统计 */
export interface NewsStats {
  total: number
  pending: number
  completed: number
  failed: number
  skipped: number
}

// ==================== 新闻数据源 API ====================

export const NewsSourceApi = {
  /** 分页查询 */
  getPage: async (params: NewsSourcePageReq) => {
    return await request.get({ url: `/kb/news-source/page`, params })
  },

  /** 查询详情 */
  get: async (id: number) => {
    return await request.get({ url: `/kb/news-source/get?id=` + id })
  },

  /** 新增 */
  create: async (data: any) => {
    return await request.post({ url: `/kb/news-source/create`, data })
  },

  /** 更新 */
  update: async (data: any) => {
    return await request.put({ url: `/kb/news-source/update`, data })
  },

  /** 删除 */
  delete: async (id: number) => {
    return await request.delete({ url: `/kb/news-source/delete?id=` + id })
  },

  /** 获取数据源统计 */
  getStats: async (id: number) => {
    return await request.get({ url: `/kb/news-source/stats?id=` + id })
  },

  /** 获取数据源最近同步日志 */
  getSyncLogs: async (id: number, limit = 20) => {
    return await request.get({ url: `/kb/news-source/sync-logs?id=` + id + `&limit=` + limit })
  },

  /** 手动触发同步 */
  triggerSync: async (id: number, syncType = 'manual') => {
    return await request.post({ url: `/kb/news-source/trigger-sync`, data: { id, syncType } })
  },
}

// ==================== 新闻记录 API ====================

export const NewsRecordApi = {
  /** 分页查询 */
  getPage: async (params: NewsRecordPageReq) => {
    return await request.get({ url: `/kb/news-record/page`, params })
  },

  /** 查询详情 */
  get: async (id: number) => {
    return await request.get({ url: `/kb/news-record/get?id=` + id })
  },

  /** 批量重试 */
  batchRetry: async (ids: number[]) => {
    return await request.post({ url: `/kb/news-record/batch-retry`, data: { ids } })
  },

  /** 批量删除 */
  batchDelete: async (ids: number[]) => {
    return await request.post({ url: `/kb/news-record/batch-delete`, data: { ids } })
  },

  /** 获取频道列表 */
  getChannels: async () => {
    return await request.get({ url: `/kb/news-record/channels` })
  },

  /** 获取全局统计 */
  getStats: async () => {
    return await request.get({ url: `/kb/news-record/stats` })
  },

  /** 单条解析（暂未实现） */
  parse: async (id: number, force = false) => {
    return await request.post({ url: `/kb/news-record/parse`, data: { id, force } })
  },

  /** 批量解析（暂未实现） */
  batchParse: async (ids: number[], force = false) => {
    return await request.post({ url: `/kb/news-record/batch-parse`, data: { ids, force } })
  },
}

// ==================== 同步日志 API ====================

export const NewsSyncLogApi = {
  /** 分页查询 */
  getPage: async (params: NewsSyncLogPageReq) => {
    return await request.get({ url: `/kb/news-sync-log/page`, params })
  },

  /** 查询详情 */
  get: async (id: number) => {
    return await request.get({ url: `/kb/news-sync-log/get?id=` + id })
  },
}

// ==================== 状态常量 ====================

export const NEWS_STATUS_OPTIONS = [
  { value: 'pending', label: '待处理', type: 'info' },
  { value: 'completed', label: '已完成', type: 'success' },
  { value: 'failed', label: '失败', type: 'danger' },
  { value: 'skipped', label: '已跳过', type: '' },
]

export const SYNC_TYPE_OPTIONS = [
  { value: 'full', label: '全量同步' },
  { value: 'incremental', label: '增量同步' },
  { value: 'manual', label: '手动同步' },
]

export const SYNC_STATUS_OPTIONS = [
  { value: 'started', label: '已开始', type: 'info' },
  { value: 'running', label: '运行中', type: 'warning' },
  { value: 'completed', label: '已完成', type: 'success' },
  { value: 'failed', label: '失败', type: 'danger' },
]
