import request from '@/config/axios'

/** 文档文件夹信息 */
export interface Folder {
  id: number
  kbId: number
  name: string
  parentId: number
  sort: number
  children?: Folder[]
  createTime: string
}

// 文档文件夹 API
export const FolderApi = {
  // 创建文件夹
  createFolder: async (data: { kbId: number; name: string; parentId?: number; sort?: number }) => {
    return await request.post({ url: `/kb/document-folder/create`, data })
  },

  // 更新文件夹（重命名）
  updateFolder: async (data: { id: number; name: string; parentId?: number; sort?: number }) => {
    return await request.put({ url: `/kb/document-folder/update`, data })
  },

  // 删除文件夹
  deleteFolder: async (id: number) => {
    return await request.delete({ url: `/kb/document-folder/delete?id=` + id })
  },

  // 获取文件夹详情
  getFolder: async (id: number) => {
    return await request.get({ url: `/kb/document-folder/get?id=` + id })
  },

  // 获取指定知识库的文件夹树
  getFolderTree: async (kbId: number) => {
    return await request.get({ url: `/kb/document-folder/list-tree?kbId=` + kbId })
  }
}