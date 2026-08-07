import request from '@/config/axios'

/** 大模型配置信息 */
export interface ModelConfig {
  id: number // 主键ID
  uid: string // 模型唯一标识
  name: string // 模型名称
  url: string // API地址
  appkey: string // API密钥
  deploy: string // 部署类型
  thinkingEnabled?: number // 是否启用思考能力: 0=否, 1=是
  isActive?: number // 是否激活: 0=停用, 1=激活
  description?: string // 模型描述
  maxTokens?: number // 最大Token数
  contextLength?: number // 上下文长度
  temperature?: number // 温度参数
  topP?: number // Top-P参数
  metadata?: string // 元数据(JSON格式)
  config?: string // 配置参数(JSON格式)
  sortOrder?: number // 排序顺序
  isPinned?: number // 是否置顶
  platform?: string // 支持平台
  activatedAt?: string | number // 激活时间（yudao 默认序列化为时间戳数字）
  createTime?: string | number // 创建时间（yudao 默认序列化为时间戳数字）
}

/** 测试请求参数 */
export interface ModelConfigTestReq {
  id: number
  testMessage?: string
  temperature?: number
  maxTokens?: number
}

/** 测试结果 */
export interface ModelConfigTestResult {
  configId: number
  name: string
  testMessage: string
  success: boolean
  responseTime: number
  response?: string
  error?: string
  modelInfo: {
    name: string
    uid: string
    deploy: string
    url: string
    maxTokens: number
    temperature: number
    thinkingSupported: number
    isActive: number
  }
}

/** 复制请求参数 */
export interface ModelConfigCopyReq {
  id: number
  newName: string
  newUid: string
  isActive?: number
}

/** 批量操作请求参数 */
export interface ModelConfigBatchReq {
  ids: number[]
  action: 'activate' | 'deactivate' | 'delete'
}

/** 统计信息 */
export interface ModelConfigStatistics {
  totalConfigs: number
  activeConfigs: number
  totalUsage: number
  statistics: Array<{
    configId: number
    name: string
    deploy: string
    isActive: number
    usageCount: number
    totalSessions: number
    lastUsed?: string
    createTime?: string
    description?: string
  }>
}

/** 大模型配置 API */
export const ModelConfigApi = {
  // 查询配置分页
  getPage: async (params: any) => {
    return await request.get({ url: `/kb/model-config/page`, params })
  },

  // 查询配置详情
  get: async (id: number) => {
    return await request.get({ url: `/kb/model-config/get?id=` + id })
  },

  // 新增配置
  create: async (data: ModelConfig) => {
    return await request.post({ url: `/kb/model-config/create`, data })
  },

  // 修改配置
  update: async (data: ModelConfig) => {
    return await request.put({ url: `/kb/model-config/update`, data })
  },

  // 删除配置
  delete: async (id: number) => {
    return await request.delete({ url: `/kb/model-config/delete?id=` + id })
  },

  // 激活配置
  activate: async (id: number) => {
    return await request.post({ url: `/kb/model-config/activate?id=` + id })
  },

  // 停用配置
  deactivate: async (id: number) => {
    return await request.post({ url: `/kb/model-config/deactivate?id=` + id })
  },

  // 测试连接
  test: async (data: ModelConfigTestReq) => {
    return await request.post({ url: `/kb/model-config/test`, data })
  },

  // 复制配置
  copy: async (data: ModelConfigCopyReq) => {
    return await request.post({ url: `/kb/model-config/copy`, data })
  },

  // 设置默认配置
  setDefault: async (id: number) => {
    return await request.post({ url: `/kb/model-config/set-default?id=` + id })
  },

  // 批量操作
  batch: async (data: ModelConfigBatchReq) => {
    return await request.post({ url: `/kb/model-config/batch`, data })
  },

  // 获取统计信息
  getStatistics: async () => {
    return await request.get({ url: `/kb/model-config/statistics` })
  },

  // 获取精简列表（下拉选择）
  getSimpleList: async () => {
    return await request.get({ url: `/kb/model-config/simple-list` })
  },

  // 导出 Excel
  exportExcel: async (params: any) => {
    return await request.download({ url: `/kb/model-config/export-excel`, params })
  }
}
