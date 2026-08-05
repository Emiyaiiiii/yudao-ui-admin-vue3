import request from '@/config/axios'
import type { Dayjs } from 'dayjs';

/** 知识库分类信息 */
export interface Category {
          id: number; // 主键ID
          name?: string; // 分类名称
          kbLevelId: number; // 关联层级配置ID
          parentId: number; // 父分类ID: 0=顶级分类
          sort: number; // 排序
          status: number; // 状态: 0=启用, 1=禁用
    children?: Category[];
  }

// 知识库分类 API
export const CategoryApi = {
  // 查询知识库分类列表（全部）
  getCategoryList: async (params) => {
    return await request.get({ url: `/kb/category/list`, params })
  },

  // 查询当前用户可见的知识库分类列表（按部门过滤）
  listCategoriesForUser: async () => {
    return await request.get({ url: `/kb/category/list-for-user` })
  },

  // 查询知识库分类详情
  getCategory: async (id: number) => {
    return await request.get({ url: `/kb/category/get?id=` + id })
  },

  // 新增知识库分类
  createCategory: async (data: Category) => {
    return await request.post({ url: `/kb/category/create`, data })
  },

  // 修改知识库分类
  updateCategory: async (data: Category) => {
    return await request.put({ url: `/kb/category/update`, data })
  },

  // 删除知识库分类
  deleteCategory: async (id: number) => {
    return await request.delete({ url: `/kb/category/delete?id=` + id })
  },


  // 导出知识库分类 Excel
  exportCategory: async (params) => {
    return await request.download({ url: `/kb/category/export-excel`, params })
  }
}