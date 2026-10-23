import request from '@/config/axios'

/** 向量处理任务状态枚举 */
export const VectorTaskStatus = {
  PENDING: 0, // 待处理
  PROCESSING: 1, // 处理中
  COMPLETED: 2, // 已完成
  FAILED: 3, // 失败
  SUBMIT_FAILED: 4, // 提交失败
  TIMEOUT: 5, // 超时
  CANCELLED: 6 // 已取消
} as const

/** 判断是否为终态 */
export const isTerminalStatus = (status: number | undefined): boolean => {
  if (status === undefined || status === null) return false
  return [
    VectorTaskStatus.COMPLETED,
    VectorTaskStatus.FAILED,
    VectorTaskStatus.SUBMIT_FAILED,
    VectorTaskStatus.TIMEOUT,
    VectorTaskStatus.CANCELLED
  ].includes(status)
}

/** 向量任务状态标签配置 */
export const vectorStatusConfig: Record<
  number,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary'; }
> = {
  [VectorTaskStatus.PENDING]: { label: '待处理', type: 'info' },
  [VectorTaskStatus.PROCESSING]: { label: '处理中', type: 'primary' },
  [VectorTaskStatus.COMPLETED]: { label: '已完成', type: 'success' },
  [VectorTaskStatus.FAILED]: { label: '失败', type: 'danger' },
  [VectorTaskStatus.SUBMIT_FAILED]: { label: '提交失败', type: 'danger' },
  [VectorTaskStatus.TIMEOUT]: { label: '超时', type: 'warning' },
  [VectorTaskStatus.CANCELLED]: { label: '已取消', type: 'info' }
}

/** 处理阶段时间线节点（python state_bus 写入，Java 透传） */
export interface VectorTaskStage {
  stage: string // download/parse/chunk/embed/store/postprocess
  status: 'processing' | 'completed' | 'failed' | 'skipped' | 'cancelled'
  begin_ts?: number // 开始毫秒时间戳
  end_ts?: number // 结束毫秒时间戳
  duration_s?: number // 阶段耗时(秒)
  metrics?: Record<string, any> // 阶段指标: chunk_count/text_chars/vector_count/es_indexed 等
}

/** WebSocket 推送的向量任务状态消息 */
export interface VectorTaskWsMessage {
  taskId: string
  status: string // 字符串: PENDING, PROCESSING, COMPLETED, FAILED
  progress: number
  step: string
  chunkCount: number
  errorMsg: string
  stages?: VectorTaskStage[] // 处理阶段时间线
}

/** 向量处理任务（管理端列表/详情） */
export interface VectorTask {
  id: number
  taskId: string
  docId: number
  kbId: number
  fileUrl?: string
  fileType?: string
  status: number
  progress?: number
  currentStep?: string
  /** 处理阶段时间线 JSON 字符串 */
  stages?: string
  chunkCount?: number
  /** 任务下发参数 JSON（切片/解析配置等） */
  params?: string
  /** 失败原因 */
  errorMsg?: string
  queuedAt?: string | number
  startedAt?: string | number
  heartbeatAt?: string | number
  attempt?: number
  maxAttempts?: number
  createTime?: string | number
  updateTime?: string | number
}

export interface VectorTaskPageParams {
  pageNo: number
  pageSize: number
  taskId?: string
  docId?: number
  kbId?: number
  status?: number
}

// 向量处理任务 API
export const VectorTaskApi = {
  /** 取消任务 */
  cancelTask: async (taskId: string) => {
    return await request.post({ url: `/kb/vector-task/cancel`, params: { taskId } })
  },

  /** 重试失败文档的向量处理 */
  retryTask: async (docId: number) => {
    return await request.post({ url: `/kb/vector-task/retry`, params: { docId } })
  },

  /** 查询任务详情 */
  getTask: async (taskId: string): Promise<VectorTask> => {
    return await request.get({ url: `/kb/vector-task/get`, params: { taskId } })
  },

  /** 查询任务分页 */
  getTaskPage: async (params: VectorTaskPageParams): Promise<{ list: VectorTask[]; total: number }> => {
    return await request.get({ url: `/kb/vector-task/page`, params })
  }
}
