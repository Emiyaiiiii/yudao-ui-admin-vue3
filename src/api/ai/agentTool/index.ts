import request from '@/config/axios'

/** 内置工具信息 */
export interface AgentTool {
  name: string
  enabled: boolean
  description?: string
  asyncExecution?: boolean
  icon?: string
  requiresConfig?: boolean
  configFields?: AgentToolConfigField[]
  configValues?: Record<string, any>
  /** 前端临时字段：切换中 */
  _toggling?: boolean
}

/** 工具配置字段定义 */
export interface AgentToolConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'textarea'
  required?: boolean
  placeholder?: string
  help?: string
  options?: string[]
  default?: any
  min?: number
  max?: number
}

/** 内置工具 API */
export const AgentToolApi = {
  // 获得智能体内置工具列表
  listTools: async (agentId: number) => {
    return await request.get({ url: '/ai-agent/agent-tool/list?agentId=' + agentId })
  },
  // 切换内置工具启用状态
  toggleTool: async (agentId: number, toolName: string) => {
    return await request.put({ url: `/ai-agent/agent-tool/toggle?agentId=${agentId}&toolName=${encodeURIComponent(toolName)}` })
  },
  // 获得内置工具配置
  getConfig: async (agentId: number, toolName: string) => {
    return await request.get({ url: `/ai-agent/agent-tool/config?agentId=${agentId}&toolName=${encodeURIComponent(toolName)}` })
  },
  // 更新内置工具配置
  updateConfig: async (agentId: number, toolName: string, config: Record<string, any>) => {
    return await request.post({ url: '/ai-agent/agent-tool/config', data: { agentId, toolName, config } })
  }
}
