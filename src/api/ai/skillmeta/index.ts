import request from '@/config/axios'

/** Skills 商店项（Java 侧元数据，对应 QwenPaw 技能池） */
export interface SkillMeta {
  id: number
  skillName: string
  displayName: string
  description?: string
  icon?: string
  source?: string // builtin / customized
  version?: string
  visibility?: number // 0=个人, 1=公开
  ownerUserId?: number
  tags?: string // JSON 数组字符串
  status?: number // 0=停用, 1=启用
  createTime?: string
}

/** Skills 商店 API（Java 侧元数据管理 + QwenPaw 技能池对接） */
export const SkillMetaApi = {
  // 创建技能商店项（仅 Java 侧元数据）
  createSkillMeta: async (data: SkillMeta) => {
    return await request.post({ url: '/ai-agent/skill-meta/create', data })
  },
  // 更新技能商店项（icon/可见性/描述等）
  updateSkillMeta: async (data: SkillMeta) => {
    return await request.put({ url: '/ai-agent/skill-meta/update', data })
  },
  // 删除技能商店项（同时从 QwenPaw 技能池删除）
  deleteSkillMeta: async (id: number) => {
    return await request.delete({ url: '/ai-agent/skill-meta/delete?id=' + id })
  },
  // 获得技能商店项详情
  getSkillMeta: async (id: number) => {
    return await request.get({ url: '/ai-agent/skill-meta/get?id=' + id })
  },
  // 获得技能商店分页（管理后台用）
  getSkillMetaPage: async (params: {
    source?: string
    visibility?: number
    status?: number
    search?: string
    pageNo?: number
    pageSize?: number
  }) => {
    return await request.get({ url: '/ai-agent/skill-meta/page', params })
  },
  // 获得当前用户可见的技能列表（公开 + 自己的个人技能）
  getVisibleSkillMetaList: async () => {
    return await request.get({ url: '/ai-agent/skill-meta/visible-list' })
  },
  // 上传 zip 到 QwenPaw 技能池并创建 Java 侧元数据
  uploadSkill: async (data: {
    file: File
    targetName?: string
    displayName?: string
    description?: string
    icon?: string
    visibility?: number
    tags?: string
  }) => {
    const formData = new FormData()
    formData.append('file', data.file)
    if (data.targetName) formData.append('targetName', data.targetName)
    if (data.displayName) formData.append('displayName', data.displayName)
    if (data.description) formData.append('description', data.description)
    if (data.icon) formData.append('icon', data.icon)
    if (data.visibility !== undefined) formData.append('visibility', String(data.visibility))
    if (data.tags) formData.append('tags', data.tags)
    return await request.upload({ url: '/ai-agent/skill-meta/upload', data: formData })
  }
}
