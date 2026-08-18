import request from '@/config/axios'

/** 智能体 */
export interface Agent {
  id: number
  userId?: number
  name: string
  description?: string
  avatar?: string
  modelProvider?: string
  modelName: string
  systemPrompt?: string
  enableKbTool?: boolean
  status?: number
  sortOrder?: number
  qwenpawAgentId?: string
  /** 初始技能（仅创建时生效，从 QwenPaw 技能池按 name 安装） */
  initialSkills?: string[]
  /** 运行状态（仅前端展示使用，由 getStatus 填充） */
  _running?: boolean
  createTime?: string
}

/** 智能体 API */
export const AgentApi = {
  // 创建智能体
  createAgent: async (data: Agent) => {
    return await request.post({ url: '/ai-agent/agent/create', data })
  },
  // 更新智能体
  updateAgent: async (data: Agent) => {
    return await request.put({ url: '/ai-agent/agent/update', data })
  },
  // 删除智能体
  deleteAgent: async (id: number) => {
    return await request.delete({ url: '/ai-agent/agent/delete?id=' + id })
  },
  // 获得智能体详情
  getAgent: async (id: number) => {
    return await request.get({ url: '/ai-agent/agent/get?id=' + id })
  },
  // 获得智能体分页
  getAgentPage: async (params: any) => {
    return await request.get({ url: '/ai-agent/agent/page', params })
  },
  // 启停智能体
  toggleAgent: async (id: number) => {
    return await request.put({ url: '/ai-agent/agent/toggle?id=' + id })
  },
  // 获得当前用户的智能体列表
  getMyAgents: async () => {
    return await request.get({ url: '/ai-agent/agent/my' })
  }
}
