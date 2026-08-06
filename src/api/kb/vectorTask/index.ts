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

/** WebSocket 推送的向量任务状态消息 */
export interface VectorTaskWsMessage {
  taskId: string
  status: string // 字符串: PENDING, PROCESSING, COMPLETED, FAILED
  progress: number
  step: string
  chunkCount: number
  errorMsg: string
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
  getTask: async (taskId: string) => {
    return await request.get({ url: `/kb/vector-task/get`, params: { taskId } })
  },

  /** 查询任务分页 */
  getTaskPage: async (params: any) => {
    return await request.get({ url: `/kb/vector-task/page`, params })
  }
}
