<template>
  <ContentWrap>
    <!-- 顶部工具条 -->
    <div class="flex items-center gap-12px pb-16px border-bottom-1px border-solid border-[var(--el-border-color)]">
      <el-select v-model="agentId" placeholder="请选择智能体" class="!w-260px" @change="handleAgentChange">
        <el-option v-for="item in agents" :key="item.id" :label="item.name" :value="item.id">
          <div class="flex justify-between">
            <span>{{ item.name }}</span>
            <el-tag v-if="item.enableKbTool" size="small" type="success">知识库</el-tag>
          </div>
        </el-option>
      </el-select>
      <el-input
        v-model="queryParams.search"
        placeholder="搜索会话标题"
        clearable
        class="!w-200px"
        @keyup.enter="handleQuery"
        @clear="handleQuery"
      />
      <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
      <el-button type="primary" @click="handleNewSession" v-hasPermi="['ai-agent:chat-session:create']">
        <Icon icon="ep:plus" class="mr-5px" /> 新建会话
      </el-button>
    </div>

    <!-- 主体：左列表 + 右对话 -->
    <div class="flex gap-16px mt-16px" style="height: 620px">
      <!-- 左侧会话列表 -->
      <div class="w-280px border-radius-8px border-1px border-solid border-[var(--el-border-color)] flex flex-col">
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="item in sessionList"
            :key="item.id"
            class="p-10px cursor-pointer border-bottom-1px border-solid border-[var(--el-border-color-lighter)]"
            :class="currentSessionId === item.id ? 'bg-[var(--el-color-primary-light-9)]' : 'hover:bg-[var(--el-fill-color-light)]'"
            @click="handleSelectSession(item.id)"
          >
            <div class="flex justify-between items-center">
              <span class="text-14px font-500 text-truncate flex-1">{{ item.title }}</span>
              <el-tag v-if="item.status === 0" size="small" type="info">已关闭</el-tag>
              <div v-else class="flex gap-2px items-center" @click.stop>
                <el-tooltip content="重命名" placement="top">
                  <el-button
                    link
                    type="primary"
                    size="small"
                    @click="handleRenameSession(item)"
                    v-hasPermi="['ai-agent:chat-session:update']"
                  >
                    <Icon icon="ep:edit" />
                  </el-button>
                </el-tooltip>
                <el-tooltip content="清空消息" placement="top">
                  <el-button
                    link
                    type="warning"
                    size="small"
                    @click="handleClearSession(item)"
                    v-hasPermi="['ai-agent:chat-session:update']"
                  >
                    <Icon icon="ep:brush" />
                  </el-button>
                </el-tooltip>
              </div>
            </div>
            <div class="flex justify-between mt-4px">
              <span class="text-12px text-gray-400">{{ item.agentName || '' }}</span>
              <span class="text-12px text-gray-400">{{ formatDate(item.createTime) }}</span>
            </div>
          </div>
          <el-empty v-if="sessionList.length === 0" description="暂无会话" :image-size="60" />
        </div>
        <Pagination
          :total="sessionTotal"
          v-model:page="queryParams.pageNo"
          v-model:limit="queryParams.pageSize"
          @pagination="getSessionList"
          layout="prev, pager, next"
        />
      </div>

      <!-- 右侧聊天区 -->
      <div class="flex-1 border-radius-8px border-1px border-solid border-[var(--el-border-color)] flex flex-col">
        <!-- 消息区 -->
        <div ref="messageBoxRef" class="flex-1 overflow-y-auto p-16px bg-[var(--el-fill-color-lighter)]">
          <template v-if="currentSessionId">
            <div
              v-for="(msg, index) in messages"
              :key="index"
              class="flex mb-16px"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div class="max-w-75%" :class="msg.role === 'user' ? 'flex flex-col items-end' : ''">
                <!-- 用户消息 -->
                <div
                  v-if="msg.role === 'user'"
                  class="p-10px 16px border-radius-8px text-14px leading-22px whitespace-pre-wrap bg-[var(--el-color-primary)] text-white"
                >
                  {{ msg.content }}
                </div>
                <!-- 助手消息 -->
                <template v-else>
                  <MessageReasoning
                    v-if="msg.reasoningContent"
                    :reasoning-content="msg.reasoningContent"
                  />
                  <MessageToolCalls v-if="msg.toolCalls" :tool-calls="msg.toolCalls" />
                  <div
                    class="p-10px 16px border-radius-8px text-14px leading-22px whitespace-pre-wrap bg-white border-1px border-solid border-[var(--el-border-color)]"
                  >
                    {{ msg.content || '思考中...' }}
                  </div>
                  <MessageUsage v-if="msg.usage" :usage="msg.usage" />
                </template>
                <div class="text-12px text-gray-400 mt-4px">
                  {{ msg.role === 'user' ? '用户' : '智能体' }}
                </div>
              </div>
            </div>
            <el-empty v-if="messages.length === 0" description="开始对话吧" :image-size="60" />
          </template>
          <el-empty v-else description="请选择或新建会话" :image-size="60" />
        </div>
        <!-- 输入区 -->
        <div class="border-top-1px border-solid border-[var(--el-border-color)] p-12px">
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="请输入问题，Enter 发送，Shift+Enter 换行"
            :disabled="!currentSessionId || sending"
            @keydown.enter.prevent="handleSend"
          />
          <div class="flex justify-between mt-8px">
            <div class="flex gap-8px">
              <el-button
                v-if="currentSession"
                :type="currentSession.status === 1 ? 'warning' : 'success'"
                plain
                size="small"
                @click="handleCloseSession"
                v-hasPermi="['ai-agent:chat-session:update']"
              >
                {{ currentSession.status === 1 ? '关闭会话' : '会话已关闭' }}
              </el-button>
              <el-button
                type="danger"
                plain
                size="small"
                @click="handleDeleteSession"
                v-hasPermi="['ai-agent:chat-session:delete']"
              >
                删除会话
              </el-button>
            </div>
            <el-button
              v-if="sending"
              type="danger"
              plain
              @click="handleStopStream"
              v-hasPermi="['ai-agent:chat-session:update']"
            >
              <Icon icon="ep:video-pause" class="mr-5px" /> 停止生成
            </el-button>
            <el-button v-else type="primary" :disabled="!currentSessionId || sending" @click="handleSend">
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
import { ChatSessionApi, ChatSession, ChatMessage, ToolCall, TokenUsage } from '@/api/ai/chatsession'
import MessageReasoning from './components/MessageReasoning.vue'
import MessageToolCalls from './components/MessageToolCalls.vue'
import MessageUsage from './components/MessageUsage.vue'

/** 扩展消息类型，用于前端流式状态 */
interface ChatMessageView extends ChatMessage {
  reasoningContent?: string
  toolCalls?: string
  tokens?: number
  usage?: TokenUsage
}

/** 问答会话 列表 */
defineOptions({ name: 'AiChatSessionIndex' })

const message = useMessage() // 消息弹窗

// ============ 智能体 ============
const agents = ref<Agent[]>([]) // 我的智能体列表
const agentId = ref<number>() // 当前选中的智能体

/** 获得我的智能体 */
const getMyAgents = async () => {
  agents.value = await AgentApi.getMyAgents()
}

/** 切换智能体：重置会话与消息 */
const handleAgentChange = () => {
  currentSessionId.value = undefined
  currentSession.value = undefined
  messages.value = []
  queryParams.agentId = agentId.value
  queryParams.pageNo = 1
  getSessionList()
}

// ============ 会话列表 ============
const sessionList = ref<ChatSession[]>([]) // 会话列表
const sessionTotal = ref(0) // 会话总数
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  agentId: undefined,
  search: undefined
})

/** 查询会话列表 */
const getSessionList = async () => {
  const data = await ChatSessionApi.getSessionPage(queryParams)
  sessionList.value = data.list
  sessionTotal.value = data.total
}

/** 搜索 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getSessionList()
}

/** 新建会话 */
const handleNewSession = async () => {
  if (!agentId.value) {
    message.error('请先选择智能体')
    return
  }
  const id = await ChatSessionApi.createSession({ agentId: agentId.value })
  message.success('会话创建成功')
  currentSessionId.value = id
  await getSessionList()
  await loadCurrentSession()
  messages.value = []
  await scrollToBottom()
}

// ============ 当前会话与消息 ============
const currentSessionId = ref<number>() // 当前会话ID
const currentSession = ref<ChatSession>() // 当前会话
const messages = ref<ChatMessageView[]>([]) // 当前会话消息
const messageBoxRef = ref() // 消息容器 Ref
const inputMessage = ref('') // 输入内容
const sending = ref(false) // 是否发送中
const abortController = ref<AbortController>() // 取消控制器

/** 选择会话 */
const handleSelectSession = async (id: number) => {
  currentSessionId.value = id
  await loadCurrentSession()
  await getMessages()
}

/** 加载当前会话详情 */
const loadCurrentSession = async () => {
  currentSession.value = await ChatSessionApi.getSession(currentSessionId.value)
}

/** 加载消息列表 */
const getMessages = async () => {
  const list: ChatMessageView[] = await ChatSessionApi.getMessageList(currentSessionId.value)
  messages.value = list.map((m) => ({ ...m }))
  await scrollToBottom()
}

/** 滚动到底部 */
const scrollToBottom = async () => {
  await nextTick()
  if (messageBoxRef.value) {
    messageBoxRef.value.scrollTop = messageBoxRef.value.scrollHeight
  }
}

/** 发送消息（SSE 流式逐块展示） */
const handleSend = async () => {
  const content = inputMessage.value?.trim()
  if (!content || !currentSessionId.value || sending.value) {
    return
  }
  // 追加用户消息
  messages.value.push({ id: 0, sessionId: currentSessionId.value, agentId: agentId.value, role: 'user', content })
  inputMessage.value = ''
  sending.value = true
  await scrollToBottom()
  // 追加空的助手消息占位，SSE 增量逐块填充
  messages.value.push({
    id: 0,
    sessionId: currentSessionId.value,
    agentId: agentId.value,
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
      currentSessionId.value,
      { message: content },
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
          // 同一 callId 增量更新
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
          assistantMsg.content = payload.content || assistantMsg.content
          assistantMsg.reasoningContent = payload.reasoning || assistantMsg.reasoningContent || ''
          assistantMsg.tokens = payload.tokens || assistantMsg.tokens
          if (payload.toolCalls && payload.toolCalls.length > 0) {
            assistantMsg.toolCalls = JSON.stringify(payload.toolCalls)
          }
          await scrollToBottom()
        },
        onError: (msg) => {
          hasContent = true
          assistantMsg.content += (assistantMsg.content ? '\n\n' : '') + '请求失败：' + msg
        }
      }
    )
    // 完全无内容时移除空占位
    if (!hasContent) {
      messages.value = messages.value.filter((m) => m !== assistantMsg)
    }
    // 刷新会话列表（标题可能已更新）
    await getSessionList()
  } catch (e: any) {
    // 用户主动停止时，保留已生成内容，不报错
    if (e?.name !== 'AbortError') {
      throw e
    }
  } finally {
    sending.value = false
    abortController.value = undefined
    await scrollToBottom()
  }
}

/** 停止生成（取消前端 SSE + 转发 QwenPaw chat/stop） */
const handleStopStream = async () => {
  if (!currentSessionId.value) return
  // 先取消前端 SSE 读取，随后让后端通知 QwenPaw 停止
  abortController.value?.abort()
  try {
    await ChatSessionApi.stopStream(currentSessionId.value)
    message.success('已停止生成')
  } catch {
    message.error('停止生成失败')
  }
}

/** 关闭会话 */
const handleCloseSession = async () => {
  try {
    await message.confirm('确认关闭该会话？关闭后不可继续发送消息')
    await ChatSessionApi.closeSession(currentSessionId.value)
    message.success('会话已关闭')
    await loadCurrentSession()
  } catch {}
}

/** 删除会话 */
const handleDeleteSession = async () => {
  try {
    await message.delConfirm()
    await ChatSessionApi.deleteSession(currentSessionId.value)
    message.success('会话已删除')
    currentSessionId.value = undefined
    currentSession.value = undefined
    messages.value = []
    await getSessionList()
  } catch {}
}

/** 重命名会话 */
const handleRenameSession = async (item: ChatSession) => {
  try {
    const { value } = await message.prompt('请输入新的会话标题', '重命名会话')
    if (!value?.trim()) return
    await ChatSessionApi.renameSession(item.id, value.trim())
    message.success('已重命名')
    item.title = value.trim() // 本地即时更新，避免整表刷新
  } catch {}
}

/** 清空会话消息 */
const handleClearSession = async (item: ChatSession) => {
  try {
    await message.confirm('确认清空该会话的全部消息？该操作不可恢复')
    await ChatSessionApi.clearMessages(item.id)
    message.success('会话已清空')
    if (currentSessionId.value === item.id) {
      messages.value = []
    }
  } catch {}
}

/** 初始化 **/
onMounted(async () => {
  await getMyAgents()
  await getSessionList()
})
</script>
