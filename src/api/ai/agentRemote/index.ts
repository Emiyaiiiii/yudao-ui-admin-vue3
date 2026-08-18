import request from '@/config/axios'

/** 智能体运行状态 */
export interface AgentStatus {
  running?: boolean
  status?: string
  [key: string]: any
}

/** QwenPaw 侧注册的 MCP 服务 */
export interface RemoteMcp {
  client_key?: string
  name?: string
  transport?: string
  enabled?: boolean
  [key: string]: any
}

/** MCP 工具 */
export interface McpTool {
  name?: string
  description?: string
  [key: string]: any
}

/** QwenPaw 侧安装的 Skill */
export interface RemoteSkill {
  skill_key?: string
  name?: string
  version?: string
  enabled?: boolean
  [key: string]: any
}

/** QwenPaw 全局技能池中的技能 */
export interface SkillPoolItem {
  name?: string
  source?: string
  version_text?: string
  enabled?: boolean
  description?: string
  [key: string]: any
}

/** 注册 MCP 配置 */
export interface RegisterMcpReq {
  agentId: number
  clientKey: string
  transport?: string
  url?: string
  command?: string
  commandArgs?: string
  headersJson?: string
  toolsJson?: string
}

/** 智能体远程能力 API（透传 QwenPaw） */
export const AgentRemoteApi = {
  // 获得智能体运行状态
  getStatus: async (agentId: number) => {
    return await request.get({ url: '/ai-agent/agent-remote/status', params: { agentId } })
  },
  // 获得智能体在 QwenPaw 侧注册的 MCP 列表
  listMcps: async (agentId: number) => {
    return await request.get({ url: '/ai-agent/agent-remote/mcp/list', params: { agentId } })
  },
  // 切换智能体在 QwenPaw 侧 MCP 启用状态
  toggleMcp: async (agentId: number, clientKey: string) => {
    return await request.put({ url: '/ai-agent/agent-remote/mcp/toggle', params: { agentId, clientKey } })
  },
  // 获得智能体某个 MCP 的工具列表
  listMcpTools: async (agentId: number, clientKey: string) => {
    return await request.get({ url: '/ai-agent/agent-remote/mcp/tools', params: { agentId, clientKey } })
  },
  // 获得智能体在 QwenPaw 侧安装的 Skills 列表
  listSkills: async (agentId: number) => {
    return await request.get({ url: '/ai-agent/agent-remote/skills', params: { agentId } })
  },
  // 列出 QwenPaw 全局技能池
  listSkillPool: async () => {
    return await request.get({ url: '/ai-agent/agent-remote/skill-pool' })
  },
  // 获得技能池中某个技能的详情
  getSkillPoolDetail: async (skillName: string) => {
    return await request.get({ url: `/ai-agent/agent-remote/skill-pool/${encodeURIComponent(skillName)}` })
  },
  // 从技能池安装技能到智能体
  installSkill: async (agentId: number, skillName: string) => {
    return await request.post({
      url: '/ai-agent/agent-remote/skill/install',
      params: { agentId, skillName }
    })
  },
  // 卸载智能体上安装的技能
  uninstallSkill: async (agentId: number, skillName: string) => {
    return await request.delete({
      url: '/ai-agent/agent-remote/skill',
      params: { agentId, skillName }
    })
  },
  // 注册 MCP 到智能体（QwenPaw 侧）
  registerMcp: async (data: RegisterMcpReq) => {
    return await request.post({ url: '/ai-agent/agent-remote/mcp/register', params: data })
  },
  // 删除智能体上的 MCP 注册
  deleteMcp: async (agentId: number, clientKey: string) => {
    return await request.delete({
      url: '/ai-agent/agent-remote/mcp',
      params: { agentId, clientKey }
    })
  }
}
