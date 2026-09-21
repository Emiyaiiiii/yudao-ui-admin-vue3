import request from '@/config/axios'

/** 切片信息（对齐 python-vector GET /documents/{id}/chunks 返回字段） */
export interface ChunkItem {
  chunkId: string // 复合标识 {document_id}_{chunk_index}
  documentId?: number
  chunkIndex?: number
  content?: string
  contentHash?: string
  chunkRole?: string // text / parent
  isParent?: boolean
  isChild?: boolean
  parentChunkIndex?: number
  isImage?: boolean
  tokenCount?: number
  charCount?: number
  tags?: string[]
  keyPhrases?: string[]
  recallWeight?: number
  isActive?: boolean
  parentFilenodeId?: number
  documentTitle?: string
  documentType?: string
  contextHeader?: string
  questions?: string[]
  createdAt?: string
  updatedAt?: string
  revision?: number // 当前版本号（乐观锁，0=从未编辑）
}

/** 切片修订记录 */
export interface ChunkRevision {
  id?: number
  chunkId?: string
  revision?: number
  content?: string
  contentHash?: string
  editorId?: number
  editorName?: string
  changeType?: string // edit / revert
  createTime?: string
}

/** 切片编辑请求 */
export interface ChunkUpdateData {
  kbId: number
  documentId: number
  chunkIndex: number
  content: string
  expectedRevision: number
}

/** 切片回滚请求 */
export interface ChunkRevertData {
  kbId: number
  documentId: number
  chunkIndex: number
  targetRevision: number
  expectedRevision: number
}

// 切片编辑与修订 API（#7）
export const ChunkApi = {
  /** 列出文档全部切片 */
  listChunks: async (docId: number, kbId: number): Promise<ChunkItem[]> => {
    const data = await request.get({ url: `/kb/chunk/list`, params: { docId, kbId } })
    return data as ChunkItem[]
  },

  /** 编辑切片（乐观锁 + 重嵌入双写 + 落修订） */
  updateChunk: async (data: ChunkUpdateData): Promise<number> => {
    return await request.put({ url: `/kb/chunk/update`, data })
  },

  /** 查询切片修订历史（倒序） */
  listRevisions: async (docId: number, chunkIndex: number): Promise<ChunkRevision[]> => {
    const data = await request.get({
      url: `/kb/chunk/revisions`,
      params: { docId, chunkIndex }
    })
    return data as ChunkRevision[]
  },

  /** 回滚切片到指定版本 */
  revertChunk: async (data: ChunkRevertData): Promise<number> => {
    return await request.put({ url: `/kb/chunk/revert`, data })
  }
}
