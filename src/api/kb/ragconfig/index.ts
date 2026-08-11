import request from '@/config/axios'

/** RAG配置信息 */
export interface RAGConfig {
  id: number
  module: string
  moduleDisplay?: string
  key: string
  value: string
  valueType: 'int' | 'float' | 'bool' | 'str' | 'json'
  valueTypeDisplay?: string
  typedValue: any
  description?: string
  isActive?: number
  sortOrder?: number
  createTime?: string | number
  updateTime?: string | number
}

/** 分页查询参数 */
export interface RAGConfigPageReq {
  pageNo: number
  pageSize: number
  module?: string
  isActive?: number
  search?: string
}

/** 模块信息 */
export interface ModuleInfo {
  code: string
  label: string
  count: number
}

/** 统计信息 */
export interface RAGConfigStatistics {
  totalConfigs: number
  activeConfigs: number
  byModule: Record<string, number>
}

/** RAG配置 API */
export const RAGConfigApi = {
  // 查询配置分页
  getPage: async (params: RAGConfigPageReq) => {
    return await request.get({ url: `/kb/rag-config/page`, params })
  },

  // 查询配置详情
  get: async (id: number) => {
    return await request.get({ url: `/kb/rag-config/get?id=` + id })
  },

  // 新增配置
  create: async (data: any) => {
    return await request.post({ url: `/kb/rag-config/create`, data })
  },

  // 修改配置
  update: async (data: any) => {
    return await request.put({ url: `/kb/rag-config/update`, data })
  },

  // 删除配置
  delete: async (id: number) => {
    return await request.delete({ url: `/kb/rag-config/delete?id=` + id })
  },

  // 批量更新
  batchUpdate: async (configs: any[]) => {
    return await request.post({ url: `/kb/rag-config/batch-update`, data: { configs } })
  },

  // 刷新缓存
  refreshCache: async (module?: string, key?: string) => {
    return await request.post({ url: `/kb/rag-config/refresh-cache`, data: { module, key } })
  },

  // 获取模块列表（含计数）
  getModules: async () => {
    return await request.get({ url: `/kb/rag-config/modules` })
  },

  // 按模块获取配置键值对
  getConfigByModule: async (module: string) => {
    return await request.get({ url: `/kb/rag-config/by-module?module=` + module })
  },

  // 获取统计信息
  getStatistics: async () => {
    return await request.get({ url: `/kb/rag-config/statistics` })
  }
}
