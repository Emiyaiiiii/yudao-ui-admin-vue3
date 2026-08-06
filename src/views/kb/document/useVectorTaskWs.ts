import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { getRefreshToken } from '@/utils/auth'
import type { VectorTaskWsMessage } from '@/api/kb/vectorTask'

/**
 * 向量任务 WebSocket 监听 composable
 *
 * 连接系统 WebSocket，监听 vector-task-status 消息，
 * 维护一个 taskId → 状态信息 的响应式 Map，供文档列表页实时更新进度。
 */

/** 全局单例：所有使用此 composable 的组件共享同一个 WebSocket 连接和状态 */
const ws = ref<WebSocket | null>(null)
const connected = ref(false)
/** taskId → 向量任务状态信息 */
const taskStatusMap = reactive<Map<string, VectorTaskWsMessage>>(new Map())
/** 状态映射：Python 端字符串 → Java 端数字 */
const statusStringToNumber: Record<string, number> = {
  PENDING: 0,
  PROCESSING: 1,
  COMPLETED: 2,
  FAILED: 3,
  SUBMIT_FAILED: 4,
  TIMEOUT: 5,
  CANCELLED: 6
}
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let refCount = 0 // 引用计数，最后一个组件卸载时才断开连接

/** 构建 WebSocket URL */
function buildWsUrl(): string {
  const baseUrl = import.meta.env.VITE_BASE_URL || import.meta.env.VITE_API_URL || ''
  const wsBase = baseUrl.replace('http', 'ws')
  return `${wsBase}/infra/ws`
}

/** 连接 WebSocket */
function connect() {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) return

  const token = getRefreshToken()
  if (!token) return

  const url = `${buildWsUrl()}?token=${token}`
  const socket = new WebSocket(url)

  socket.onopen = () => {
    connected.value = true
    // 心跳：每 30 秒发送 ping
    heartbeatTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send('ping')
      }
    }, 30000)
  }

  socket.onmessage = (event: MessageEvent) => {
    if (event.data === 'pong') return
    try {
      const frame = JSON.parse(event.data)
      if (frame.type === 'vector-task-status') {
        const content: VectorTaskWsMessage =
          typeof frame.content === 'string' ? JSON.parse(frame.content) : frame.content
        // 存入响应式 Map
        taskStatusMap.set(content.taskId, content)
      }
    } catch {
      // 忽略非 JSON 消息
    }
  }

  socket.onclose = () => {
    ws.value = null
    connected.value = false
    clearHeartbeat()
    // 指数退避重连
    scheduleReconnect()
  }

  socket.onerror = () => {
    socket.close()
  }

  ws.value = socket
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  const delay = Math.min(1000 + Math.random() * 2000, 30000)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (refCount > 0) {
      connect()
    }
  }, delay)
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  clearHeartbeat()
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
  connected.value = false
}

/**
 * 向量任务 WebSocket composable
 *
 * @example
 * ```ts
 * const { taskStatusMap, getTaskStatus } = useVectorTaskWs()
 * // 获取某个任务的最新状态
 * const status = getTaskStatus('some-task-id')
 * ```
 */
export function useVectorTaskWs() {
  refCount++

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    refCount--
    if (refCount <= 0) {
      disconnect()
    }
  })

  /** 获取指定任务的最新状态 */
  function getTaskStatus(taskId: string | undefined): VectorTaskWsMessage | undefined {
    if (!taskId) return undefined
    return taskStatusMap.get(taskId)
  }

  /** 将 WebSocket 字符串状态转换为数字状态 */
  function resolveVectorStatus(
    docVectorStatus: number | undefined,
    taskId: string | undefined
  ): number | undefined {
    const wsMsg = getTaskStatus(taskId)
    if (wsMsg) {
      const numStatus = statusStringToNumber[wsMsg.status]
      if (numStatus !== undefined) return numStatus
    }
    return docVectorStatus
  }

  /** 获取进度（来自 WebSocket 消息） */
  function getProgress(taskId: string | undefined): number | undefined {
    const wsMsg = getTaskStatus(taskId)
    return wsMsg?.progress
  }

  /** 获取当前步骤（来自 WebSocket 消息） */
  function getStep(taskId: string | undefined): string | undefined {
    const wsMsg = getTaskStatus(taskId)
    return wsMsg?.step
  }

  /** 清除指定任务的状态缓存 */
  function clearTaskStatus(taskId: string) {
    taskStatusMap.delete(taskId)
  }

  return {
    connected,
    taskStatusMap,
    getTaskStatus,
    resolveVectorStatus,
    getProgress,
    getStep,
    clearTaskStatus
  }
}
