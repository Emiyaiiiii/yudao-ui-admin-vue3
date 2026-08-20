<template>
  <div class="kb-screen">
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

    <!-- 右侧：知识库列表 / 文件列表 -->
    <div class="panel-right">
      <!-- ========== 知识库列表视图（动态表头） ========== -->
      <template v-if="!selectedLibrary">
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
          <div class="library-toolbar">
            <el-input
              v-model="searchName"
              placeholder="搜索名称"
              clearable
              style="width: 220px"
              @keyup.enter="loadLibraries()"
              @clear="loadLibraries()"
            >
              <template #prefix>
                <Icon icon="ep:search" />
              </template>
            </el-input>
            <el-select v-model="sortKey" style="width: 170px" @change="loadLibraries()">
              <el-option v-for="s in SORT_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
            </el-select>
          </div>
          <el-table
            v-if="libraryList.length > 0"
            :data="libraryList"
            row-key="id"
            class="library-table"
            @row-click="handleLibraryRowClick"
          >
            <el-table-column label="序号" width="60" align="center">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <!-- 动态表头列 -->
            <el-table-column
              v-for="col in dynamicColumns"
              :key="columnKey(col)"
              :label="col.label"
              :min-width="col.source === 'builtin' && col.builtin === 'name' ? 200 : 120"
              :width="col.source === 'builtin' && col.builtin === 'docCount' ? 90 : undefined"
              :align="col.source === 'builtin' && col.builtin === 'docCount' ? 'center' : 'left'"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-tag
                  v-if="col.source === 'builtin' && col.builtin === 'isPublic'"
                  :type="row.isPublic === 1 ? 'success' : 'info'"
                  size="small"
                >
                  {{ row.isPublic === 1 ? '公开' : '私有' }}
                </el-tag>
                <el-tag
                  v-else-if="col.source === 'builtin' && col.builtin === 'status'"
                  :type="row.status === 0 ? 'success' : 'danger'"
                  size="small"
                >
                  {{ row.status === 0 ? '启用' : '禁用' }}
                </el-tag>
                <span v-else>{{ formatCell(col, row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" align="center" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click.stop="handleLibraryRowClick(row)">
                  进入
                </el-button>
                <el-button
                  link
                  type="primary"
                  @click.stop="openLibraryForm('update', row.id)"
                  v-hasPermi="['kb:library:update']"
                >
                  编辑
                </el-button>
                <el-button
                  link
                  type="danger"
                  @click.stop="handleDeleteLibrary(row)"
                  v-hasPermi="['kb:library:delete']"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty
            v-else
            :description="selectedCategory ? '该分类下暂无知识库' : '请选择左侧分类'"
            :image-size="60"
          />
        </div>
      </template>

      <!-- ========== 文件列表视图 ========== -->
      <template v-else>
        <div class="panel-header">
          <span class="panel-title">{{ selectedLibrary.name }} - 文件</span>
          <div class="panel-header-actions">
            <el-button size="small" @click="backToLibraryList">
              <Icon icon="ep:back" /> 返回
            </el-button>
            <el-button v-if="canManage" type="primary" size="small" @click="handleCreateFolder">
              <Icon icon="ep:folder-add" /> 新建文件夹
            </el-button>
            <el-button v-if="canManage" type="primary" size="small" @click="uploadDialogVisible = true">
              <Icon icon="ep:upload" /> 上传文件
            </el-button>
          </div>
        </div>
        <div class="panel-body" v-loading="fileLoading">
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
              <el-breadcrumb-item>
                <span class="cursor-pointer" @click="loadDocuments(0)">根目录</span>
              </el-breadcrumb-item>
              <el-breadcrumb-item v-for="crumb in breadcrumbs" :key="crumb.id">
                <span class="cursor-pointer" @click="loadDocuments(crumb.id)">{{ crumb.name }}</span>
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
                <span v-if="canManage" class="folder-actions" @click.stop>
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
                  <div class="doc-name-row">
                    <span class="doc-name">{{ doc.fileName }}</span>
                    <el-tag
                      v-if="doc.vectorTaskId"
                      :type="getVectorStatusType(doc)"
                      size="small"
                      class="doc-vector-tag"
                    >
                      {{ getVectorStatusLabel(doc) }}
                    </el-tag>
                    <span class="doc-actions">
                      <el-button
                        v-if="isRetryable(doc)"
                        link
                        type="success"
                        size="small"
                        @click.stop="handleRetryVectorTask(doc)"
                        :disabled="!canManage"
                      >
                        重试
                      </el-button>
                      <el-button
                        v-if="doc.vectorTaskId && !isTerminalStatus(getVectorStatus(doc))"
                        link
                        type="warning"
                        size="small"
                        @click.stop="handleCancelVectorTask(doc)"
                        :disabled="!canManage"
                      >
                        取消
                      </el-button>
                      <el-button
                        v-if="canManage"
                        link
                        type="primary"
                        size="small"
                        @click.stop="handleEditDocument(doc)"
                      >
                        编辑
                      </el-button>
                      <el-button
                        v-if="canManage"
                        link
                        type="danger"
                        size="small"
                        @click.stop="handleDeleteDocument(doc)"
                      >
                        删除
                      </el-button>
                      <a v-if="doc.fileUrl" :href="doc.fileUrl" target="_blank" class="doc-download">
                        <Icon icon="ep:download" />
                      </a>
                    </span>
                  </div>
                  <span class="doc-meta"
                    >{{ formatFileSize(doc.fileSize) }} · 下载 {{ doc.downloadCount }}</span
                  >
                  <div v-if="showProgress(doc)" class="doc-vector-progress">
                    <el-progress
                      :percentage="getProgress(doc.vectorTaskId) || 0"
                      :stroke-width="4"
                      :show-text="true"
                      class="vector-progress-bar"
                    />
                    <span class="vector-step-text" v-if="getStep(doc.vectorTaskId)">
                      {{ getStep(doc.vectorTaskId) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <el-empty
              v-if="folders.length === 0 && documents.length === 0"
              description="暂无文件"
              :image-size="60"
            />
          </template>
        </div>
      </template>
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

  <!-- 创建/编辑知识库表单 -->
  <LibraryForm ref="libraryFormRef" @success="handleLibraryFormSuccess" />
  <!-- 编辑文档表单 -->
  <DocumentForm ref="documentFormRef" @success="handleDocumentFormSuccess" />
</template>

<script lang="ts" setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { CategoryApi, type Category } from '@/api/kb/category'
import { LibraryApi, type Library } from '@/api/kb/library'
import { FolderApi, type Folder } from '@/api/kb/folder'
import { DocumentApi } from '@/api/kb/document'
import { ProjectMemberApi } from '@/api/kb/projectmember'
import { LevelConfigApi } from '@/api/kb/levelconfig'
import { UserDeptApi } from '@/api/kb/userdept'
import {
  VectorTaskApi,
  VectorTaskStatus,
  vectorStatusConfig,
  isTerminalStatus
} from '@/api/kb/vectorTask'
import { handleTree } from '@/utils/tree'
import { dateFormatter } from '@/utils/formatTime'
import { useUserStore } from '@/store/modules/user'
import { getSimpleUserList } from '@/api/system/user'
import * as DeptApi from '@/api/system/dept'
import LibraryForm from '../library/LibraryForm.vue'
import DocumentForm from '../document/DocumentForm.vue'
import { useVectorTaskWs } from '../document/useVectorTaskWs'
import { parseColumnConfig, type KbColumn } from '../columnConfig'

defineOptions({ name: 'KbScreen' })

const userStore = useUserStore()

// ========== 向量任务 WebSocket 监听 ==========
const { resolveVectorStatus, getProgress, getStep } = useVectorTaskWs()

const getVectorStatus = (doc: any): number | undefined => {
  return resolveVectorStatus(doc.vectorStatus, doc.vectorTaskId)
}
const getVectorStatusLabel = (doc: any): string => {
  const status = getVectorStatus(doc)
  if (status === undefined || status === null) return '未处理'
  return vectorStatusConfig[status]?.label || '未知'
}
const getVectorStatusType = (doc: any): string => {
  const status = getVectorStatus(doc)
  if (status === undefined || status === null) return ''
  return vectorStatusConfig[status]?.type || 'info'
}
const showProgress = (doc: any): boolean => {
  return getVectorStatus(doc) === VectorTaskStatus.PROCESSING
}
const isRetryable = (doc: any): boolean => {
  const status = getVectorStatus(doc)
  return (
    doc.vectorTaskId != null &&
    (status === VectorTaskStatus.FAILED ||
      status === VectorTaskStatus.SUBMIT_FAILED ||
      status === VectorTaskStatus.TIMEOUT ||
      status === VectorTaskStatus.CANCELLED)
  )
}

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
  loadLibraries(data.id)
  checkCreatePermission(data)
}

// ========== 知识库列表 ==========
const libraryLoading = ref(false)
const libraryList = ref<Library[]>([])
const selectedLibrary = ref<Library | null>(null)

// 搜索 + 排序
const searchName = ref('')
const sortKey = ref('createTime:descending') // 默认时间倒序
const SORT_OPTIONS = [
  { label: '名称', value: 'name:ascending' },
  { label: '文件数量正序', value: 'docCount:ascending' },
  { label: '文件数量倒序', value: 'docCount:descending' },
  { label: '时间倒序', value: 'createTime:descending' },
  { label: '时间正序', value: 'createTime:ascending' }
]
const currentSort = computed(() => {
  const [sortField, sortOrder] = (sortKey.value || '').split(':')
  return { sortField: sortField || undefined, sortOrder: sortOrder || undefined }
})

const loadLibraries = async (categoryId?: number) => {
  const cid = categoryId ?? selectedCategory.value?.id
  if (!cid) return
  libraryLoading.value = true
  try {
    const res = await LibraryApi.getLibraryPage({
      categoryId: cid,
      name: searchName.value || undefined,
      sortField: currentSort.value.sortField,
      sortOrder: currentSort.value.sortOrder,
      pageNo: 1,
      pageSize: 200
    })
    libraryList.value = res.list || []
  } finally {
    libraryLoading.value = false
  }
}

/** 动态表头列（读取分类列模板） */
const dynamicColumns = computed(() => {
  return parseColumnConfig(selectedCategory.value?.columnConfig)
})

/** 列的唯一 key（内置用 builtin，自定义用 key） */
const columnKey = (col: KbColumn): string => {
  return col.source === 'builtin' ? col.builtin || '' : col.key || ''
}

/** 去掉 HTML 标签，转为纯文本（描述字段是富文本 Editor，存的是 HTML） */
const stripHtml = (html?: string): string => {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

/** 单元格格式化（动态列的非 tag 列） */
const formatCell = (col: KbColumn, row: Library): string => {
  if (col.source === 'builtin') {
    switch (col.builtin) {
      case 'name':
        return row.name || ''
      case 'description':
        return stripHtml(row.description)
      case 'docCount':
        return String(row.docCount ?? 0)
      case 'creator':
        return row.creator ? userMap.value[row.creator] || row.creator : ''
      case 'owner':
        return ownerName(row)
      case 'createTime':
        return dateFormatter(null, null, row.createTime) || ''
      default:
        return (row as any)[col.builtin || ''] ?? ''
    }
  }
  // 自定义字段：从 extValues 取值并格式化
  const key = col.key
  if (!key) return ''
  const raw = row.extValues?.[key]
  if (raw === undefined || raw === null || raw === '') return '—'
  if (col.type === 'member') return formatMemberValue(raw)
  if (col.type === 'dept') return deptMap.value[raw] || raw
  return raw
}

/** 成员字段值格式化：JSON 数组 ID → 姓名 */
const formatMemberValue = (raw: string): string => {
  try {
    const ids = JSON.parse(raw)
    if (Array.isArray(ids)) {
      return ids.map((id: any) => userMap.value[String(id)] || id).join('、')
    }
  } catch {
    // ignore
  }
  return raw
}

/** 所有者ID → 名称（根据层级配置 ownerDim 判断用户/部门） */
const userMap = ref<Record<string, string>>({})
const deptMap = ref<Record<string, string>>({})
const levelConfigMap = ref<Record<number, any>>({})

const ownerName = (row: Library): string => {
  const ownerId = row.ownerId
  if (!ownerId) return '—'
  const cfg = levelConfigMap.value[row.kbLevelId]
  const ownerDim = cfg ? cfg.ownerDim : 0
  if (ownerDim === 1) return userMap.value[String(ownerId)] || String(ownerId)
  if (ownerDim === 2) return deptMap.value[String(ownerId)] || String(ownerId)
  return String(ownerId)
}

const handleLibraryRowClick = async (lib: Library) => {
  selectedLibrary.value = lib
  // 检查当前用户是否有上传/管理权限
  try {
    canManage.value = await LibraryApi.canManage(lib.id)
  } catch {
    canManage.value = false
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
  // 加载文件夹树 + 文档
  await loadFolderTree(lib.id)
  loadDocuments(0)
}

const backToLibraryList = () => {
  selectedLibrary.value = null
  folders.value = []
  documents.value = []
  currentFolderId.value = 0
}

// ========== 创建/编辑/删除知识库 ==========
const canCreate = ref(false)
const adminDeptIds = ref<number[]>([])

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
  const roles = userStore.roles || []
  if (roles.includes('super_admin') || roles.includes('tenant_admin')) {
    canCreate.value = true
    return
  }
  if (cfg.visibilityRule === 1) {
    canCreate.value = true
    return
  }
  canCreate.value = (adminDeptIds.value || []).length > 0
}

const libraryFormRef = ref()
const handleCreateLibrary = () => {
  libraryFormRef.value.open('create', undefined, selectedCategory.value?.id)
}
const openLibraryForm = (type: string, id: number) => {
  libraryFormRef.value.open(type, id)
}
const handleLibraryFormSuccess = () => {
  if (selectedCategory.value) loadLibraries(selectedCategory.value.id)
}

const handleDeleteLibrary = async (lib: Library) => {
  try {
    await ElMessageBox.confirm(`确定删除知识库「${lib.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await LibraryApi.deleteLibrary(lib.id)
    ElMessage.success('删除成功')
    if (selectedCategory.value) loadLibraries(selectedCategory.value.id)
  } catch {
    // 取消删除不处理
  }
}

// ========== 文件列表 ==========
const fileLoading = ref(false)
const folders = ref<Folder[]>([])
const allFolders = ref<Folder[]>([])
const documents = ref<any[]>([])
const currentFolderId = ref(0)
const breadcrumbs = ref<{ id: number; name: string }[]>([])
const canManage = ref(false)
const isProjectMember = ref(true)

const loadFolderTree = async (kbId: number) => {
  fileLoading.value = true
  try {
    const tree = await FolderApi.getFolderTree(kbId)
    // 后端返回嵌套树，先拍平为扁平列表，便于按 parentId 过滤导航 + 面包屑
    allFolders.value = flattenFolders(tree)
    updateSubFolders(0)
  } finally {
    fileLoading.value = false
  }
}

/** 将嵌套文件夹树拍平为扁平列表（保留 parentId，丢弃 children） */
const flattenFolders = (nodes: any[]): Folder[] => {
  const result: Folder[] = []
  const walk = (items: any[]) => {
    ;(items || []).forEach((item: any) => {
      result.push({ ...item, children: undefined })
      if (item.children && item.children.length) walk(item.children)
    })
  }
  walk(nodes)
  return result
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
    if (uploadForm.folderId) formData.append('folderId', String(uploadForm.folderId))
    if (uploadForm.description) formData.append('description', uploadForm.description)
    await DocumentApi.uploadDocument(formData)
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    uploadForm.file = null
    uploadForm.folderId = null
    uploadForm.description = ''
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
    await FolderApi.updateFolder({ id: renameForm.value.id, name: renameForm.value.name })
    ElMessage.success('重命名成功')
    renameDialogVisible.value = false
    await loadFolderTree(selectedLibrary.value!.id)
  } finally {
    renameLoading.value = false
  }
}

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
    if (currentFolderId.value === folder.id) loadDocuments(0)
  } catch {
    // 取消删除不处理
  }
}

// ========== 文档编辑/删除 ==========
const documentFormRef = ref()
const handleEditDocument = (doc: any) => {
  documentFormRef.value.open('update', doc.id)
}
const handleDocumentFormSuccess = () => {
  loadDocuments(currentFolderId.value)
}

const handleDeleteDocument = async (doc: any) => {
  try {
    await ElMessageBox.confirm(`确定删除文件「${doc.fileName}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await DocumentApi.deleteDocument(doc.id)
    ElMessage.success('删除成功')
    loadDocuments(currentFolderId.value)
  } catch {
    // 取消删除不处理
  }
}

// ========== 向量任务操作 ==========
const handleCancelVectorTask = async (doc: any) => {
  if (!doc.vectorTaskId) return
  try {
    await ElMessageBox.confirm('确定取消该向量处理任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await VectorTaskApi.cancelTask(doc.vectorTaskId)
    ElMessage.success('任务已取消')
    loadDocuments(currentFolderId.value)
  } catch {}
}

const handleRetryVectorTask = async (doc: any) => {
  try {
    await ElMessageBox.confirm('确定重新处理该文档的向量任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await VectorTaskApi.retryTask(doc.id)
    ElMessage.success('已重新提交处理')
    loadDocuments(currentFolderId.value)
  } catch {}
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
  await Promise.all([loadCategories(), loadCreateOptions(), loadNameMaps()])
})

const loadNameMaps = async () => {
  try {
    const [userData, deptData] = await Promise.all([
      getSimpleUserList(),
      DeptApi.getSimpleDeptList()
    ])
    const uMap: Record<string, string> = {}
    userData.forEach((u: any) => {
      uMap[u.id] = u.nickname
    })
    userMap.value = uMap
    const dMap: Record<string, string> = {}
    const flattenDept = (items: any[]) => {
      items.forEach((item: any) => {
        dMap[item.id] = item.name
        if (item.children) flattenDept(item.children)
      })
    }
    flattenDept(deptData)
    deptMap.value = dMap
  } catch {
    // 静默失败
  }
}
</script>

<style scoped>
.kb-screen {
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

.panel-right {
  flex: 1;
  min-width: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.library-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.library-table {
  width: 100%;
}

.cursor-pointer {
  cursor: pointer;
}

.cursor-pointer:hover {
  color: var(--el-color-primary);
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
  align-items: flex-start;
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
  margin-top: 2px;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.doc-name {
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.doc-vector-tag {
  flex-shrink: 0;
}

.doc-meta {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.doc-vector-progress {
  margin-top: 4px;
}

.doc-vector-progress .vector-progress-bar {
  width: 100%;
}

.doc-vector-progress .vector-step-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
  display: block;
}

.doc-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.doc-download {
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-size: 16px;
  padding: 4px;
}
</style>
