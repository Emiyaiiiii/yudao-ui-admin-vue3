<template>
  <div class="kb-overview">
    <!-- 左侧：分类树 -->
    <div class="panel-left">
      <div class="panel-header">
        <span class="panel-title">知识库分类</span>
      </div>
      <div class="panel-body" v-loading="categoryLoading">
        <el-tree
          v-if="categoryTree.length > 0"
          :data="categoryTree"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          highlight-current
          default-expand-all
          @node-click="handleCategoryClick"
        />
        <el-empty v-else description="暂无可见分类" :image-size="60" />
      </div>
    </div>

    <!-- 中间：知识库列表 -->
    <div class="panel-middle">
      <div class="panel-header">
        <span class="panel-title">{{
          selectedCategory ? selectedCategory.name + ' - 知识库' : '知识库'
        }}</span>
        <div class="panel-header-actions">
          <span class="panel-badge" v-if="libraryList.length > 0">{{ libraryList.length }}</span>
          <el-button
            v-if="selectedCategory && canCreate"
            type="primary"
            size="small"
            v-hasPermi="['kb:library:create']"
            @click="handleCreateLibrary"
          >
            <Icon icon="ep:plus" /> 创建知识库
          </el-button>
        </div>
      </div>
      <div class="panel-body" v-loading="libraryLoading">
        <div v-if="libraryList.length > 0" class="library-list">
          <div
            v-for="lib in libraryList"
            :key="lib.id"
            class="library-item"
            :class="{ active: selectedLibrary?.id === lib.id }"
            @click="handleLibraryClick(lib)"
          >
            <div class="library-item-header">
              <span class="library-name">{{ lib.name }}</span>
              <el-tag v-if="lib.isProject === 1" size="small" type="warning">项目库</el-tag>
            </div>
            <div class="library-desc" v-if="lib.description">{{ lib.description }}</div>
            <div class="library-meta">
              <span><Icon icon="ep:document" /> {{ lib.docCount || 0 }} 篇</span>
              <el-tag v-if="lib.isPublic === 1" size="small" type="success">已公开</el-tag>
            </div>
          </div>
        </div>
        <el-empty
          v-else
          :description="selectedCategory ? '该分类下暂无知识库' : '请选择左侧分类'"
          :image-size="60"
        />
      </div>
    </div>

    <!-- 右侧：文件夹 + 文档 -->
    <div class="panel-right">
      <div class="panel-header">
        <span class="panel-title">{{
          selectedLibrary ? selectedLibrary.name + ' - 文件' : '文件'
        }}</span>
        <div class="panel-header-actions">
          <el-button v-if="canUpload" type="primary" size="small" @click="handleCreateFolder">
            <Icon icon="ep:folder-add" /> 新建文件夹
          </el-button>
          <el-button v-if="canUpload" type="primary" size="small" @click="uploadDialogVisible = true">
            <Icon icon="ep:upload" /> 上传文件
          </el-button>
        </div>
      </div>
      <div class="panel-body" v-loading="fileLoading">
        <template v-if="selectedLibrary">
          <!-- 项目库非成员提示 -->
          <el-alert
            v-if="selectedLibrary.isProject === 1 && !isProjectMember"
            title="您不是该项目成员，仅可查看基本信息，无法查看文件内容"
            type="warning"
            :closable="false"
            show-icon
            class="mb-10px"
          />
          <template v-else>
            <!-- 面包屑 -->
            <el-breadcrumb separator="/" class="mb-10px" v-if="currentFolderId !== 0">
              <el-breadcrumb-item @click="loadDocuments(0)">
                <span class="cursor-pointer">根目录</span>
              </el-breadcrumb-item>
              <el-breadcrumb-item v-for="crumb in breadcrumbs" :key="crumb.id">
                <span class="cursor-pointer" @click="loadDocuments(crumb.id)">{{
                  crumb.name
                }}</span>
              </el-breadcrumb-item>
            </el-breadcrumb>
            <!-- 文件夹列表 -->
            <div v-if="folders.length > 0" class="folder-list">
              <div
                v-for="folder in folders"
                :key="folder.id"
                class="folder-item"
                @click="loadDocuments(folder.id)"
              >
                <Icon icon="ep:folder" class="folder-icon" />
                <span class="folder-name">{{ folder.name }}</span>
                <span v-if="canUpload" class="folder-actions" @click.stop>
                  <Icon icon="ep:edit" class="action-icon" @click="handleRenameFolder(folder)" />
                  <Icon icon="ep:delete" class="action-icon delete-icon" @click="handleDeleteFolder(folder)" />
                </span>
              </div>
            </div>
            <!-- 文档列表 -->
            <div v-if="documents.length > 0" class="document-list">
              <div v-for="doc in documents" :key="doc.id" class="document-item">
                <Icon icon="ep:document" class="doc-icon" />
                <div class="doc-info">
                  <span class="doc-name">{{ doc.fileName }}</span>
                  <span class="doc-meta"
                    >{{ formatFileSize(doc.fileSize) }} · 下载 {{ doc.downloadCount }}</span
                  >
                </div>
                <a v-if="doc.fileUrl" :href="doc.fileUrl" target="_blank" class="doc-download">
                  <Icon icon="ep:download" />
                </a>
              </div>
            </div>
            <el-empty
              v-if="folders.length === 0 && documents.length === 0"
              description="暂无文件"
              :image-size="60"
            />
          </template>
        </template>
        <el-empty v-else description="请选择中间栏的知识库" :image-size="60" />
      </div>
    </div>
  </div>

  <!-- 上传文件对话框 -->
  <el-dialog
    v-model="uploadDialogVisible"
    title="上传文件到知识库"
    width="480px"
    :close-on-click-modal="false"
  >
    <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="80px">
      <el-form-item label="文件" prop="file">
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :show-file-list="true"
          :limit="1"
          :on-change="handleFileChange"
          :on-exceed="
            () => {
              ElMessage.warning('只能上传一个文件')
            }
          "
        >
          <el-button type="primary" plain>选择文件</el-button>
          <template #tip>
            <div class="el-upload__tip">支持 pdf/docx/xlsx/pptx/jpg/png 等格式</div>
          </template>
        </el-upload>
      </el-form-item>
      <el-form-item label="目标文件夹">
        <el-select v-model="uploadForm.folderId" placeholder="根目录" clearable style="width: 100%">
          <el-option label="根目录" :value="0" />
          <el-option v-for="f in allFolders" :key="f.id" :label="f.name" :value="f.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input
          v-model="uploadForm.description"
          type="textarea"
          :rows="2"
          placeholder="可选"
          maxlength="200"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="uploadDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="uploading" @click="handleUpload">上传</el-button>
    </template>
  </el-dialog>

  <!-- 新建文件夹对话框 -->
  <Dialog title="新建文件夹" v-model="folderDialogVisible" width="400px">
    <el-form ref="folderFormRef" :model="folderForm" :rules="folderRules" label-width="80px">
      <el-form-item label="文件夹名称" prop="name">
        <el-input v-model="folderForm.name" placeholder="请输入文件夹名称" maxlength="50" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitFolderForm" type="primary" :disabled="folderLoading">确 定</el-button>
      <el-button @click="folderDialogVisible = false">取 消</el-button>
    </template>
  </Dialog>

  <!-- 重命名文件夹对话框 -->
  <Dialog title="重命名文件夹" v-model="renameDialogVisible" width="400px">
    <el-form ref="renameFormRef" :model="renameForm" :rules="folderRules" label-width="80px">
      <el-form-item label="文件夹名称" prop="name">
        <el-input v-model="renameForm.name" placeholder="请输入文件夹名称" maxlength="50" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitRenameFolder" type="primary" :disabled="renameLoading">确 定</el-button>
      <el-button @click="renameDialogVisible = false">取 消</el-button>
    </template>
  </Dialog>

  <!-- 创建知识库表单 -->
  <LibraryForm ref="formRef" @success="handleCreateSuccess" />
</template>

<script lang="ts" setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { CategoryApi, type Category } from '@/api/kb/category'
import { LibraryApi, type Library } from '@/api/kb/library'
import { FolderApi, type Folder } from '@/api/kb/folder'
import { DocumentApi, type Document } from '@/api/kb/document'
import { ProjectMemberApi } from '@/api/kb/projectmember'
import { LevelConfigApi } from '@/api/kb/levelconfig'
import { UserDeptApi } from '@/api/kb/userdept'
import { handleTree } from '@/utils/tree'
import { useUserStore } from '@/store/modules/user'
import LibraryForm from '../library/LibraryForm.vue'

defineOptions({ name: 'KbOverview' })

const userStore = useUserStore()

// ========== 分类 ==========
const categoryLoading = ref(false)
const categoryTree = ref<any[]>([])
const selectedCategory = ref<Category | null>(null)

const loadCategories = async () => {
  categoryLoading.value = true
  try {
    const list = await CategoryApi.listCategoriesForUser()
    categoryTree.value = handleTree(list)
  } finally {
    categoryLoading.value = false
  }
}

const handleCategoryClick = (data: Category) => {
  selectedCategory.value = data
  selectedLibrary.value = null
  folders.value = []
  documents.value = []
  loadLibraries(data.id)
  checkCreatePermission(data)
}

// ========== 知识库 ==========
const libraryLoading = ref(false)
const libraryList = ref<Library[]>([])
const selectedLibrary = ref<Library | null>(null)
const isProjectMember = ref(true)
const canUpload = ref(false)

const loadLibraries = async (categoryId: number) => {
  libraryLoading.value = true
  try {
    const res = await LibraryApi.getLibraryPage({ categoryId, pageNo: 1, pageSize: 200 })
    libraryList.value = res.list || []
  } finally {
    libraryLoading.value = false
  }
}

const handleLibraryClick = async (lib: Library) => {
  selectedLibrary.value = lib
  // 检查当前用户是否有上传权限
  try {
    canUpload.value = await LibraryApi.canManage(lib.id)
  } catch {
    canUpload.value = false
  }
  // 项目库：检查是否为项目成员
  if (lib.isProject === 1) {
    try {
      isProjectMember.value = await ProjectMemberApi.checkMember(lib.id)
    } catch {
      isProjectMember.value = false
    }
  } else {
    isProjectMember.value = true
  }
  // 加载文件夹和文档
  await loadFolderTree(lib.id)
  loadDocuments(0)
}

// ========== 创建知识库权限 ==========
const canCreate = ref(false)
const levelConfigMap = ref<Record<number, any>>({})
const adminDeptIds = ref<number[]>([])

/** 加载创建知识库所需的层级配置和管理员部门信息 */
const loadCreateOptions = async () => {
  try {
    const [levelData, deptIds] = await Promise.all([
      LevelConfigApi.getSimpleLevelConfigList(),
      UserDeptApi.getMyAdminDepts()
    ])
    levelConfigMap.value = {}
    levelData.forEach((item: any) => {
      levelConfigMap.value[item.id] = item
    })
    adminDeptIds.value = deptIds || []
  } catch {
    // 静默失败
  }
}

/** 检查当前用户是否能在指定分类下创建知识库 */
const checkCreatePermission = (category: Category) => {
  if (!category.kbLevelId) {
    canCreate.value = false
    return
  }
  const cfg = levelConfigMap.value[category.kbLevelId]
  if (!cfg) {
    canCreate.value = false
    return
  }
  // 超管/租管 → 放行
  const roles = userStore.roles || []
  if (roles.includes('super_admin') || roles.includes('tenant_admin')) {
    canCreate.value = true
    return
  }
  // 个人知识库（rule=1）→ 所有人可创建
  if (cfg.visibilityRule === 1) {
    canCreate.value = true
    return
  }
  // 其他（部门级/公司级/指定部门）→ 仅部门管理员可创建
  canCreate.value = (adminDeptIds.value || []).length > 0
}

// ========== 创建知识库 ==========
const formRef = ref()
const handleCreateLibrary = () => {
  formRef.value.open('create', undefined, selectedCategory.value?.id)
}
const handleCreateSuccess = () => {
  if (selectedCategory.value) {
    loadLibraries(selectedCategory.value.id)
  }
}

// ========== 上传文件 ==========
const uploadDialogVisible = ref(false)
const uploading = ref(false)
const uploadRef = ref()
const uploadFormRef = ref()
const uploadForm = reactive({
  file: null as File | null,
  folderId: null as number | null,
  description: ''
})
const uploadRules = {
  file: [{ required: true, message: '请选择文件', trigger: 'change' }]
}

const handleFileChange = (uploadFile: any) => {
  uploadForm.file = uploadFile.raw
}

const handleUpload = async () => {
  if (!uploadForm.file) {
    ElMessage.warning('请先选择文件')
    return
  }
  if (!selectedLibrary.value) return

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', uploadForm.file)
    formData.append('kbId', String(selectedLibrary.value.id))
    if (uploadForm.folderId) {
      formData.append('folderId', String(uploadForm.folderId))
    }
    if (uploadForm.description) {
      formData.append('description', uploadForm.description)
    }
    await DocumentApi.uploadDocument(formData)
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    uploadForm.file = null
    uploadForm.folderId = null
    uploadForm.description = ''
    // 刷新当前文件夹下的文档列表
    loadDocuments(currentFolderId.value)
  } catch (e: any) {
    ElMessage.error(e?.msg || '上传失败')
  } finally {
    uploading.value = false
  }
}

// ========== 文件夹管理 ==========
const folderDialogVisible = ref(false)
const folderLoading = ref(false)
const folderFormRef = ref()
const folderForm = ref({ name: '' })
const folderRules = {
  name: [
    { required: true, message: '请输入文件夹名称', trigger: 'blur' },
    { max: 50, message: '名称不能超过50个字符', trigger: 'blur' }
  ]
}

const handleCreateFolder = () => {
  if (!selectedLibrary.value) return
  folderForm.value = { name: '' }
  folderDialogVisible.value = true
}

const submitFolderForm = async () => {
  await folderFormRef.value.validate()
  folderLoading.value = true
  try {
    await FolderApi.createFolder({
      kbId: selectedLibrary.value!.id,
      name: folderForm.value.name,
      parentId: currentFolderId.value !== 0 ? currentFolderId.value : undefined
    })
    ElMessage.success('创建成功')
    folderDialogVisible.value = false
    await loadFolderTree(selectedLibrary.value!.id)
  } finally {
    folderLoading.value = false
  }
}

// ========== 重命名文件夹 ==========
const renameDialogVisible = ref(false)
const renameLoading = ref(false)
const renameFormRef = ref()
const renameForm = ref({ id: 0, name: '' })

const handleRenameFolder = (folder: any) => {
  renameForm.value = { id: folder.id, name: folder.name }
  renameDialogVisible.value = true
}

const submitRenameFolder = async () => {
  await renameFormRef.value.validate()
  renameLoading.value = true
  try {
    await FolderApi.updateFolder({
      id: renameForm.value.id,
      name: renameForm.value.name
    })
    ElMessage.success('重命名成功')
    renameDialogVisible.value = false
    await loadFolderTree(selectedLibrary.value!.id)
  } finally {
    renameLoading.value = false
  }
}

// ========== 删除文件夹 ==========
const handleDeleteFolder = async (folder: any) => {
  try {
    await ElMessageBox.confirm(`确定删除文件夹「${folder.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await FolderApi.deleteFolder(folder.id)
    ElMessage.success('删除成功')
    await loadFolderTree(selectedLibrary.value!.id)
    if (currentFolderId.value === folder.id) {
      loadDocuments(0)
    }
  } catch {
    // 取消删除不处理
  }
}

// ========== 文件夹 + 文档 ==========
const fileLoading = ref(false)
const folders = ref<Folder[]>([])
const allFolders = ref<Folder[]>([])
const documents = ref<any[]>([])
const currentFolderId = ref(0)
const breadcrumbs = ref<{ id: number; name: string }[]>([])

const loadFolderTree = async (kbId: number) => {
  fileLoading.value = true
  try {
    allFolders.value = await FolderApi.getFolderTree(kbId)
    updateSubFolders(0)
  } finally {
    fileLoading.value = false
  }
}

const updateSubFolders = (parentId: number) => {
  if (parentId === 0) {
    folders.value = allFolders.value.filter((f: Folder) => f.parentId === 0 || f.parentId === null)
  } else {
    folders.value = allFolders.value.filter((f: Folder) => f.parentId === parentId)
  }
}

const loadDocuments = async (folderId: number) => {
  if (!selectedLibrary.value) return
  currentFolderId.value = folderId
  updateSubFolders(folderId)
  // 构建面包屑
  if (folderId === 0) {
    breadcrumbs.value = []
  } else {
    const crumbs: { id: number; name: string }[] = []
    let currentId: number | undefined = folderId
    while (currentId) {
      const folder = allFolders.value.find((f: Folder) => f.id === currentId)
      if (folder) {
        crumbs.unshift({ id: folder.id, name: folder.name })
        currentId = folder.parentId && folder.parentId !== 0 ? folder.parentId : undefined
      } else {
        break
      }
    }
    breadcrumbs.value = crumbs
  }
  // 加载文档
  try {
    const res = await DocumentApi.getDocumentPage({
      kbId: selectedLibrary.value.id,
      folderId: folderId,
      pageNo: 1,
      pageSize: 200
    })
    documents.value = res.list || []
  } catch {
    documents.value = []
  }
}

// ========== 工具方法 ==========
const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

// ========== 初始化 ==========
onMounted(async () => {
  await Promise.all([loadCategories(), loadCreateOptions()])
})
</script>

<style scoped>
.kb-overview {
  display: flex;
  gap: 12px;
  height: calc(100vh - 120px);
  padding: 12px;
}

.panel-left {
  width: 240px;
  min-width: 240px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-middle {
  width: 320px;
  min-width: 280px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-right {
  flex: 1;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.panel-badge {
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
  padding: 0 6px;
  border-radius: 10px;
  line-height: 18px;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* 知识库列表 */
.library-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.library-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.library-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.library-item.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.library-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.library-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.library-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

/* 文件夹列表 */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--el-text-color-regular);
  transition: background 0.2s;
}

.folder-item:hover {
  background: var(--el-fill-color-light);
}

.folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.folder-item:hover .folder-actions {
  opacity: 1;
}

.action-icon {
  font-size: 14px;
  padding: 2px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  border-radius: 3px;
}

.action-icon:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.delete-icon:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.folder-icon {
  font-size: 18px;
  color: var(--el-color-warning);
}

/* 文档列表 */
.document-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.document-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.document-item:hover {
  background: var(--el-fill-color-light);
}

.doc-icon {
  font-size: 18px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-name {
  display: block;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-meta {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.doc-download {
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-size: 16px;
  padding: 4px;
}

.cursor-pointer {
  cursor: pointer;
}

.cursor-pointer:hover {
  color: var(--el-color-primary);
}
</style>