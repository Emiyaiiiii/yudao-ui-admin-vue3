import { ref } from 'vue'

/** 待上传文件项（兼容 el-upload 的 :file-list，另带 folder 的目录相对路径） */
export interface KbUploadItem {
  name: string
  raw: File
  /** 目录层级上传时的相对路径（webkitRelativePath，含文件名）；普通文件为空 */
  relPath?: string
}

/** 普通文件 vs 目录上传的统一收集/上传逻辑，供知识库各上传弹窗复用 */
export function useKbUpload(uploadFn: (formData: FormData) => Promise<any>) {
  const fileItems = ref<KbUploadItem[]>([])
  /** 目录选择 input 引用 */
  const folderInputRef = ref<HTMLInputElement>()

  /** el-upload on-change：收集单文件（兼容拖拽/多选；若文件本身带 webkitRelativePath 则视作目录文件） */
  const handleFileChange = (uploadFile: any) => {
    if (!uploadFile?.raw) return
    const raw = uploadFile.raw as File
    if (fileItems.value.some((i) => i.raw === raw)) return
    const rel = (raw as any).webkitRelativePath || ''
    fileItems.value.push({
      name: rel || raw.name,
      raw,
      relPath: rel || undefined
    })
  }

  /** el-upload on-remove：按文件对象移除 */
  const handleFileRemove = (uploadFile: any) => {
    const raw = uploadFile?.raw
    fileItems.value = fileItems.value.filter((i) => i.raw !== raw)
  }

  /** 打开目录选择（webkitdirectory） */
  const openFolderPicker = () => {
    folderInputRef.value?.click()
  }

  /** 目录 input change：按 webkitRelativePath 逐个收集 */
  const handleFolderChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    const files = input.files
    if (files) {
      for (const raw of Array.from(files)) {
        const rel = (raw as any).webkitRelativePath || ''
        if (!fileItems.value.some((i) => i.raw === raw)) {
          fileItems.value.push({ name: rel || raw.name, raw, relPath: rel || undefined })
        }
      }
    }
    input.value = '' // 允许重复选择同一目录
  }

  const clearFiles = () => {
    fileItems.value = []
  }

  const isEmpty = () => fileItems.value.length === 0

  /**
   * 逐个文件上传；每个文件带相对目录 relPath（后端按需逐级创建子文件夹）
   * @returns 实际上传成功的文件个数
   */
  const uploadAll = async (opts: {
    kbId: number
    folderId?: number | null
    description?: string
    tags?: string
  }) => {
    const list = fileItems.value
    let done = 0
    for (const item of list) {
      const fd = new FormData()
      fd.append('file', item.raw)
      fd.append('kbId', String(opts.kbId))
      if (opts.folderId) fd.append('folderId', String(opts.folderId))
      // 目录层级：取 webkitRelativePath 的目录部分（去掉文件名）
      const relDir = dirnameOf(item.relPath || '')
      if (relDir) fd.append('relPath', relDir)
      if (opts.description) fd.append('description', opts.description)
      if (opts.tags) fd.append('tags', opts.tags)
      await uploadFn(fd)
      done++
    }
    return done
  }

  return {
    fileItems,
    folderInputRef,
    handleFileChange,
    handleFileRemove,
    openFolderPicker,
    handleFolderChange,
    clearFiles,
    isEmpty,
    uploadAll
  }
}

/** 取相对路径的目录部分；"a/b/x.txt" → "a/b"，无目录或根级为空 */
function dirnameOf(relPath: string): string {
  const idx = relPath.lastIndexOf('/')
  return idx > 0 ? relPath.substring(0, idx) : ''
}