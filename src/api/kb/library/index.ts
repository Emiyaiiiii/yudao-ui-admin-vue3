import request from '@/config/axios'

/** 知识库信息 */
export interface Library {
  id: number // 主键ID
  name?: string // 知识库名称
  categoryId?: number // 分类ID
  kbLevelId: number // 关联层级配置ID
  ownerId: number // 所有者ID: 用户或部门, 取决于层级配置的owner_dim
  description: string // 描述
  coverUrl: string // 封面图片URL
  docCount: number // 文档数量
  status: number // 状态: 0=启用, 1=禁用
  isPublic?: number // 是否公开到广场: 0=否, 1=是
  isProject?: number // 是否项目成果库: 0=否, 1=是
  shareDeptIds?: number[] // 共享部门ID列表
}

// 知识库 API
export const LibraryApi = {
  // 查询知识库分页
  getLibraryPage: async (params: any) => {
    return await request.get({ url: `/kb/library/page`, params })
  },

  // 查询知识库详情
  getLibrary: async (id: number) => {
    return await request.get({ url: `/kb/library/get?id=` + id })
  },

  // 新增知识库
  createLibrary: async (data: Library) => {
    return await request.post({ url: `/kb/library/create`, data })
  },

  // 修改知识库
  updateLibrary: async (data: Library) => {
    return await request.put({ url: `/kb/library/update`, data })
  },

  // 删除知识库
  deleteLibrary: async (id: number) => {
    return await request.delete({ url: `/kb/library/delete?id=` + id })
  },

  /** 批量删除知识库 */
  deleteLibraryList: async (ids: number[]) => {
    return await request.delete({ url: `/kb/library/delete-list?ids=${ids.join(',')}` })
  },

  // 导出知识库 Excel
  exportLibrary: async (params) => {
    return await request.download({ url: `/kb/library/export-excel`, params })
  },

  /** 切换公开状态 */
  togglePublic: async (id: number) => {
    return await request.put({ url: `/kb/library/toggle-public?id=${id}` })
  },

  /** 广场公开知识库分页 */
  getPublicPage: async (params: any) => {
    return await request.get({ url: `/kb/library/public-page`, params })
  },

  /** 我公开的知识库分页 */
  getMyPublicPage: async (params: any) => {
    return await request.get({ url: `/kb/library/my-public-page`, params })
  },

  /** 获得知识库精简列表（用于下拉选择） */
  getSimpleLibraryList: async (isProject?: number) => {
    return await request.get({ url: `/kb/library/simple-list`, params: { isProject } })
  },

  /** 检查当前用户是否有该知识库的管理权限 */
  canManage: async (kbId: number) => {
    return await request.get({ url: `/kb/library/can-manage`, params: { kbId } })
  }
}
