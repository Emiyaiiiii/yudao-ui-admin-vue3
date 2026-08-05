import request from '@/config/axios'

/** 知识库用户部门关联信息 */
export interface UserDept {
  id: number // 主键ID
  userId?: number // 用户ID
  deptId?: number // 部门ID
  deptName?: string // 部门名称（包含子部门时显示）
  nickname?: string // 用户昵称
  role?: number // 角色: 0=成员, 1=管理员
  createTime?: Date // 创建时间
}

// 知识库用户部门关联 API
export const UserDeptApi = {
  // 获取部门下所有关联用户（旧接口，保留兼容）
  getDeptMemberList: async (deptId: number) => {
    return await request.get({ url: `/kb/user-dept/list-by-dept`, params: { deptId } })
  },

  // 分页获取部门成员（支持包含子部门）
  getDeptMemberPage: async (params: {
    deptId: number
    includeChildren?: boolean
    pageNo: number
    pageSize: number
  }) => {
    return await request.get({ url: `/kb/user-dept/page`, params })
  },

  // 添加成员
  addMember: async (userId: number, deptId: number) => {
    return await request.post({ url: `/kb/user-dept/add-member`, params: { userId, deptId } })
  },

  // 添加管理员
  addAdmin: async (userId: number, deptId: number) => {
    return await request.post({ url: `/kb/user-dept/add-admin`, params: { userId, deptId } })
  },

  // 移除用户与部门的关联
  remove: async (userId: number, deptId: number) => {
    return await request.delete({ url: `/kb/user-dept/remove`, params: { userId, deptId } })
  },

  // 设置用户角色（成员/管理员切换）
  setRole: async (userId: number, deptId: number, role: number) => {
    return await request.put({ url: `/kb/user-dept/set-role`, params: { userId, deptId, role } })
  },

  // 获取当前用户作为管理员的所有部门ID
  getMyAdminDepts: async () => {
    return await request.get({ url: `/kb/user-dept/my-admin-depts` })
  }
}
