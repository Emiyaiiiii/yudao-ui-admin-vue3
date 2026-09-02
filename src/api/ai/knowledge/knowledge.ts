import request from '@/config/axios'

// 知识库精简 VO（对应后端 LibrarySimpleVO）
export interface KnowledgeVO {
  id: number // 主键ID
  name: string // 知识库名称
  isProject?: number // 是否项目成果库: 0=否, 1=是
  categoryId?: number // 所属分类ID
}

// 知识库 API
export const KnowledgeApi = {
  // 获取知识库精简列表
  getSimpleKnowledgeList: async () => {
    return await request.get({ url: `/kb/library/simple-list` })
  }
}