import request from '@/config/axios'

/** 知识库关注 API */
export const FollowApi = {
  /** 关注知识库 */
  follow: async (kbId: number) => {
    return await request.post({ url: `/kb/follow/${kbId}` })
  },

  /** 取消关注 */
  unfollow: async (kbId: number) => {
    return await request.delete({ url: `/kb/follow/${kbId}` })
  },

  /** 是否已关注 */
  isFollowing: async (kbId: number) => {
    return await request.get({ url: `/kb/follow/check/${kbId}` })
  },

  /** 我关注的知识库分页 */
  getMyFollowedPage: async (params: any) => {
    return await request.get({ url: `/kb/follow/my-page`, params })
  }
}
