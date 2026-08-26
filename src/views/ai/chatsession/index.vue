<template>
  <ContentWrap>
    <!-- 顶部工具条：先选智能体，再看会话 -->
    <div class="chat-toolbar">
      <el-select
        v-model="agentId"
        placeholder="请先选择智能体（业务规范：必须先选智能体）"
        class="!w-280px"
        @change="handleAgentChange"
      >
        <el-option v-for="item in agents" :key="item.id" :label="item.name" :value="item.id">
          <div class="select-option-item">
            <span>{{ item.name }}</span>
            <el-tag v-if="item.enableKbTool" size="small" type="success">知识库</el-tag>
          </div>
        </el-option>
      </el-select>
      <!-- 模型切换（scope=agent，持久化到 QwenPaw） -->
      <el-select
        v-if="agentId"
        v-model="activeModelKey"
        placeholder="切换模型"
        class="!w-220px"
        :loading="modelLoading"
        @change="handleModelChange"
      >
        <el-option-group
          v-for="provider in modelOptions"
          :key="provider.providerId"
          :label="provider.providerName"
        >
          <el-option
            v-for="m in provider.models"
            :key="provider.providerId + ':' + m.id"
            :label="provider.providerName + ' / ' + m.label"
            :value="provider.providerId + ':' + m.id"
          />
        </el-option-group>
      </el-select>
      <el-input
        v-model="search"
        placeholder="搜索会话标题"
        clearable
        class="!w-200px"
        :disabled="!agentId"
        @keyup.enter="loadChats"
        @clear="loadChats"
      />
      <el-button :disabled="!agentId" @click="loadChats">
        <Icon icon="ep:search" class="mr-5px" /> 搜索
      </el-button>
      <el-button
        type="primary"
        :disabled="!agentId"
        @click="handleNewChat"
        v-hasPermi="['ai-agent:chat-session:create']"
      >
        <Icon icon="ep:plus" class="mr-5px" /> 新建对话
      </el-button>
    </div>

    <!-- 主体：左会话列表 + 右对话 -->
    <div class="chat-layout">
      <!-- 左侧会话列表 -->
      <div class="session-panel">
        <div class="flex-1 overflow-y-auto">
          <template v-if="!agentId">
            <el-empty description="请先选择智能体" :image-size="60" />
          </template>
          <template v-else>
            <div
              v-for="item in chatList"
              :key="item.id"
              class="p-10px cursor-pointer border-bottom-1px border-solid border-[var(--el-border-color-lighter)]"
              :class="
                currentChatId === item.id
                  ? 'bg-[var(--el-color-primary-light-9)]'
                  : 'hover:bg-[var(--el-fill-color-light)]'
              "
              @click="handleSelectChat(item)"
            >
              <div class="flex justify-between items-center">
                <span class="text-14px font-500 text-truncate flex-1">
                  {{ item.name || '未命名会话' }}
                </span>
                <div class="session-actions" @click.stop>
                  <el-tooltip content="重命名" placement="top">
                    <el-button
                      link
                      type="primary"
                      size="small"
                      @click="handleRenameChat(item)"
                      v-hasPermi="['ai-agent:chat-session:update']"
                    >
                      <Icon icon="ep:edit" />
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="删除会话" placement="top">
                    <el-button
                      link
                      type="danger"
                      size="small"
                      @click="handleDeleteChat(item)"
                      v-hasPermi="['ai-agent:chat-session:delete']"
                    >
                      <Icon icon="ep:delete" />
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
              <div class="flex justify-between mt-4px">
                <span class="text-12px text-gray-400">{{ item.channel || 'web' }}</span>
                <span class="text-12px text-gray-400">{{ formatDate(item.created_at) }}</span>
              </div>
            </div>
            <el-empty v-if="chatList.length === 0" description="该智能体暂无会话" :image-size="60" />
          </template>
        </div>
      </div>

      <!-- 右侧聊天区 -->
      <div class="chat-panel">
        <div ref="messageBoxRef" class="chat-message-box">
          <template v-if="!agentId">
            <el-empty description="请先选择智能体" :image-size="60" />
          </template>
          <!-- 草稿态（无会话）但有消息（首条消息流式返回中）时也要渲染消息列表，
               否则新建对话发首条消息时流式内容不会展示，只能等结束后选中会话才一次性显示 -->
          <template v-else-if="!currentChatId && messages.length === 0">
            <el-empty description="请输入问题开始新对话" :image-size="60" />
          </template>
          <template v-else>
            <div
              v-for="(msg, index) in messages"
              :key="index"
              class="message-row"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="message-content-wrap"
                :class="msg.role === 'user' ? 'user-bubble-wrap' : 'assistant-bubble-wrap'"
              >
                <div v-if="msg.role === 'user'" class="message-bubble user-bubble">
                  <MessageAttachments
                    v-if="msg.attachments?.length"
                    :agent-id="agentId"
                    :attachments="msg.attachments"
                    class="msg-attach-in-user"
                  />
                  <span v-if="msg.content">{{ normalizeDisplayText(msg.content) }}</span>
                </div>
                <template v-else>
                  <div class="message-bubble assistant-bubble">
                    <div class="assistant-inner-stack">
                      <MessageAttachments
                        v-if="msg.attachments?.length"
                        :agent-id="agentId"
                        :attachments="msg.attachments"
                      />
                      <MessageReasoning
                        v-if="msg.reasoningContent"
                        :reasoning-content="msg.reasoningContent"
                      />
                      <MessageToolCalls v-if="msg.toolCalls" :tool-calls="msg.toolCalls" />
                      <div v-if="getAssistantContent(msg)" class="assistant-markdown-card">
                        <MarkdownView :content="getAssistantContent(msg)" class="assistant-markdown" />
                      </div>
                      <!-- 思考中提示：流进行中 + 既无正文又无思考也无工具调用时显示 -->
                      <div
                        v-else-if="
                          sending && index === messages.length - 1
                        "
                        class="waiting-text"
                      >
                        {{ msg.reasoningContent ? '整理回答中...' : '思考中...' }}
                      </div>
                    </div>
                  </div>
                  <MessageUsage v-if="msg.usage" :usage="msg.usage" />
                </template>
                <div class="message-meta">
                  {{ msg.role === 'user' ? '用户' : '智能体' }}
                </div>
              </div>
            </div>
            <el-empty v-if="messages.length === 0" description="开始对话吧" :image-size="60" />
          </template>
        </div>
        <!-- 输入区 -->
        <div class="chat-input-wrap">
          <!-- 待发送附件 -->
          <TransitionGroup
            v-if="pendingAttachments.length"
            name="pending-att-list"
            tag="div"
            class="pending-attachments"
          >
            <div
              v-for="(att, i) in pendingAttachments"
              :key="att.url"
              class="pending-att-card"
            >
              <!-- 图片：大缩略图，点击放大预览 -->
              <div v-if="isImageAtt(att)" class="pending-att-image">
                <el-image
                  v-if="att._preview"
                  :src="att._preview"
                  :preview-src-list="imagePreviewSrcs"
                  :initial-index="imageIndex(att)"
                  :preview-teleported="true"
                  :hide-on-click-modal="true"
                  fit="cover"
                  class="pending-att-img"
                />
                <Icon v-else icon="ep:picture" class="pending-att-img-fallback" />
                <div
                  class="pending-att-remove"
                  :title="'移除附件：' + att.name"
                  :aria-label="'移除附件：' + att.name"
                  @click.stop="removeAttachment(i)"
                >
                  <Icon icon="ep:close" />
                </div>
              </div>
              <!-- 其他：类型图标 + 文件名 + 大小 -->
              <template v-else>
                <div class="pending-att-icon" :style="{ background: fileMeta(att).color }">
                  <Icon :icon="fileMeta(att).icon" />
                </div>
                <div class="pending-att-info">
                  <div class="pending-att-name" :title="att.name">{{ att.name }}</div>
                  <div class="pending-att-size">{{ formatFileSize(att.size) }}</div>
                </div>
                <div
                  class="pending-att-remove"
                  :title="'移除附件：' + att.name"
                  :aria-label="'移除附件：' + att.name"
                  @click.stop="removeAttachment(i)"
                >
                  <Icon icon="ep:close" />
                </div>
              </template>
            </div>
          </TransitionGroup>
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="请输入问题，Enter 发送，Shift+Enter 换行"
            :disabled="!agentId || sending"
            @keydown.enter.prevent="handleSend"
          />
          <div class="flex justify-between mt-8px">
            <div class="flex gap-8px">
              <el-upload
                :show-file-list="false"
                :before-upload="handleUploadFile"
                :disabled="!agentId || sending"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv"
              >
                <el-button :disabled="!agentId || sending" :loading="uploading">
                  <Icon icon="ep:paperclip" class="mr-5px" /> 附件
                </el-button>
              </el-upload>
            </div>
            <el-button
              v-if="sending"
              type="warning"
              plain
              @click="handleStopStream"
              v-hasPermi="['ai-agent:chat-session:update']"
            >
              <Icon icon="ep:video-pause" class="mr-5px" /> 停止生成
            </el-button>
            <el-button
              v-else
              type="primary"
              :disabled="!agentId || sending"
              @click="handleSend"
            >
              发 送
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </ContentWrap>
</template>

<script setup lang="ts">
import { formatDate } from '@/utils/formatTime'
import { AgentApi, Agent } from '@/api/ai/agent'
import {
  ChatSessionApi,
  QwenPawChat,
  ChatMessage,
  ChatAttachment,
  ToolCall,
  TokenUsage,
  normalizeQwenPawMessage
} from '@/api/ai/chatsession'
import MarkdownView from '@/components/MarkdownView/index.vue'
import MessageReasoning from './components/MessageReasoning.vue'
import MessageToolCalls from './components/MessageToolCalls.vue'
import MessageUsage from './components/MessageUsage.vue'
import MessageAttachments from './components/MessageAttachments.vue'

/**
 * 前端流式状态扩展：
 * - usage：Token 用量
 * - _liveBuffer：reconnect 时复用的 live 累积区（与 history 共用同一对象）
 */
interface ChatMessageView extends ChatMessage {
  usage?: TokenUsage
}

/** 问答会话 列表 */
defineOptions({ name: 'AiChatSessionIndex' })

const message = useMessage() // 消息弹窗

// ============ 智能体 ============
const agents = ref<Agent[]>([]) // 我的智能体列表
const agentId = ref<number>() // 当前选中的智能体（业务规范：必须先选）

/** 获得我的智能体 */
const loadAgents = async () => {
  agents.value = await AgentApi.getMyAgents()
}

/** 切换智能体：清空会话/消息，重新拉 QwenPaw 会话列表 */
const handleAgentChange = () => {
  // 停掉旧 SSE
  abortController.value?.abort()
  currentChatId.value = undefined
  currentChat.value = undefined
  messages.value = []
  draftSessionId.value = undefined
  search.value = ''
  pendingAttachments.value = []
  loadChats()
  loadModels()
}

// ============ 模型切换（scope=agent，持久化到 QwenPaw） ============
const modelOptions = ref<
  { providerId: string; providerName: string; models: { id: string; label: string }[] }[]
>([])
const activeModelKey = ref<string>()
const modelLoading = ref(false)

/** 拉取模型列表 + 当前激活模型 */
const loadModels = async () => {
  if (!agentId.value) {
    modelOptions.value = []
    activeModelKey.value = undefined
    return
  }
  modelLoading.value = true
  try {
    const [providersResp, activeResp]: any[] = await Promise.all([
      ChatSessionApi.listModels(agentId.value),
      ChatSessionApi.getActiveModel(agentId.value)
    ])
    const providers: any[] = Array.isArray(providersResp)
      ? providersResp
      : providersResp?.data || []
    modelOptions.value = providers
      .filter((p) => p && ((p.models?.length || 0) + (p.extra_models?.length || 0)) > 0)
      .map((p) => ({
        providerId: p.id,
        providerName: p.name || p.id,
        models: [...(p.models || []), ...(p.extra_models || [])].map((m) => ({
          id: m.id,
          label: m.name || m.id
        }))
      }))
    const active: any = activeResp?.data || activeResp
    const activeLlm = active?.active_llm || active
    if (activeLlm?.provider_id && activeLlm?.model) {
      activeModelKey.value = activeLlm.provider_id + ':' + activeLlm.model
    } else {
      activeModelKey.value = undefined
    }
  } catch (e) {
    console.warn('[loadModels] 加载模型失败', e)
  } finally {
    modelLoading.value = false
  }
}

/** 切换模型：持久化到 QwenPaw（scope=agent） */
const handleModelChange = async (val: string) => {
  if (!val || !agentId.value) return
  const idx = val.indexOf(':')
  if (idx === -1) return
  const providerId = val.slice(0, idx)
  const model = val.slice(idx + 1)
  try {
    await ChatSessionApi.setActiveModel(agentId.value, providerId, model)
    message.success('已切换模型')
  } catch (e) {
    message.error('切换模型失败')
    // 回滚到当前激活模型
    await loadModels()
  }
}

// ============ 文件上传（对话附件） ============
interface PendingAttachment extends ChatAttachment {
  /** 本地图片预览 Blob URL（仅图片附件） */
  _preview?: string
}
const pendingAttachments = ref<PendingAttachment[]>([])
const uploading = ref(false)

const isImageAtt = (att: ChatAttachment) => (att.type || '').startsWith('image')

/** 文件类型元信息（图标 + 底色），按扩展名/MIME 区分展示 */
const fileMeta = (att: ChatAttachment): { icon: string; color: string } => {
  const name = att.name || ''
  const ext = (name.split('.').pop() || '').toLowerCase()
  const t = (att.type || '').toLowerCase()
  if (t.startsWith('video')) return { icon: 'ep:video-camera', color: '#9254de' }
  if (t.startsWith('audio')) return { icon: 'ep:headset', color: '#36cfc9' }
  if (ext === 'pdf') return { icon: 'ep:document', color: '#f56c6c' }
  if (['doc', 'docx'].includes(ext)) return { icon: 'ep:document', color: '#409eff' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { icon: 'ep:document', color: '#67c23a' }
  if (['ppt', 'pptx'].includes(ext)) return { icon: 'ep:document', color: '#e6a23c' }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: 'ep:box', color: '#909399' }
  return { icon: 'ep:document', color: '#909399' }
}

/** 格式化文件大小（B / KB / MB / GB） */
const formatFileSize = (size?: number): string => {
  if (size == null || size <= 0) return ''
  if (size < 1024) return size + ' B'
  const units = ['KB', 'MB', 'GB']
  let v = size / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return v.toFixed(v >= 100 ? 0 : 1) + ' ' + units[i]
}

/** 可预览的图片附件（已有本地 Blob 预览） */
const previewableImages = computed(() =>
  pendingAttachments.value.filter((a) => isImageAtt(a) && a._preview)
)
const imagePreviewSrcs = computed(() => previewableImages.value.map((a) => a._preview as string))
const imageIndex = (att: PendingAttachment) => {
  const i = previewableImages.value.indexOf(att)
  return Math.max(i, 0)
}

/** el-upload before-upload：上传文件到 QwenPaw，成功后加入待发送列表 */
const handleUploadFile = async (file: File) => {
  if (!agentId.value) return false
  uploading.value = true
  try {
    const resp: any = await ChatSessionApi.uploadFile(agentId.value, file)
    const data = resp?.data || resp
    if (!data?.url) {
      message.error('上传失败：未返回文件地址')
      return false
    }
    const att: PendingAttachment = {
      url: data.url,
      // 优先用本地源文件名；QwenPaw 返回的 file_name 是临时文件名（带 UUID 前缀，不宜展示）
      name: file.name || data.file_name || 'file',
      type: file.type || 'file',
      size: data.size || file.size
    }
    if (isImageAtt(att)) {
      try {
        att._preview = await ChatSessionApi.loadFilePreviewUrl(agentId.value, data.url)
      } catch {}
    }
    pendingAttachments.value.push(att)
    return false // 阻止 el-upload 默认上传（已手动上传）
  } catch (e: any) {
    message.error('上传失败：' + (e?.message || '未知错误'))
    return false
  } finally {
    uploading.value = false
  }
}

const removeAttachment = (i: number) => {
  pendingAttachments.value.splice(i, 1)
}

// ============ QwenPaw 会话列表 ============
const chatList = ref<QwenPawChat[]>([])
const search = ref('')

/** 列出会话 */
const loadChats = async () => {
  if (!agentId.value) {
    chatList.value = []
    return
  }
  abortController.value?.abort()
  const resp: any = await ChatSessionApi.listChats(agentId.value)
  const list: QwenPawChat[] = Array.isArray(resp) ? resp : resp?.data || []
  // 客户端按 name 过滤（QwenPaw 没有 search API，量小时够用）
  const kw = search.value?.trim().toLowerCase()
  chatList.value = kw ? list.filter((c) => (c.name || '').toLowerCase().includes(kw)) : list
  // 保留选择：若当前选中的 chat 仍存在则保留，否则清空
  if (currentChatId.value && !chatList.value.find((c) => c.id === currentChatId.value)) {
    currentChatId.value = undefined
    currentChat.value = undefined
    messages.value = []
  }
}

// ============ 当前会话与消息 ============
const currentChatId = ref<string>() // QwenPaw chatId（UUID）
const currentChat = ref<QwenPawChat>()
const messages = ref<ChatMessageView[]>([])
const messageBoxRef = ref()
const inputMessage = ref('')
const sending = ref(false)
const abortController = ref<AbortController>()
const draftSessionId = ref<string>() // 草稿态会话 sessionId（发首条消息时透传，用于定位新建会话）

/** 生成 UUID（优先浏览器原生，兜底简易 v4） */
const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 选择会话：从 QwenPaw 拉真实 messages */
const handleSelectChat = async (chat: QwenPawChat) => {
  if (currentChatId.value === chat.id) return
  abortController.value?.abort()
  draftSessionId.value = undefined
  currentChatId.value = chat.id
  currentChat.value = chat
  await loadMessages()
}

/** 加载当前会话详情（仅刷新名称等元信息，保留 session_id/user_id） */
const loadCurrentChat = async () => {
  if (!agentId.value || !currentChatId.value) return
  const resp: any = await ChatSessionApi.getChat(agentId.value, currentChatId.value)
  const chat: QwenPawChat = resp?.data || resp
  // 合并：getChat 返回 ChatHistory（无 session_id），保留 ChatSpec 的三元组信息
  if (chat) {
    currentChat.value = {
      ...currentChat.value,
      name: chat.name,
      status: (chat as any).status
    }
  }
}

/**
 * 加载历史 messages：取自 getChat 返回的 QwenPaw ChatSpec
 * 直接调用 chat-api 中的归一化函数（与 SSE 流走同一份解析逻辑，保证渲染一致）
 */
const loadMessages = async () => {
  if (!agentId.value || !currentChatId.value) {
    messages.value = []
    return
  }
  const resp: any = await ChatSessionApi.getChat(agentId.value, currentChatId.value)
  const chat: QwenPawChat = resp?.data || resp
  const list = Array.isArray(chat.messages) ? chat.messages : []
  messages.value = groupChatMessages(list)
  await scrollToBottom()
  // 切到"正在生成"的会话时，主动 attach 到 QwenPaw 流上续推
  // QwenPaw 没有 streaming 字段；约定：最后一条 assistant 若无 content 且无 reasoningContent，
  // 且 metadata.created_at 距今 < 30s 即尝试 reconnect
  const last = messages.value[messages.value.length - 1]
  const lastRaw = list[list.length - 1] as any
  const isLikelyStreaming =
    last &&
    last.role === 'assistant' &&
    !last.content &&
    !last.reasoningContent
  if (isLikelyStreaming) {
    const createdAt = lastRaw?.metadata?.created_at || last.createTime
    if (createdAt && Date.now() - new Date(createdAt).getTime() < 30_000) {
      attachReconnectStream()
    } else if (!createdAt) {
      // 历史无 createdAt 也尝试一下，QwenPaw 不在跑就立即关流
      attachReconnectStream()
    }
  }
}

/**
 * 挂载到 QwenPaw 正在运行的流（页面切回 / 选中"生成中"的会话时）
 * 复用 messages 数组中最后一条 role=assistant 的消息作为承载对象
 */
const attachReconnectStream = async () => {
  if (!agentId.value || !currentChatId.value) return
  let assistantMsg = [...messages.value].reverse().find((m) => m.role === 'assistant')
  if (!assistantMsg) {
    messages.value.push({
      id: '',
      role: 'assistant',
      content: '',
      reasoningContent: '',
      toolCalls: ''
    })
    assistantMsg = messages.value[messages.value.length - 1]
  }
  const toolCallMap = new Map<string, ToolCall>()
  sending.value = true
  abortController.value = new AbortController()
  try {
    await ChatSessionApi.reconnectStream(agentId.value, currentChatId.value, currentChat.value?.session_id || '', {
      signal: abortController.value.signal,
      onReplayed: () => {
        // replay 段已结束，进入 live 续推
      },
      onMessage: async (text) => {
        assistantMsg.content += text
        await scrollToBottom()
      },
      onReasoning: async (text) => {
        assistantMsg.reasoningContent = (assistantMsg.reasoningContent || '') + text
        await scrollToBottom()
      },
      onTool: async (tool) => {
        const existing = toolCallMap.get(tool.callId)
        if (existing) {
          if (tool.arguments) existing.arguments = tool.arguments
          if (tool.output) {
            existing.output = tool.output
            existing.state = tool.state
          }
        } else {
          toolCallMap.set(tool.callId, { ...tool })
        }
        assistantMsg.toolCalls = JSON.stringify(Array.from(toolCallMap.values()))
        await scrollToBottom()
      },
      onUsage: async (usage) => {
        assistantMsg.usage = usage
        assistantMsg.tokens = usage.totalTokens
        await scrollToBottom()
      },
      onDone: async (payload) => {
        if (payload.content && !assistantMsg.content.endsWith(payload.content)) {
          assistantMsg.content += payload.content
        }
        if (payload.reasoning) {
          assistantMsg.reasoningContent = (assistantMsg.reasoningContent || '') + payload.reasoning
        }
        await scrollToBottom()
        // 重新拉一次会话详情，QwenPaw title 可能会变
        try {
          await loadChats()
        } catch {}
      },
      onError: (msg) => {
        assistantMsg.content += (assistantMsg.content ? '\n\n' : '') + '重新挂载失败：' + msg
      }
    })
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      console.error('[reconnectStream] error', e)
    }
  } finally {
    sending.value = false
    abortController.value = undefined
    await scrollToBottom()
  }
}

/** 滚动到底部 */
const scrollToBottom = async () => {
  await nextTick()
  if (messageBoxRef.value) {
    messageBoxRef.value.scrollTop = messageBoxRef.value.scrollHeight
  }
}

const normalizeDisplayText = (value?: string) => {
  return (value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const mergeToolCalls = (left?: string, right?: string) => {
  const map = new Map<string, any>()
  const push = (raw?: string) => {
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      list.forEach((item) => {
        if (!item || !item.callId) return
        const existing = map.get(item.callId) || {}
        map.set(item.callId, { ...existing, ...item })
      })
    } catch {
      // 忽略非 JSON 字符串，保留原值
    }
  }
  push(left)
  push(right)
  const merged = Array.from(map.values())
  return merged.length > 0 ? JSON.stringify(merged) : undefined
}

const groupChatMessages = (list: any[]) => {
  const grouped: ChatMessageView[] = []
  for (const raw of list) {
    const item = normalizeQwenPawMessage(raw)
    const last = grouped[grouped.length - 1]
    const shouldMergeWithLast = last && last.role !== 'user' && item.role !== 'user'
    if (shouldMergeWithLast) {
      const mergeText = (left?: string, right?: string) => {
        const parts = [left, right].filter((v) => !!v && String(v).trim())
        return parts.length ? normalizeDisplayText(parts.join('\n\n')) : undefined
      }
      last.content = mergeText(last.content, item.content) || last.content || ''
      last.reasoningContent = mergeText(last.reasoningContent, item.reasoningContent) || last.reasoningContent || ''
      last.toolCalls = mergeToolCalls(last.toolCalls, item.toolCalls)
      if (!last.usage && item.usage) last.usage = item.usage
      continue
    }
    grouped.push(item)
  }
  return grouped
}

const getAssistantContent = (msg: ChatMessageView) => {
  // reasoning 与正文已分开累积（历史走 normalizeQwenPawMessage，SSE 走 consumeSseStream），
  // 这里直接返回正文即可。
  return normalizeDisplayText(msg.content || '')
}

/** 发送消息：SSE 流式逐块展示（QwenPaw 自动开新会话时 chatId 为空即可） */
const handleSend = async () => {
  const content = inputMessage.value?.trim() || ''
  const attachments = [...pendingAttachments.value]
  if ((!content && !attachments.length) || !agentId.value || sending.value) return
  // QwenPaw 端对"无文本"消息会走 no-text debounce 缓冲（SSE 空流、表现为无响应），
  // 附件必须与文本一起发送。
  if (attachments.length && !content) {
    message.warning('请填写问题后再发送附件')
    return
  }
  // 草稿态（无当前会话）：用草稿 sessionId 发首条消息，QwenPaw 自动建会话并生成标题
  const isDraft = !currentChatId.value
  if (isDraft && !draftSessionId.value) {
    draftSessionId.value = uuid()
  }
  // 追加用户消息（含附件）
  messages.value.push({
    id: '',
    role: 'user',
    content,
    attachments: attachments.length ? [...attachments] : undefined
  })
  inputMessage.value = ''
  pendingAttachments.value = []
  sending.value = true
  await scrollToBottom()
  // 追加空的助手消息占位
  messages.value.push({
    id: '',
    role: 'assistant',
    content: '',
    reasoningContent: '',
    toolCalls: ''
  })
  const assistantMsg = messages.value[messages.value.length - 1]
  let hasContent = false
  const toolCallMap = new Map<string, ToolCall>()

  abortController.value = new AbortController()
  try {
    await ChatSessionApi.sendMessageStream(
      agentId.value,
      currentChatId.value,
      isDraft ? draftSessionId.value : currentChat.value?.session_id,
      content,
      {
        signal: abortController.value.signal,
        onMessage: async (text) => {
          hasContent = true
          assistantMsg.content += text
          await scrollToBottom()
        },
        onReasoning: async (text) => {
          hasContent = true
          assistantMsg.reasoningContent = (assistantMsg.reasoningContent || '') + text
          await scrollToBottom()
        },
        onTool: async (tool) => {
          hasContent = true
          const existing = toolCallMap.get(tool.callId)
          if (existing) {
            if (tool.arguments) existing.arguments = tool.arguments
            if (tool.output) {
              existing.output = tool.output
              existing.state = tool.state
            }
          } else {
            toolCallMap.set(tool.callId, { ...tool })
          }
          assistantMsg.toolCalls = JSON.stringify(Array.from(toolCallMap.values()))
          await scrollToBottom()
        },
        onUsage: async (usage) => {
          assistantMsg.usage = usage
          assistantMsg.tokens = usage.totalTokens
          await scrollToBottom()
        },
        onDone: async (payload) => {
          if (payload.content) assistantMsg.content = payload.content
          if (payload.reasoning) assistantMsg.reasoningContent = payload.reasoning
          if (payload.toolCalls && payload.toolCalls.length > 0) {
            assistantMsg.toolCalls = JSON.stringify(payload.toolCalls)
          }
          await scrollToBottom()
          // QwenPaw 可能在流过程中改名会话名，重新拉一次
          try {
            await loadChats()
            if (isDraft) {
              // 草稿态：QwenPaw 已按 session_id 新建会话，按 session_id 定位并选中
              const created = chatList.value.find((c) => c.session_id === draftSessionId.value)
              if (created) {
                currentChatId.value = created.id
                currentChat.value = created
                draftSessionId.value = undefined
              }
            } else if (currentChatId.value) {
              await loadCurrentChat()
            }
          } catch {}
        },
        onError: (msg) => {
          hasContent = true
          assistantMsg.content += (assistantMsg.content ? '\n\n' : '') + '请求失败：' + msg
        }
      },
      attachments
    )
    if (!hasContent) {
      messages.value = messages.value.filter((m) => m !== assistantMsg)
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      throw e
    }
  } finally {
    sending.value = false
    abortController.value = undefined
    await scrollToBottom()
  }
}

/** 停止生成：取消前端 SSE + 转发 QwenPaw chat/stop */
const handleStopStream = async () => {
  if (!agentId.value) return
  abortController.value?.abort()
  // 草稿态无 chatId，无法转发 QwenPaw stop，仅取消前端 SSE
  if (!currentChatId.value) {
    message.success('已停止生成')
    return
  }
  try {
    await ChatSessionApi.stopStream(agentId.value, currentChatId.value)
    message.success('已停止生成')
  } catch {
    message.error('停止生成失败')
  }
}

/**
 * 新建对话：草稿态，不预创建会话。
 *
 * 对齐 QwenPaw 语义：自动标题依赖「会话在第一条消息时新建、名字是消息前10字占位名」，
 * 若预创建并传固定名字（如"新对话"），chat.name 永远不等于占位名，标题生成不会触发。
 * 因此这里只清空当前会话进入草稿态，发第一条消息时由 QwenPaw 自动建会话并自动生成标题。
 */
const handleNewChat = () => {
  if (!agentId.value) {
    message.error('请先选择智能体')
    return
  }
  abortController.value?.abort()
  currentChatId.value = undefined
  currentChat.value = undefined
  messages.value = []
  // 草稿会话 id：发首条消息时透传给 QwenPaw，之后按 session_id 定位新建的会话
  draftSessionId.value = uuid()
  pendingAttachments.value = []
  scrollToBottom()
}

/** 删除会话（透传 QwenPaw 删除） */
const handleDeleteChat = async (item?: QwenPawChat) => {
  const targetItem = item || (currentChatId.value ? chatList.value.find((c) => c.id === currentChatId.value) : undefined)
  const targetId = targetItem?.id || currentChatId.value
  if (!agentId.value || !targetId) return
  try {
    await message.delConfirm()
    await ChatSessionApi.deleteChat(agentId.value, targetId)
    message.success('会话已删除')
    if (currentChatId.value === targetId) {
      currentChatId.value = undefined
      currentChat.value = undefined
      messages.value = []
      draftSessionId.value = undefined
      pendingAttachments.value = []
    }
    await loadChats()
  } catch {}
}

/** 重命名会话（透传 QwenPaw rename） */
const handleRenameChat = async (item: QwenPawChat) => {
  if (!agentId.value) return
  try {
    const { value } = await message.prompt('请输入新的会话标题', '重命名会话')
    if (!value?.trim()) return
    await ChatSessionApi.renameChat(agentId.value, item.id, value.trim())
    message.success('已重命名')
    item.name = value.trim()
  } catch {}
}

/** 初始化 */
onMounted(async () => {
  await loadAgents()
})
</script>

<style scoped>
.chat-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color);
}

.chat-layout {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  height: calc(100vh - 220px);
  min-height: 480px;
}

.session-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-blank);
  overflow: hidden;
  min-height: 0;
}

.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-blank);
  overflow: hidden;
  min-height: 0;
}

.chat-message-box {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  /* 用 --el-fill-color-lighter → --el-fill-color-light 渐变，避免底部落在
     纯白(--el-fill-color-blank)/纯黑上 */
  background: linear-gradient(180deg, var(--el-fill-color-lighter) 0%, var(--el-fill-color-light) 100%);
}

.message-row {
  display: flex;
  margin-bottom: 16px;
}

.message-content-wrap {
  max-width: 75%;
}

.user-bubble-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-bubble {
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 22px;
  white-space: normal;
  word-break: break-word;
}

.select-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.session-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.user-bubble {
  white-space: pre-wrap;
}

.user-bubble {
  background: var(--el-color-primary);
  color: var(--el-color-white);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.assistant-bubble {
  width: 100%;
  border: 1px solid var(--el-border-color-lighter);
  background: transparent;
  color: var(--el-text-color-primary);
  border-radius: 14px;
  padding: 12px 12px 10px;
  box-shadow: none;
}

.assistant-inner-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.assistant-markdown-card {
  overflow: hidden;
  border-radius: 10px;
  background: transparent;
  border: 1px solid var(--el-border-color-lighter);
  padding: 10px 12px;
}

.assistant-markdown {
  display: block;
  background: transparent;
  color: var(--el-text-color-primary);
}

.waiting-text {
  padding: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.message-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chat-input-wrap {
  border-top: 1px solid var(--el-border-color);
  padding: 12px;
  background: var(--el-fill-color-blank);
  flex-shrink: 0;
}

.pending-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.pending-att-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  max-width: 280px;
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
}
.pending-att-card:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* 图片缩略图 */
.pending-att-image {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  flex-shrink: 0;
}
.pending-att-image .pending-att-img,
.pending-att-image .pending-att-img-fallback {
  width: 100%;
  height: 100%;
  display: block;
}
.pending-att-img-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: var(--el-text-color-secondary);
}

/* 文件类型图标 */
.pending-att-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.08);
}

.pending-att-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.pending-att-name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
}
.pending-att-size {
  font-size: 12px;
  line-height: 1.3;
  color: var(--el-text-color-secondary);
  margin-top: 3px;
}

/* 删除按钮：文件卡片弱化展示、hover 显现；图片卡片常显 */
.pending-att-remove {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.15s, background-color 0.15s, opacity 0.15s;
}
.pending-att-card:hover .pending-att-remove {
  color: var(--el-text-color-regular);
}
.pending-att-remove:hover,
.pending-att-remove:focus-visible {
  color: var(--el-color-danger);
  background: var(--el-fill-color-light);
  outline: none;
}
.pending-att-image .pending-att-remove {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 22px;
  height: 22px;
  font-size: 11px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
}
.pending-att-image .pending-att-remove:hover,
.pending-att-image .pending-att-remove:focus-visible {
  color: #fff;
  background: rgba(0, 0, 0, 0.65);
}

/* 附件添加 / 移除过渡 */
.pending-att-list-enter-active,
.pending-att-list-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.pending-att-list-leave-active {
  position: absolute; /* 脱离文档流原位淡出，让后方卡片平滑上移补位 */
}
.pending-att-list-enter-from,
.pending-att-list-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(4px);
}
.pending-att-list-move {
  transition: transform 0.2s ease;
}
@media (prefers-reduced-motion: reduce) {
  .pending-att-list-enter-active,
  .pending-att-list-leave-active,
  .pending-att-list-move {
    transition: none;
  }
}

.msg-attach-in-user :deep(.att-image),
.msg-attach-in-user :deep(.att-media),
.msg-attach-in-user :deep(.att-audio) {
  border: 1px solid rgba(255, 255, 255, 0.35);
}

:deep(.markdown-view) {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
</style>
