// AI 模块通用枚举
// 取值与后端 AiModelTypeEnum 及字典 ai_model_type 对齐

export enum AiModelTypeEnum {
  CHAT = 1, // 对话模型
  EMBEDDING = 2, // 向量模型
  RERANK = 3, // 重排序模型
  IMAGE = 4 // 图片生成模型
}