<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      v-loading="formLoading"
    >
      <!-- ========== 新增模式：上传文件，自动获取文件信息 ========== -->
      <template v-if="formType === 'create'">
        <el-form-item label="所属知识库" prop="kbId">
          <el-select v-model="formData.kbId" placeholder="请选择知识库" filterable style="width: 100%" @change="handleKbChange">
            <el-option v-for="item in libraryOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属文件夹" prop="folderId">
          <el-tree-select
            v-model="formData.folderId"
            :data="folderTreeOptions"
            :props="{ label: 'name', value: 'id', children: 'children' }"
            placeholder="请选择文件夹（可选，默认根目录）"
            clearable
            filterable
            style="width: 100%"
            :disabled="!formData.kbId"
          />
        </el-form-item>
        <el-form-item label="上传文件" required>
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :on-exceed="handleExceed"
            drag
          >
            <Icon icon="ep:upload-filled" class="el-icon--upload" />
            <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
            <template #tip>
              <div class="el-upload__tip">
                支持 PDF、Word、Excel、PPT、图片、压缩包等格式
              </div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="文件描述">
          <el-input v-model="formData.description" type="textarea" :rows="2" placeholder="请输入文件描述（可选）" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="formData.tags" placeholder="多个标签用逗号分隔（可选）" />
        </el-form-item>
      </template>

      <!-- ========== 编辑模式：修改文件描述/标签/状态 ========== -->
      <template v-else>
        <el-form-item label="所属知识库">
          <el-input :model-value="libraryName" disabled />
        </el-form-item>
        <el-form-item label="文件名称">
          <el-input :model-value="formData.fileName" disabled />
        </el-form-item>
        <el-form-item label="文件类型">
          <el-input :model-value="formData.fileType" disabled />
        </el-form-item>
        <el-form-item label="文件大小">
          <el-input :model-value="formatSize(formData.fileSize)" disabled />
        </el-form-item>
        <el-form-item label="文件链接">
          <el-link v-if="formData.fileUrl" :href="formData.fileUrl" target="_blank" type="primary">
            {{ formData.fileName || '查看文件' }}
          </el-link>
          <span v-else>—</span>
        </el-form-item>
        <el-form-item label="文件描述">
          <el-input v-model="formData.description" type="textarea" :rows="2" placeholder="请输入文件描述" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="formData.tags" placeholder="多个标签用逗号分隔" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="formData.status">
            <el-radio :value="0">正常</el-radio>
            <el-radio :value="1">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="submitForm" type="primary" :disabled="formLoading">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { DocumentApi, Document } from '@/api/kb/document'
import { LibraryApi } from '@/api/kb/library'
import { FolderApi } from '@/api/kb/folder'

/** 知识库文件 表单 */
defineOptions({ name: 'DocumentForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref({
  id: undefined,
  kbId: undefined,
  fileName: undefined,
  fileUrl: undefined,
  fileType: undefined,
  fileSize: undefined,
  fileConfigId: undefined,
  filePath: undefined,
  description: undefined,
  tags: undefined,
  downloadCount: undefined,
  viewCount: undefined,
  status: 0
})
const formRules = reactive({
  kbId: [{ required: true, message: '请选择知识库', trigger: 'change' }]
})
const formRef = ref() // 表单 Ref

// 知识库选项
const libraryOptions = ref<any[]>([])
const libraryMap = ref<Record<number, string>>({})

// 文件夹树选项
const folderTreeOptions = ref<any[]>([])

/** 加载文件夹树 */
const loadFolderTree = async (kbId: number) => {
  if (!kbId) {
    folderTreeOptions.value = []
    return
  }
  try {
    const tree = await FolderApi.getFolderTree(kbId)
    folderTreeOptions.value = tree || []
  } catch {
    folderTreeOptions.value = []
  }
}

/** 知识库选择变化时，加载文件夹树 */
const handleKbChange = (kbId: number) => {
  formData.value.folderId = undefined
  loadFolderTree(kbId)
}

/** 当前知识库名称（编辑模式） */
const libraryName = computed(() => {
  return libraryMap.value[formData.value.kbId] || ''
})

// 上传文件相关
const uploadRef = ref()
const selectedFile = ref<File | null>(null)

/** 文件选择变化 */
const handleFileChange = (file: any) => {
  selectedFile.value = file.raw
  // 清除文件校验错误
  formRef.value?.clearValidate('file')
}

/** 文件移除 */
const handleFileRemove = () => {
  selectedFile.value = null
}

/** 超出限制 */
const handleExceed = () => {
  message.warning('只能上传一个文件，请先移除已选文件')
}

/** 格式化文件大小 */
const formatSize = (size: number): string => {
  if (!size) return '—'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB'
  return (size / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = type === 'create' ? '上传文件' : t('action.' + type)
  formType.value = type
  resetForm()
  // 加载知识库列表
  const libs = await LibraryApi.getSimpleLibraryList()
  libraryOptions.value = libs
  const map: Record<number, string> = {}
  libs.forEach((lib: any) => { map[lib.id] = lib.name })
  libraryMap.value = map

  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      formData.value = await DocumentApi.getDocument(id)
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗

/** 提交表单 */
const emit = defineEmits(['success']) // 定义 success 事件，用于操作成功后的回调
const submitForm = async () => {
  // 校验表单
  await formRef.value.validate()
  // 新增模式：手动校验文件是否已上传
  if (formType.value === 'create' && !selectedFile.value) {
    message.warning('请先上传文件')
    return
  }
  // 提交请求
  formLoading.value = true
  try {
    if (formType.value === 'create') {
      // 新增：上传文件到知识库，后端自动获取文件名/类型/大小
      const formDataObj = new FormData()
      formDataObj.append('file', selectedFile.value!)
      formDataObj.append('kbId', String(formData.value.kbId))
      if (formData.value.folderId) {
        formDataObj.append('folderId', String(formData.value.folderId))
      }
      if (formData.value.description) {
        formDataObj.append('description', formData.value.description)
      }
      if (formData.value.tags) {
        formDataObj.append('tags', formData.value.tags)
      }
      await DocumentApi.uploadDocument(formDataObj)
      message.success(t('common.createSuccess'))
    } else {
      // 编辑：更新文件描述/标签/状态
      const data = formData.value as unknown as Document
      await DocumentApi.updateDocument(data)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    // 发送操作成功的事件
    emit('success')
  } finally {
    formLoading.value = false
  }
}

/** 重置表单 */
const resetForm = () => {
  formData.value = {
    id: undefined,
    kbId: undefined,
    folderId: undefined,
    fileName: undefined,
    fileUrl: undefined,
    fileType: undefined,
    fileSize: undefined,
    fileConfigId: undefined,
    filePath: undefined,
    description: undefined,
    tags: undefined,
    downloadCount: undefined,
    viewCount: undefined,
    status: 0
  }
  selectedFile.value = null
  formRef.value?.resetFields()
  // 清除上传组件
  nextTick(() => {
    uploadRef.value?.clearFiles()
  })
}
</script>