import request from '@/config/axios'

/** 标签信息 */
export interface Tag {
  id: number
  name: string
  color: string
  type: string
  ownerId: number | null
  ownerNickname?: string
  createTime: number
  updateTime: number
}

/** 标签分页查询参数 */
export interface TagPageParams {
  pageNo: number
  pageSize: number
  name?: string
  type?: string
  scope?: string
}

// 标签 API
export const TagApi = {
  // 分页查询标签
  getPage: async (params: TagPageParams) => {
    return await request.get({ url: '/kb/tag/page', params })
  },

  // 创建标签
  createTag: async (data: any) => {
    return await request.post({ url: '/kb/tag/create', data })
  },

  // 更新标签
  updateTag: async (data: any) => {
    return await request.put({ url: '/kb/tag/update', data })
  },

  // 删除标签
  deleteTag: async (id: number) => {
    return await request.delete({ url: '/kb/tag/delete?id=' + id })
  },

  // 获取标签详情
  getTag: async (id: number) => {
    return await request.get({ url: '/kb/tag/get?id=' + id })
  }
}
