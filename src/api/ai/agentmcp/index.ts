import request from '@/config/axios'

/** 智能体-MCP 绑定 */
export interface AgentMcp {
  id: number
  agentId: number
  mcpMetaId: number
  clientKey?: string
  configOverride?: string
  toolsWhitelist?: string
  enabled?: number
  sortOrder?: number
  createTime?: string
  /** 冗余展示字段 */
  mcpName?: string
  mcpCode?: string
  transport?: string
}

/** 智能体-MCP 绑定 API */
export const AgentMcpApi = {
  // 创建绑定
  createAgentMcp: async (data: AgentMcp) => {
    return await request.post({ url: '/ai-agent/agent-mcp/create', data })
  },
  // 更新绑定
  updateAgentMcp: async (data: AgentMcp) => {
    return await request.put({ url: '/ai-agent/agent-mcp/update', data })
  },
  // 删除绑定
  deleteAgentMcp: async (id: number) => {
    return await request.delete({ url: '/ai-agent/agent-mcp/delete?id=' + id })
  },
  // 获得绑定详情
  getAgentMcp: async (id: number) => {
    return await request.get({ url: '/ai-agent/agent-mcp/get?id=' + id })
  },
  // 获得绑定分页
  getAgentMcpPage: async (params: any) => {
    return await request.get({ url: '/ai-agent/agent-mcp/page', params })
  },
  // 获得某智能体的绑定列表
  getAgentMcpList: async (agentId: number) => {
    return await request.get({ url: '/ai-agent/agent-mcp/list?agentId=' + agentId })
  },
  // 启停绑定
  toggleAgentMcp: async (id: number) => {
    return await request.put({ url: '/ai-agent/agent-mcp/toggle?id=' + id })
  }
}
