import request from '@/config/axios'

/** MCP 商店项 */
export interface McpMeta {
  id: number
  name: string
  code: string
  type?: number
  transport: string
  url?: string
  command?: string
  args?: string
  env?: string
  headers?: string
  toolsWhitelist?: string
  description?: string
  icon?: string
  status?: number
  sortOrder?: number
  createTime?: string
}

/** MCP 商店 API */
export const McpMetaApi = {
  // 创建 MCP 商店项
  createMcpMeta: async (data: McpMeta) => {
    return await request.post({ url: '/ai-agent/mcp-meta/create', data })
  },
  // 更新 MCP 商店项
  updateMcpMeta: async (data: McpMeta) => {
    return await request.put({ url: '/ai-agent/mcp-meta/update', data })
  },
  // 删除 MCP 商店项
  deleteMcpMeta: async (id: number) => {
    return await request.delete({ url: '/ai-agent/mcp-meta/delete?id=' + id })
  },
  // 获得 MCP 商店项详情
  getMcpMeta: async (id: number) => {
    return await request.get({ url: '/ai-agent/mcp-meta/get?id=' + id })
  },
  // 获得 MCP 商店分页
  getMcpMetaPage: async (params: any) => {
    return await request.get({ url: '/ai-agent/mcp-meta/page', params })
  },
  // 获得启用的 MCP 商店项列表
  getEnabledMcpMetaList: async () => {
    return await request.get({ url: '/ai-agent/mcp-meta/list-enabled' })
  }
}
