import request from '@/config/axios'

/** 知识库项目成员信息 */
export interface ProjectMember {
  id: number // 主键ID
  kbId?: number // 知识库ID
  userId?: number // 项目成员用户ID
  nickname?: string // 用户昵称
  createTime?: Date // 创建时间
}

// 知识库项目成员 API
export const ProjectMemberApi = {
  // 获取项目成员列表
  getMemberList: async (kbId: number) => {
    return await request.get({ url: `/kb/project-member/list`, params: { kbId } })
  },

  // 添加项目成员
  addMember: async (kbId: number, userId: number) => {
    return await request.post({ url: `/kb/project-member/add`, params: { kbId, userId } })
  },

  // 移除项目成员
  removeMember: async (kbId: number, userId: number) => {
    return await request.delete({ url: `/kb/project-member/remove`, params: { kbId, userId } })
  },

  // 检查当前用户是否为项目成员
  checkMember: async (kbId: number, userId?: number) => {
    return await request.get({ url: `/kb/project-member/check`, params: { kbId, userId } })
  }
}
