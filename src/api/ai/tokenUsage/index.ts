import request from '@/config/axios'

/** Token 用量查询参数 */
export interface TokenUsageQuery {
  startDate?: string
  endDate?: string
  model?: string
  provider?: string
}

/** 按模型维度的用量 */
export interface TokenUsageByModel {
  provider_id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  call_count: number
}

/** 按日期维度的用量 */
export interface TokenUsageByDate {
  prompt_tokens: number
  completion_tokens: number
  call_count: number
}

/** Token 用量汇总 */
export interface TokenUsageSummary {
  total_prompt_tokens: number
  total_completion_tokens: number
  total_calls: number
  by_model: Record<string, TokenUsageByModel>
  by_date: Record<string, TokenUsageByDate>
}

/** Token 用量明细记录 */
export interface TokenUsageRecord {
  date: string
  provider_id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  call_count: number
}

/** Token 用量统计 API */
export const TokenUsageApi = {
  // 获得 Token 用量汇总
  getSummary: async (params: TokenUsageQuery) => {
    return await request.get({ url: '/ai-agent/token-usage/summary', params })
  },
  // 获得 Token 用量明细
  getDetails: async (params: TokenUsageQuery) => {
    return await request.get({ url: '/ai-agent/token-usage/details', params })
  }
}
