import request from '@/config/axios'
import { config } from '@/config/axios/config'
import { getAccessToken, getTenantId, getVisitTenantId } from '@/utils/auth'

/** 工具调用/结果 */
export interface ToolCall {
  type: 'tool_call' | 'tool_output'
  callId: string
  name: string
  arguments?: string
  output?: string
  state?: string
}

/** Token 用量 */
export interface TokenUsage {
  providerId: string
  modelName: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  contextSize: number
  contextUsageRatio: number
}

/** SSE 流式对话选项 */
export interface SendMessageStreamOptions {
  /** 增量文本回调 */
  onMessage: (text: string) => void
  /** 思考过程增量回调 */
  onReasoning?: (text: string) => void
  /** 工具调用/结果回调 */
  onTool?: (tool: ToolCall) => void
  /** Token 用量回调 */
  onUsage?: (usage: TokenUsage) => void
  /** 完成回调（完整回答 + QwenPaw sessionId） */
  onDone?: (payload: {
    content: string
    reasoning?: string
    toolCalls?: ToolCall[]
    tokens?: number
    sessionId?: string
  }) => void
  /** 错误回调 */
  onError?: (message: string) => void
  /** 取消信号 */
  signal?: AbortSignal
}

/** 问答会话 */
export interface ChatSession {
  id: number
  agentId: number
  userId?: number
  sessionKey?: string
  title?: string
  status?: number
  createTime?: string
  /** 冗余展示字段 */
  agentName?: string
}

/** 问答消息 */
export interface ChatMessage {
  id: number
  sessionId: number
  agentId: number
  userId?: number
  role: string
  content: string
  reasoningContent?: string
  toolCalls?: string
  tokens?: number
  createTime?: string
}

/** 发送消息请求 */
export interface ChatSendReqVO {
  message: string
}

/** 发送消息响应 */
export interface ChatSendRespVO {
  sessionId: number
  content: string
}

/** 问答会话 API */
export const ChatSessionApi = {
  // 创建会话
  createSession: async (data: { agentId: number; userId?: number; title?: string }) => {
    return await request.post({ url: '/ai-agent/chat-session/create', data })
  },
  // 获得会话详情
  getSession: async (id: number) => {
    return await request.get({ url: '/ai-agent/chat-session/get?id=' + id })
  },
  // 获得会话分页
  getSessionPage: async (params: any) => {
    return await request.get({ url: '/ai-agent/chat-session/page', params })
  },
  // 关闭会话
  closeSession: async (id: number) => {
    return await request.put({ url: '/ai-agent/chat-session/close?id=' + id })
  },
  // 重命名会话
  renameSession: async (id: number, title: string) => {
    return await request.put({ url: '/ai-agent/chat-session/rename', data: { id, title } })
  },
  // 清空会话消息（同时重置 QwenPaw 侧会话上下文）
  clearMessages: async (id: number) => {
    return await request.delete({ url: '/ai-agent/chat-session/clear-messages?id=' + id })
  },
  // 删除会话
  deleteSession: async (id: number) => {
    return await request.delete({ url: '/ai-agent/chat-session/delete?id=' + id })
  },
  // 发送消息（同步对话）
  sendMessage: async (sessionId: number, data: ChatSendReqVO) => {
    return await request.post({ url: '/ai-agent/chat-session/send?sessionId=' + sessionId, data })
  },
  // 发送消息（SSE 流式对话）：axios 不支持流式，故用 fetch + ReadableStream 逐块解析
  sendMessageStream: async (
    sessionId: number,
    data: ChatSendReqVO,
    options: SendMessageStreamOptions
  ): Promise<void> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    const token = getAccessToken()
    if (token) {
      headers.Authorization = 'Bearer ' + token
    }
    // 与 service.ts 拦截器保持一致的租户头
    const tenantEnable = import.meta.env.VITE_APP_TENANT_ENABLE
    if (tenantEnable && tenantEnable === 'true') {
      const tenantId = getTenantId()
      if (tenantId) headers['tenant-id'] = tenantId
      const visitTenantId = getVisitTenantId()
      if (token && visitTenantId) headers['visit-tenant-id'] = visitTenantId
    }
    const url = config.base_url + '/ai-agent/chat-session/send-stream?sessionId=' + sessionId
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: options.signal
    })
    // 非 2xx 或非 SSE 响应（如参数校验失败返回 CommonResult JSON）
    const contentType = resp.headers.get('content-type') || ''
    if (!resp.ok || !contentType.includes('text/event-stream')) {
      let errMsg = '请求失败（' + resp.status + '）'
      try {
        const errData = await resp.json()
        errMsg = errData.msg || errMsg
      } catch {}
      options.onError?.(errMsg)
      return
    }
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let fullContent = ''
    let fullReasoning = ''
    
    // 消息类型追踪（用于关联 content 到正确的 message）
    const msgIdToType = new Map<string, string>()
    const msgIdToBuffer = new Map<string, string>()
    
    const handleSseEvent = (raw: string) => {
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('data:')) {
          data += line.slice(5).trim()
        }
      }
      
      if (!data) return
      
      try {
        const event = JSON.parse(data)
        const object = event.object
        
        // 1. message 信封：确定消息类型
        if (object === 'message') {
          const msgType = event.type
          const msgId = event.id
          
          if (msgId) {
            msgIdToType.set(msgId, msgType)
            
            // 刷新缓冲
            const buffered = msgIdToBuffer.get(msgId)
            if (buffered) {
              if (msgType === 'reasoning') {
                options.onReasoning?.(buffered)
                fullReasoning += buffered
              } else if (msgType === 'message') {
                options.onMessage?.(buffered)
                fullContent += buffered
              }
              msgIdToBuffer.delete(msgId)
            }
            
            // 工具调用/结果
            if (msgType === 'plugin_call' || msgType === 'plugin_call_output' ||
                msgType === 'function_call' || msgType === 'function_call_output' ||
                msgType === 'mcp_tool_call' || msgType === 'mcp_tool_call_output') {
              const content = event.content
              if (content && Array.isArray(content) && content.length > 0) {
                const dataContent = content.find((c: any) => c.type === 'data')
                if (dataContent && dataContent.data) {
                  const tool: ToolCall = {
                    type: msgType.endsWith('_output') ? 'tool_output' : 'tool_call',
                    callId: dataContent.data.call_id || '',
                    name: dataContent.data.name || '',
                    arguments: dataContent.data.arguments,
                    output: dataContent.data.output,
                    state: dataContent.data.state
                  }
                  options.onTool?.(tool)
                }
              }
            }
          }
          return
        }
        
        // 2. content 增量块
        if (object === 'content') {
          const type = event.type
          const msgId = event.msg_id
          
          // 文本内容
          if (type === 'text' && event.text) {
            if (msgId) {
              const knownType = msgIdToType.get(msgId)
              if (knownType) {
                // 已知类型，直接分发
                if (knownType === 'reasoning') {
                  options.onReasoning?.(event.text)
                  fullReasoning += event.text
                } else if (knownType === 'message') {
                  options.onMessage?.(event.text)
                  fullContent += event.text
                }
              } else {
                // 未知类型，先缓冲
                const existing = msgIdToBuffer.get(msgId) || ''
                msgIdToBuffer.set(msgId, existing + event.text)
              }
            } else {
              // 无 msgId，视为回答正文
              options.onMessage?.(event.text)
              fullContent += event.text
            }
          }
          
          // 工具调用数据
          if (type === 'data' && event.data && msgId) {
            const knownType = msgIdToType.get(msgId)
            if (knownType && (knownType.endsWith('_output') || knownType === 'plugin_call' || 
                knownType === 'function_call' || knownType === 'mcp_tool_call')) {
              const tool: ToolCall = {
                type: knownType.endsWith('_output') ? 'tool_output' : 'tool_call',
                callId: event.data.call_id || '',
                name: event.data.name || '',
                arguments: event.data.arguments,
                output: event.data.output,
                state: event.data.state
              }
              options.onTool?.(tool)
            }
          }
          return
        }
        
        // 3. turn_usage 用量事件
        if (event.type === 'turn_usage' && event.usage) {
          const usage: TokenUsage = {
            providerId: event.usage.provider_id || '',
            modelName: event.usage.model_name || '',
            promptTokens: event.usage.prompt_tokens || 0,
            completionTokens: event.usage.completion_tokens || 0,
            totalTokens: event.usage.total_tokens || 0,
            contextSize: event.usage.context_size || 0,
            contextUsageRatio: event.context_usage?.context_usage_ratio || 0
          }
          options.onUsage?.(usage)
          return
        }
        
        // 4. done 事件
        if (event.status === 'completed') {
          options.onDone?.({
            content: fullContent,
            reasoning: fullReasoning
          })
        }
      } catch (e) {
        // 解析失败，忽略
      }
    }
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      // SSE 事件块以空行分隔
      let sepIndex
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)
        handleSseEvent(rawEvent)
      }
    }
    // 处理末尾残留（无空行结尾）
    if (buffer.trim()) {
      handleSseEvent(buffer.trim())
    }
  },
  // 获得会话历史消息
  getMessageList: async (sessionId: number) => {
    return await request.get({ url: '/ai-agent/chat-session/message-list?sessionId=' + sessionId })
  },
  // 停止当前会话正在进行的对话（转发 QwenPaw chat/stop）
  stopStream: async (sessionId: number) => {
    return await request.post({ url: '/ai-agent/chat-session/stop-stream?sessionId=' + sessionId })
  },
  // 获得消息分页
  getMessagePage: async (params: any) => {
    return await request.get({ url: '/ai-agent/chat-session/message-page', params })
  }
}
