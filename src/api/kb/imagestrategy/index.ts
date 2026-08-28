import request from '@/config/axios'

/** 图片处理方案：全局默认方案读写 */
export const ImageStrategyApi = {
  // 获取全局默认图片处理方案
  getDefault: async () => {
    return await request.get({ url: '/kb/image-strategy/default' })
  },
  // 设置全局默认图片处理方案
  setDefault: async (imageStrategy: string) => {
    return await request.post({ url: '/kb/image-strategy/default', params: { imageStrategy } })
  }
}