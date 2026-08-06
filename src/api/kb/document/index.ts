import request from '@/config/axios'

/** 知识库文件信息 */
export interface Document {
          id: number; // 主键ID
          kbId?: number; // 所属知识库ID
          fileName?: string; // 文件名称
          fileUrl?: string; // 文件访问URL
          fileType: string; // 文件类型
          fileSize: number; // 文件大小(字节)
          fileConfigId: number; // 芋道文件配置ID
          filePath: string; // 文件存储路径
          description: string; // 文件描述
          tags: string; // 标签 (逗号分隔)
          downloadCount: number; // 下载次数
          viewCount: number; // 查看次数
          status: number; // 状态: 0=正常, 1=禁用
          vectorTaskId?: string; // 向量处理任务ID
          vectorStatus?: number; // 向量处理状态: 0=待处理 1=处理中 2=已完成 3=失败 4=提交失败 5=超时 6=已取消
  }

// 知识库文件 API
export const DocumentApi = {
  // 查询知识库文件分页
  getDocumentPage: async (params: any) => {
    return await request.get({ url: `/kb/document/page`, params })
  },

  // 查询知识库文件详情
  getDocument: async (id: number) => {
    return await request.get({ url: `/kb/document/get?id=` + id })
  },

  // 上传文件到知识库（自动创建文档记录，自动获取文件名/类型/大小）
  uploadDocument: async (data: FormData) => {
    return await request.upload({ url: `/kb/document/upload`, data })
  },

  // 修改知识库文件
  updateDocument: async (data: Document) => {
    return await request.put({ url: `/kb/document/update`, data })
  },

  // 删除知识库文件
  deleteDocument: async (id: number) => {
    return await request.delete({ url: `/kb/document/delete?id=` + id })
  },

  /** 批量删除知识库文件 */
  deleteDocumentList: async (ids: number[]) => {
    return await request.delete({ url: `/kb/document/delete-list?ids=${ids.join(',')}` })
  },

  // 导出知识库文件 Excel
  exportDocument: async (params) => {
    return await request.download({ url: `/kb/document/export-excel`, params })
  }
}