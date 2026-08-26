import request from '@/config/axios'
import { config } from '@/config/axios/config'
import { getAccessToken, getTenantId, getVisitTenantId } from '@/utils/auth'

/** 工具调用/结果（合并为前端归一化结构） */
export interface ToolCall {
  /** 工具调用 ID（QwenPaw data.call_id） */
  callId: string
  /** 工具名 */
  name: string
  /** 调用参数（原始 JSON 字符串） */
  arguments?: string
  /** 调用输出（仅 output 块存在时） */
  output?: string
  /** 状态：running / success / error / ... */
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
  /** 增量文本回调（每条 text delta 触发一次） */
  onMessage: (text: string) => void
  /** 思考过程增量回调（每条 reasoning/thinking delta 触发一次） */
  onReasoning?: (text: string) => void
  /** 工具调用/结果回调（call 触发后 output 也会触发同 callback） */
  onTool?: (tool: ToolCall) => void
  /** Token 用量回调（每个 turn 结束触发） */
  onUsage?: (usage: TokenUsage) => void
  /** 完成回调（流正常结束） */
  onDone?: (payload: {
    content: string
    reasoning?: string
    toolCalls?: ToolCall[]
    tokens?: number
  }) => void
  /** 错误回调 */
  onError?: (message: string) => void
  /**
   * Replay 段结束回调（仅 reconnectStream 触发）
   * QwenPaw task_tracker.attach 会先回放历史 buffer 事件，然后发 type=replay_end 标记。
   * 收到此回调后表示"历史 replay 已完成，接下来是 live 续推"。
   */
  onReplayed?: () => void
  /** 取消信号 */
  signal?: AbortSignal
}

/** QwenPaw 消息原始结构（GET /chats/{id} 返回 ChatHistory.messages[] 元素） */
export interface QwenPawMessage {
  id?: string
  /** 消息类型：message / reasoning / plugin_call / plugin_call_output / system */
  type: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  /**
   * 消息内容数组（不是字符串！）
   * 元素可能是：
   *   - {type: "text", text: "..."}
   *   - {type: "thinking", thinking: "..."}
   *   - {type: "data", data: {call_id, name, arguments}}
   *   - {type: "tool_result", data: {call_id, name, output, state}}
   */
  content: any[] | string
  metadata?: Record<string, any>
}

/** QwenPaw 会话原始结构（GET /chats 返回 ChatSpec；GET /chats/{id} 返回 ChatHistory） */
export interface QwenPawChat {
  id: string
  name?: string
  session_id?: string
  user_id?: string
  agent_id?: string
  channel?: string
  created_at?: string
  updated_at?: string
  meta?: Record<string, any>
  messages?: QwenPawMessage[]
}

/** 前端归一化的消息：与展示层对接 */
export interface ChatMessage {
  id: string
  role: string
  /** 用户输入或助手正文（已把 text 块拼成单字符串） */
  content: string
  /** 思考过程（已把 thinking 块拼成单字符串；QwenPaw 在 history 与 SSE 都用 content 数组中的 thinking 块） */
  reasoningContent?: string
  /** 工具调用数组（JSON 字符串） */
  toolCalls?: string
  tokens?: number
  createTime?: string
  /** Token 用量（仅最近一条助手消息使用） */
  usage?: TokenUsage
  /** 附件（用户消息 content 中的 image/video/audio/file 项） */
  attachments?: ChatAttachment[]
}

/** 对话附件（用户上传的文件） */
export interface ChatAttachment {
  /** 服务端存储路径（上传接口返回的 url，绝对路径） */
  url: string
  /** 原始文件名 */
  name: string
  /** MIME 类型（用于判断 image/video/audio/file） */
  type: string
  /** 文件大小（字节） */
  size?: number
}

/** 把附件列表构造成 QwenPaw 消息 content 项数组（与官网 buildAttachmentContentItems 一致） */
export const buildAttachmentContentItems = (
  attachments: ChatAttachment[]
): Array<Record<string, any>> => {
  const items: Array<Record<string, any>> = []
  for (const a of attachments) {
    if (!a || !a.url) continue
    if (a.type?.startsWith('image/')) {
      items.push({ type: 'image', image_url: a.url })
    } else if (a.type?.startsWith('video/')) {
      items.push({ type: 'video', video_url: a.url })
    } else if (a.type?.startsWith('audio/')) {
      items.push({ type: 'audio', data: a.url })
    } else {
      items.push({ type: 'file', file_url: a.url, file_name: a.name || 'file' })
    }
  }
  return items
}

/** 问答会话 API（透传模式：QwenPaw 是 source of truth） */
export const ChatSessionApi = {
  /** 列出指定智能体下的所有 QwenPaw 会话 */
  listChats: async (agentId: number) => {
    return await request.get<{ data: QwenPawChat[] }>({
      url: '/ai-agent/chat/list-chats',
      params: { agentId }
    })
  },
  /** 在 QwenPaw 预创建一个空会话（用户点"新建对话"时调用） */
  createChat: async (agentId: number, name?: string) => {
    return await request.post<{ data: QwenPawChat }>({
      url: '/ai-agent/chat/create-chat',
      params: { agentId, name }
    })
  },
  /** 获取 QwenPaw 会话详情（含完整 messages 数组） */
  getChat: async (agentId: number, chatId: string) => {
    return await request.get<{ data: QwenPawChat }>({
      url: '/ai-agent/chat/get-chat',
      params: { agentId, chatId }
    })
  },
  /** 删除 QwenPaw 会话 */
  deleteChat: async (agentId: number, chatId: string) => {
    return await request.delete({
      url: '/ai-agent/chat/delete-chat',
      params: { agentId, chatId }
    })
  },
  /** 重命名 QwenPaw 会话 */
  renameChat: async (agentId: number, chatId: string, name: string) => {
    return await request.put<{ data: QwenPawChat }>({
      url: '/ai-agent/chat/rename-chat',
      params: { agentId, chatId, name }
    })
  },
  /** 发送消息（SSE 流式对话，透传 QwenPaw） */
  sendMessageStream: async (
    agentId: number,
    chatId: string | undefined,
    sessionId: string | undefined,
    message: string,
    options: SendMessageStreamOptions,
    attachments?: ChatAttachment[]
  ): Promise<void> => {
    const headers = buildAuthHeaders()
    const params: Record<string, string> = { agentId: String(agentId), message }
    if (chatId) params.chatId = chatId
    if (sessionId) params.sessionId = sessionId
    const qs = new URLSearchParams(params).toString()
    const url = config.base_url + '/ai-agent/chat/send-stream?' + qs
    // 附件：content 数组（JSON）随请求体发给 Java，由其透传 QwenPaw。
    // 与 QwenPaw 官方前端一致：文本作为 text 块放 content 首位，附件块在后。
    // 原因：QwenPaw 端对"无文本"消息会走 no-text debounce 缓冲（SSE 空流、表现为无响应）；
    // 若文本只放 body.message 而 content 仅含附件块，Java 转发 content 数组时会丢失文本。
    const payload: Record<string, any> = { message }
    if (attachments && attachments.length) {
      payload.content = [
        { type: 'text', text: message },
        ...buildAttachmentContentItems(attachments)
      ]
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal
    })
    const contentType = resp.headers.get('content-type') || ''
    if (!resp.ok || !contentType.includes('text/event-stream')) {
      options.onError?.(await extractErrorMessage(resp, '请求失败'))
      return
    }
    return consumeSseStream(resp, options, false)
  },
  /**
   * 重新挂载到 QwenPaw 正在运行的流（页面切回时使用）
   * QwenPaw 内部 task_tracker.attach 会先回放历史 buffer（带 type=replay_end 标记），
   * 再放后续 live 增量。本方法在解析时跳过 replay 段的事件（避免与 getChat 拉到的 history 重复），
   * 收到 replay_end 之后才走 live 段的 += 累加。
   */
  reconnectStream: async (agentId: number, chatId: string, sessionId: string, options: SendMessageStreamOptions): Promise<void> => {
    const headers = buildAuthHeaders()
    const params: Record<string, string> = { agentId: String(agentId), chatId }
    if (sessionId) params.sessionId = sessionId
    const url =
      config.base_url +
      '/ai-agent/chat/reconnect-stream?' +
      new URLSearchParams(params).toString()
    const resp = await fetch(url, { method: 'GET', headers, signal: options.signal })
    const contentType = resp.headers.get('content-type') || ''
    if (!resp.ok || !contentType.includes('text/event-stream')) {
      options.onError?.(await extractErrorMessage(resp, '请求失败'))
      return
    }
    return consumeSseStream(resp, options, true)
  },
  /** 停止当前对话（转发 QwenPaw chat/stop） */
  stopStream: async (agentId: number, chatId: string) => {
    return await request.post<{ data: { stopped: boolean } }>({
      url: '/ai-agent/chat/stop-stream',
      params: { agentId, chatId }
    })
  },
  /** 列出所有 Provider（含其下模型列表），供模型选择器使用 */
  listModels: async (agentId: number) => {
    return await request.get<{ data: Array<Record<string, any>> }>({
      url: '/ai-agent/chat/models',
      params: { agentId }
    })
  },
  /** 获取智能体当前激活模型（scope=agent） */
  getActiveModel: async (agentId: number) => {
    return await request.get<{ data: Record<string, any> }>({
      url: '/ai-agent/chat/active-model',
      params: { agentId }
    })
  },
  /** 切换智能体激活模型（scope=agent，持久化到 QwenPaw） */
  setActiveModel: async (agentId: number, providerId: string, model: string) => {
    return await request.put<{ data: Record<string, any> }>({
      url: '/ai-agent/chat/active-model',
      params: { agentId, providerId, model }
    })
  },
  /** 上传文件到智能体（对话附件，QwenPaw 保存到 console media_dir） */
  uploadFile: async (agentId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return await request.upload<{ data: { url: string; file_name: string; size: number } }>({
      url: '/ai-agent/chat/upload',
      params: { agentId },
      data: formData
    })
  },
  /** 获取聊天文件预览的 Blob 对象 URL（带鉴权 fetch，供 <img> 等渲染） */
  loadFilePreviewUrl: async (agentId: number, path: string): Promise<string> => {
    const headers = buildAuthHeaders()
    const url =
      config.base_url +
      '/ai-agent/chat/file-preview?agentId=' +
      agentId +
      '&path=' +
      encodeURIComponent(path)
    const resp = await fetch(url, { method: 'GET', headers })
    if (!resp.ok) {
      throw new Error('加载文件失败（' + resp.status + '）')
    }
    const blob = await resp.blob()
    return URL.createObjectURL(blob)
  },
  /** 构造文件预览 URL（原始地址，供下载链接使用；图片渲染请用 loadFilePreviewUrl） */
  buildFilePreviewUrl: (agentId: number, path: string): string => {
    return (
      config.base_url +
      '/ai-agent/chat/file-preview?agentId=' +
      agentId +
      '&path=' +
      encodeURIComponent(path)
    )
  }
}

/** ============ 工具函数 ============ */

/** 把 QwenPaw Message.content 数组归一化为前端 ChatMessage */
export const normalizeQwenPawMessage = (raw: any): ChatMessage => {
  const role = String(raw?.role || 'assistant')
  const type = String(raw?.type || '')
  // content 可能是 string、数组、对象，统一压成 array
  let parts: any[] = []
  const c = raw?.content
  if (typeof c === 'string') {
    parts = [{ type: 'text', text: c }]
  } else if (Array.isArray(c)) {
    parts = c
  } else if (c && typeof c === 'object') {
    parts = [c]
  }
  // text 块 -> content（过滤 QwenPaw 自动注入的"文件已下载"提示，官方前端同样不展示）
  const isDownloadHint = (t: string) =>
    t.startsWith('用户上传文件，已经下载到') || t.startsWith('User uploaded a file, downloaded to')
  let content = parts
    .filter((p) => p && (p.type === 'text' || p.text != null) && !isDownloadHint(String(p.text || '')))
    .map((p) => String(p.text || ''))
    .join('')
  // thinking 块 -> reasoning（QwenPaw 历史与 SSE 都用 thinking 块）
  let reasoning = parts
    .filter((p) => p && (p.type === 'thinking' || p.type === 'reasoning' || p.thinking != null))
    .map((p) => String(p.thinking || p.text || ''))
    .join('')
  // tool call / output 块 -> 工具调用列表
  const tools: ToolCall[] = []
  for (const p of parts) {
    if (!p) continue
    if (p.type === 'data' || p.type === 'tool_call' || p.type === 'tool_use') {
      const d = p.data || p
      if (d && (d.call_id || d.name)) {
        tools.push({
          callId: d.call_id || d.id || '',
          name: d.name || '',
          arguments: typeof d.arguments === 'string' ? d.arguments : d.arguments != null ? JSON.stringify(d.arguments) : undefined,
          output: d.output,
          state: d.state
        })
      }
    } else if (p.type === 'tool_result' || p.type === 'tool_call_output') {
      const d = p.data || p
      if (d && (d.call_id || d.name)) {
        tools.push({
          callId: d.call_id || d.id || '',
          name: d.name || '',
          arguments: typeof d.arguments === 'string' ? d.arguments : undefined,
          output: d.output,
          state: d.state
        })
      }
    }
  }
  // QwenPaw 也会把整个 message 拆成 message/reasoning/plugin_call 几条（按 type 区分）
  // 对拆分类型的 message 做字段冗余：reasoning 类型应把 content 整段当作思考
  if (type === 'reasoning' && !reasoning && content) {
    reasoning = content
    content = ''
  }
  if (type === 'plugin_call' || type === 'function_call' || type === 'mcp_tool_call') {
    if (!tools.length && raw?.metadata) {
      // 兜底：metadata 中可能含 call 信息
      const md = raw.metadata
      if (md.call_id || md.name) {
        tools.push({
          callId: md.call_id,
          name: md.name,
          arguments: typeof md.arguments === 'string' ? md.arguments : md.arguments != null ? JSON.stringify(md.arguments) : undefined
        })
      }
    }
    if (!content && !tools.length) content = ''
  }
  if (type === 'plugin_call_output' || type === 'function_call_output' || type === 'mcp_tool_call_output') {
    if (!tools.length && raw?.metadata) {
      const md = raw.metadata
      if (md.call_id || md.name) {
        tools.push({
          callId: md.call_id,
          name: md.name,
          output: typeof md.output === 'string' ? md.output : md.output != null ? JSON.stringify(md.output) : undefined,
          state: md.state
        })
      }
    }
  }
  // tokens：metadata.tokens 或 顶层 tokens
  const tokens = (raw?.metadata?.tokens as number | undefined) ?? (raw?.tokens as number | undefined) ?? 0
  // 附件：content 中的 image/video/audio/file 项（用户上传的文件）
  const attachments: ChatAttachment[] = []
  const basename = (v: any): string => {
    if (!v) return ''
    const s = String(v).split(/[\\/]/).pop() || ''
    return s
  }
  /** 清洗 QwenPaw 临时文件名：{32位UUID}_源文件名 -> 源文件名 */
  const cleanFileName = (n: string): string => n.replace(/^[0-9a-f]{32}_/i, '')
  for (const p of parts) {
    if (!p) continue
    if (p.type === 'image' && p.image_url) {
      attachments.push({ url: p.image_url, name: cleanFileName(basename(p.image_url)), type: 'image' })
    } else if (p.type === 'video' && p.video_url) {
      attachments.push({ url: p.video_url, name: cleanFileName(basename(p.video_url)), type: 'video' })
    } else if (p.type === 'audio' && p.data) {
      attachments.push({ url: p.data, name: cleanFileName(basename(p.data)), type: 'audio' })
    } else if (p.type === 'file' && p.file_url) {
      attachments.push({ url: p.file_url, name: cleanFileName(p.file_name || basename(p.file_url)), type: 'file' })
    }
  }
  return {
    id: raw?.id || raw?.msg_id || '',
    role,
    content,
    reasoningContent: reasoning || undefined,
    toolCalls: tools.length ? JSON.stringify(tools) : undefined,
    tokens,
    createTime: raw?.metadata?.created_at || raw?.createTime || '',
    attachments: attachments.length ? attachments : undefined
  }
}

const buildAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {}
  const token = getAccessToken()
  if (token) headers.Authorization = 'Bearer ' + token
  const tenantEnable = import.meta.env.VITE_APP_TENANT_ENABLE
  if (tenantEnable && tenantEnable === 'true') {
    const tenantId = getTenantId()
    if (tenantId) headers['tenant-id'] = tenantId
    const visitTenantId = getVisitTenantId()
    if (token && visitTenantId) headers['visit-tenant-id'] = visitTenantId
  }
  return headers
}

const extractErrorMessage = async (resp: Response, fallback: string): Promise<string> => {
  let msg = fallback + '（' + resp.status + '）'
  try {
    const errData = await resp.json()
    if (errData && errData.msg) msg = errData.msg
  } catch {}
  return msg
}

/**
 * 解析 SSE 流并按 replay 段 / live 段分发事件（sendMessageStream / reconnectStream 共用）
 *
 * <p>QwenPaw SSE 事件类型（与 Event 模型对齐，extra="allow" 允许扩展）：
 * <ul>
 *   <li><b>content delta</b>：{@code {object:"content", type:"text"|"thinking", delta:true, msg_id, text/thinking, index, call_id?, chunk?}} 文本/思考增量</li>
 *   <li><b>content done</b>：{@code {object:"content", type:"text"|"thinking"|"data", delta:false, ...}} 完整 part</li>
 *   <li><b>message start/done</b>：{@code {object:"message", type:"message"|"reasoning"|"plugin_call"|"plugin_call_output", id, ...}}</li>
 *   <li><b>response completed</b>：{@code {object:"response", status:"completed", ...}} 结束信号</li>
 *   <li><b>turn usage</b>：{@code {object:"turn_usage", usage:{...}, context_usage:{...}}}</li>
 *   <li><b>error</b>：{@code {object:"error", message}}</li>
 *   <li><b>replay_end</b>：仅 reconnectStream 出现，表示历史 replay 已完成</li>
 * </ul>
 *
 * @param isReconnect true 时跳过 replay 段（避免与 history 重复）
 */
const consumeSseStream = async (
  resp: Response,
  options: SendMessageStreamOptions,
  isReconnect: boolean
): Promise<void> => {
  const reader = resp.body!.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullContent = ''
  let fullReasoning = ''
  let replayDone = !isReconnect // 普通 send 流直接按 live 处理
  let firstEventAt = 0
  let usageEmitted: TokenUsage | undefined
  // 按 msgId 跟踪 message 类型（message / reasoning / plugin_call / plugin_call_output）
  const msgIdToType = new Map<string, string>()
  // 按 msgId 缓存"早到的 content delta"（type 还没来时）
  const msgIdToTextBuf = new Map<string, string>()
  const msgIdToReasoningBuf = new Map<string, string>()
  // 工具调用按 callId 累积
  const toolByCallId = new Map<string, ToolCall>()

  const dispatch = (event: any) => {
    if (!event || typeof event !== 'object') return
    const object = event.object
    const type = event.type

    // 错误事件
    if (object === 'error' || type === 'error' || (event as any).status === 'failed') {
      options.onError?.(event.message || (event as any).msg || '流异常中断')
      return
    }

    // 消息信封（先到，登记 type）
    if (object === 'message') {
      if (event.id) {
        msgIdToType.set(event.id, String(type || 'message'))
      }
      return
    }

    // 内容增量
    if (object === 'content') {
      const msgId: string | undefined = event.msg_id
      const partType: string = String(type || 'text')
      const knownType = msgId ? msgIdToType.get(msgId) : undefined
      if (partType === 'text' && typeof event.text === 'string' && event.text.length > 0) {
        // 是否目标到 reasoning？根据 knownType 决定去向
        const targetReasoning = knownType === 'reasoning'
        if (isReconnect) return // replay 段忽略
        if (targetReasoning) {
          options.onReasoning?.(event.text)
          fullReasoning += event.text
        } else {
          options.onMessage?.(event.text)
          fullContent += event.text
        }
        return
      }
      if (partType === 'thinking' && typeof event.thinking === 'string' && event.thinking.length > 0) {
        if (isReconnect) return
        options.onReasoning?.(event.thinking)
        fullReasoning += event.thinking
        return
      }
      // data 块：工具调用/结果
      if (partType === 'data' || partType === 'tool_result' || partType === 'tool_use') {
        if (isReconnect) return
        const data = event.data || event
        if (data && (data.call_id || data.name)) {
          const callId = data.call_id || data.id || ''
          const existing = toolByCallId.get(callId) || { callId, name: '' }
          const next: ToolCall = {
            callId,
            name: data.name || existing.name,
            arguments:
              data.arguments != null
                ? typeof data.arguments === 'string'
                  ? data.arguments
                  : JSON.stringify(data.arguments)
                : existing.arguments,
            output: data.output != null ? (typeof data.output === 'string' ? data.output : JSON.stringify(data.output)) : existing.output,
            state: data.state || existing.state
          }
          toolByCallId.set(callId, next)
          options.onTool?.(next)
        }
        return
      }
      return
    }

    // 响应状态
    if (object === 'response') {
      if (event.status === 'completed') {
        options.onDone?.({
          content: fullContent,
          reasoning: fullReasoning,
          toolCalls: Array.from(toolByCallId.values()),
          tokens: usageEmitted?.totalTokens
        })
      } else if (event.status === 'reconnect_completed') {
        // reconnect 流无后续；不触发 onDone 避免误清空 UI
      }
      return
    }

    // token 用量
    if (type === 'turn_usage' || object === 'turn_usage') {
      const u = event.usage
      if (u) {
        usageEmitted = {
          providerId: u.provider_id || '',
          modelName: u.model_name || '',
          promptTokens: u.prompt_tokens || 0,
          completionTokens: u.completion_tokens || 0,
          totalTokens: u.total_tokens || 0,
          contextSize: u.context_size || 0,
          contextUsageRatio: event.context_usage?.context_usage_ratio || 0
        }
        options.onUsage?.(usageEmitted)
      }
      return
    }
  }

  const tryHandleLine = (line: string) => {
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data) return
    if (data === '[DONE]') return
    let event: any
    try {
      event = JSON.parse(data)
    } catch {
      return
    }
    if (isReconnect && !replayDone) {
      if (event.type === 'replay_end') {
        replayDone = true
        options.onReplayed?.()
        return
      }
      // replay 段：只允许"非业务"事件通过（如 replay 标记/系统事件），业务事件全部吞掉
      if (
        event.object === 'message' ||
        event.object === 'content' ||
        event.object === 'turn_usage'
      ) {
        // 3 秒兜底：旧版本 QwenPaw 无 replay_end 时
        if (firstEventAt && Date.now() - firstEventAt > 3000) {
          replayDone = true
          options.onReplayed?.()
          dispatch(event)
        }
        return
      }
    }
    dispatch(event)
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    if (!firstEventAt) firstEventAt = Date.now()
    let sepIndex
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)
      for (const line of rawEvent.split('\n')) tryHandleLine(line)
    }
  }
  // 收尾处理剩余 buffer
  if (buffer.trim()) {
    for (const line of buffer.trim().split('\n')) tryHandleLine(line)
  }
}
