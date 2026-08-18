import request from '@/config/axios'

/** Provider 信息 */
export interface Provider {
  id: string
  name: string
  apiKeyPrefix?: string
  chatModel?: string
  baseUrl?: string
  configured?: boolean
  isCustom?: boolean
  isLocal?: boolean
  supportModelDiscovery?: boolean
  models?: ModelInfo[]
  extraModels?: ModelInfo[]
  raw?: Record<string, any>
}

/** 模型信息 */
export interface ModelInfo {
  id: string
  name: string
  supportsMultimodal?: boolean
  supportsImage?: boolean
  supportsVideo?: boolean
  maxTokens?: number
  maxInputLength?: number
  generateKwargs?: Record<string, any>
  thinkingEnabled?: boolean
  thinkingBudget?: number
  reasoningEffort?: string
}

/** 连接测试结果 */
export interface TestConnectionResult {
  success: boolean
  error?: string
  latencyMs?: number
}

/** 激活模型信息 */
export interface ActiveModel {
  providerId?: string
  model?: string
  scope?: string
  agentId?: string
}

/** 模型管理 API */
export const ModelApi = {
  /** 列出所有 Provider（含模型列表） */
  listProviders: () => {
    return request.get({ url: '/ai-agent/model/provider/list' })
  },

  /** 配置 Provider */
  configureProvider: (data: {
    providerId: string
    apiKey?: string
    baseUrl?: string
    customHeaders?: string
    authMode?: string
  }) => {
    return request.put({ url: '/ai-agent/model/provider/configure', data })
  },

  /** 测试 Provider 连接 */
  testProvider: (providerId: string) => {
    return request.post({ url: '/ai-agent/model/provider/test', params: { providerId } })
  },

  /** 测试模型连接 */
  testModel: (providerId: string, modelId: string) => {
    return request.post({ url: '/ai-agent/model/model/test', params: { providerId, modelId } })
  },

  /** 从 Provider 发现可用模型 */
  discoverModels: (providerId: string) => {
    return request.post({ url: '/ai-agent/model/provider/discover', params: { providerId } })
  },

  /** 添加模型 */
  addModel: (data: {
    providerId: string
    modelId: string
    name: string
    supportsMultimodal?: boolean
    supportsImage?: boolean
    supportsVideo?: boolean
  }) => {
    return request.post({ url: '/ai-agent/model/add', data })
  },

  /** 删除模型 */
  deleteModel: (providerId: string, modelId: string) => {
    return request.delete({ url: '/ai-agent/model/delete', params: { providerId, modelId } })
  },

  /** 配置模型参数 */
  configureModel: (data: {
    providerId: string
    modelId: string
    maxTokens?: number
    maxInputLength?: number
    generateKwargs?: string
    thinkingEnabled?: boolean
    thinkingBudget?: number
    reasoningEffort?: string
  }) => {
    return request.put({ url: '/ai-agent/model/configure', data })
  },

  /** 获取激活模型 */
  getActiveModel: (scope?: string, agentId?: string) => {
    return request.get({ url: '/ai-agent/model/active', params: { scope, agentId } })
  },

  /** 设置激活模型 */
  setActiveModel: (data: {
    scope: string
    providerId: string
    model: string
    agentId?: string
  }) => {
    return request.put({ url: '/ai-agent/model/active', data })
  },

  /** 创建自定义 Provider */
  createCustomProvider: (data: Record<string, any>) => {
    return request.post({ url: '/ai-agent/model/custom-provider', data })
  },

  /** 删除自定义 Provider */
  deleteCustomProvider: (providerId: string) => {
    return request.delete({ url: '/ai-agent/model/custom-provider', params: { providerId } })
  },

  /** 获取所有可用模型（扁平列表） */
  listAllModels: () => {
    return request.get({ url: '/ai-agent/model/all' })
  }
}
