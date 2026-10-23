import request from '@/config/axios'

/** 队列指标 */
export interface QueueMetrics {
  name: string
  depth: number
  consumers: number
}

/** Worker 指标 */
export interface WorkerMetrics {
  workerId: string
  host?: string
  port?: number
  status: 'ONLINE' | 'OFFLINE' | string
  /** 指标来源：HTTP（/metrics）/ REDIS（HTTP 不可达时的快照兜底） */
  source?: 'HTTP' | 'REDIS' | string
  lastHeartbeat?: string | number
  concurrency?: number
  inflight?: number
  completed?: number
  failed?: number
  cancelled?: number
  avgTaskSeconds?: number
  embeddingRequests?: number
  embeddingErrors?: number
  error?: string
}

/** 任务统计 */
export interface TaskStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  submitFailed: number
  timeout: number
  cancelled: number
  avgDurationSeconds: number
  timeoutRate24h: number
  oldestPendingMinutes: number
}

/** 监控告警 */
export interface MonitorAlert {
  level: 'INFO' | 'WARN' | 'CRITICAL' | string
  code: string
  message: string
}

/** 监控概览 */
export interface MonitorOverview {
  workerCount: number
  onlineWorkerCount: number
  workers: WorkerMetrics[]
  queue: QueueMetrics
  tasks: TaskStats
  alerts: MonitorAlert[]
  collectedAt?: string | number
}

export const MonitorApi = {
  /** 获取处理监控概览 */
  getOverview: async (): Promise<MonitorOverview> => {
    return await request.get({ url: `/kb/monitor/overview` })
  }
}
