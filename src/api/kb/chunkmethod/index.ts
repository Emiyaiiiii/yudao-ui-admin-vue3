import request from '@/config/axios'

/** 切片方法信息 */
export interface ChunkMethod {
  id: number
  name: string
  methodType: string
  description?: string
  code: string
  parametersTemplate?: string
  defaultParameters?: string
  handlerClass?: string
  isActive?: number
  isDefaultMethod?: number
  avgProcessingSpeed?: number
  memoryFootprint?: number
  createTime?: string | number
  updateTime?: string | number
}

/** 测试请求参数 */
export interface ChunkMethodTestReq {
  id: number
  testText: string
}

/** 测试结果 */
export interface ChunkMethodTestResult {
  methodId: number
  methodName: string
  testTextLength: number
  chunkCount: number
  processingTimeSeconds: number
  processingSpeedCharsPerSecond: number
  avgChunkSize: number
  chunksPreview: Array<{
    text: string
    size: number
  }>
}

/** 切片方法 API */
export const ChunkMethodApi = {
  // 查询方法分页
  getPage: async (params: any) => {
    return await request.get({ url: `/kb/chunk-method/page`, params })
  },

  // 查询方法详情
  get: async (id: number) => {
    return await request.get({ url: `/kb/chunk-method/get?id=` + id })
  },

  // 新增方法
  create: async (data: ChunkMethod) => {
    return await request.post({ url: `/kb/chunk-method/create`, data })
  },

  // 修改方法
  update: async (data: ChunkMethod) => {
    return await request.put({ url: `/kb/chunk-method/update`, data })
  },

  // 删除方法
  delete: async (id: number) => {
    return await request.delete({ url: `/kb/chunk-method/delete?id=` + id })
  },

  // 测试方法
  test: async (data: ChunkMethodTestReq) => {
    return await request.post({ url: `/kb/chunk-method/test`, data })
  },

  // 设置默认方法
  setDefault: async (id: number) => {
    return await request.post({ url: `/kb/chunk-method/set-default?id=` + id })
  },

  // 批量激活/停用
  batchActivate: async (ids: number[], isActive: boolean) => {
    return await request.post({ url: `/kb/chunk-method/batch-activate?isActive=` + isActive, data: ids })
  },

  // 获取精简列表（下拉选择）
  getSimpleList: async () => {
    return await request.get({ url: `/kb/chunk-method/simple-list` })
  }
}
