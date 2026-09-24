<template>
  <div class="document-page">
    <!-- 左侧：文件夹树 -->
    <div class="folder-sidebar">
      <div class="folder-sidebar-header">
        <span class="folder-sidebar-title">文档目录</span>
        <el-button
          type="primary"
          text
          size="small"
          @click="handleCreateFolder"
          v-hasPermi="['kb:document:create']"
          :disabled="!currentKbId || !canManageCurrentKb"
        >
          <Icon icon="ep:folder-add" class="mr-3px" /> 新建文件夹
        </el-button>
      </div>
      <div class="folder-tree-wrap">
        <el-tree
          ref="folderTreeRef"
          :data="folderTree"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          :highlight-current="true"
          :expand-on-click-node="true"
          @node-click="handleFolderClick"
          :filter-node-method="filterFolderNode"
          default-expand-all
        >
          <template #default="{ data }">
            <span class="folder-tree-node">
              <Icon icon="ep:folder" class="folder-icon" />
              <span class="folder-label">{{ data.name }}</span>
            </span>
          </template>
        </el-tree>
        <div v-if="folderTree.length === 0" class="folder-empty">
          <el-empty description="暂无文件夹" :image-size="60" />
        </div>
      </div>
    </div>

    <!-- 右侧：文档列表 -->
    <div class="document-main">
      <!-- 面包屑导航 -->
      <div class="breadcrumb-bar">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>
            <el-link
              type="primary"
              :underline="false"
              @click="handleFolderClick({ id: 0, name: '全部文档' })"
            >
              <Icon icon="ep:home-filled" class="mr-3px" />全部文档
            </el-link>
          </el-breadcrumb-item>
          <el-breadcrumb-item v-for="item in breadcrumbPath" :key="item.id">
            <el-link
              v-if="item.id !== currentFolderId"
              type="primary"
              :underline="false"
              @click="handleFolderClick(item)"
            >
              {{ item.name }}
            </el-link>
            <span v-else>{{ item.name }}</span>
          </el-breadcrumb-item>
        </el-breadcrumb>
        <span class="current-folder-label" v-if="currentFolderId && currentFolderId !== 0">
          当前文件夹：{{ currentFolderName }}
        </span>
      </div>

      <!-- 搜索工作栏 -->
      <ContentWrap>
        <el-form
          class="-mb-15px"
          :model="queryParams"
          ref="queryFormRef"
          :inline="true"
          label-width="90px"
        >
          <el-form-item label="所属知识库" prop="kbId">
            <el-select
              v-model="queryParams.kbId"
              placeholder="请选择知识库"
              clearable
              filterable
              class="!w-240px"
              @change="handleKbChange"
            >
              <el-option
                v-for="item in libraryOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="文件名称" prop="fileName">
            <el-input
              v-model="queryParams.fileName"
              placeholder="请输入文件名称"
              clearable
              @keyup.enter="handleQuery"
              class="!w-240px"
            />
          </el-form-item>
          <el-form-item label="文件类型" prop="fileType">
            <el-select
              v-model="queryParams.fileType"
              placeholder="请选择文件类型"
              clearable
              class="!w-240px"
            >
              <el-option label="PDF" value="pdf" />
              <el-option label="Word" value="docx" />
              <el-option label="Excel" value="xlsx" />
              <el-option label="PPT" value="pptx" />
              <el-option label="图片" value="jpg" />
            </el-select>
          </el-form-item>
          <el-form-item label="标签" prop="tags">
            <el-input
              v-model="queryParams.tags"
              placeholder="请输入标签"
              clearable
              @keyup.enter="handleQuery"
              class="!w-240px"
            />
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select
              v-model="queryParams.status"
              placeholder="请选择状态"
              clearable
              class="!w-240px"
            >
              <el-option label="正常" :value="0" />
              <el-option label="禁用" :value="1" />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间" prop="createTime">
            <el-date-picker
              v-model="queryParams.createTime"
              value-format="YYYY-MM-DD HH:mm:ss"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              :default-time="[new Date('1 00:00:00'), new Date('1 23:59:59')]"
              class="!w-220px"
            />
          </el-form-item>
          <el-form-item>
            <el-button @click="handleQuery"
              ><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button
            >
            <el-button @click="resetQuery"
              ><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button
            >
            <el-button
              type="primary"
              plain
              @click="openForm('create')"
              v-hasPermi="['kb:document:create']"
              :disabled="!canManageCurrentKb"
            >
              <Icon icon="ep:plus" class="mr-5px" /> 新增
            </el-button>
            <el-button
              type="warning"
              plain
              @click="openWiki"
              v-hasPermi="['kb:document:query']"
              :disabled="!currentKbId"
            >
              <Icon icon="ep:share" class="mr-5px" /> Wiki
            </el-button>
            <el-button
              type="success"
              plain
              @click="handleExport"
              :loading="exportLoading"
              v-hasPermi="['kb:document:export']"
            >
              <Icon icon="ep:download" class="mr-5px" /> 导出
            </el-button>
            <el-button
              type="danger"
              plain
              :disabled="isEmpty(checkedIds) || !canManageCurrentKb"
              @click="handleDeleteBatch"
              v-hasPermi="['kb:document:delete']"
            >
              <Icon icon="ep:delete" class="mr-5px" /> 批量删除
            </el-button>
          </el-form-item>
        </el-form>
      </ContentWrap>

      <!-- 列表 -->
      <ContentWrap>
        <el-table
          row-key="id"
          v-loading="loading"
          :data="list"
          :stripe="true"
          :show-overflow-tooltip="true"
          :empty-text="queryParams.kbId ? '暂无数据' : '请先选择知识库后查看文档'"
          @selection-change="handleRowCheckboxChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column
            label="所属知识库"
            align="center"
            prop="kbId"
            :formatter="kbIdFormatter"
            min-width="120px"
          />
          <el-table-column label="文件名称" align="center" prop="fileName" min-width="150px" />
          <el-table-column label="文件链接" align="center" min-width="160px">
            <template #default="scope">
              <el-link
                v-if="scope.row.filePath"
                @click="handleFileLink(scope.row)"
                type="primary"
                :ellipsis="true"
              >
                {{ scope.row.fileName || '查看文件' }}
              </el-link>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="文件类型" align="center" prop="fileType" width="80px" />
          <el-table-column
            label="文件大小"
            align="center"
            prop="fileSize"
            :formatter="fileSizeFormatter"
            width="100px"
          />
          <el-table-column label="存储路径" align="center" prop="filePath" min-width="200px" />
          <el-table-column label="文件描述" align="center" prop="description" min-width="120px" />
          <el-table-column label="标签" align="center" prop="tags" min-width="100px" />
          <el-table-column label="下载" align="center" prop="downloadCount" width="60px" />
          <el-table-column label="查看" align="center" prop="viewCount" width="60px" />
          <el-table-column label="状态" align="center" width="70px">
            <template #default="scope">
              <el-tag :type="scope.row.status === 0 ? 'success' : 'danger'">
                {{ scope.row.status === 0 ? '正常' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="向量状态" align="center" width="160px">
            <template #default="scope">
              <div v-if="scope.row.vectorTaskId">
                <el-tag
                  :type="getVectorStatusType(scope.row)"
                  size="small"
                >
                  {{ getVectorStatusLabel(scope.row) }}
                </el-tag>
                <!-- 处理中显示进度条 -->
                <div v-if="showProgress(scope.row)" class="vector-progress">
                  <el-progress
                    :percentage="getProgress(scope.row.vectorTaskId) || 0"
                    :stroke-width="6"
                    :show-text="true"
                    :text-inside="false"
                    class="vector-progress-bar"
                  />
                  <span class="vector-step-text" v-if="getStep(scope.row.vectorTaskId) || getErrorMsg(scope.row.vectorTaskId)">
                    {{ getErrorMsg(scope.row.vectorTaskId) || getStep(scope.row.vectorTaskId) }}
                  </span>
                </div>
              </div>
              <span v-else class="text-gray-400">—</span>
            </template>
          </el-table-column>
          <el-table-column
            label="创建时间"
            align="center"
            prop="createTime"
            :formatter="dateFormatter"
            width="180px"
          />
          <el-table-column label="操作" align="center" min-width="240px">
            <template #default="scope">
              <el-button
                link
                type="primary"
                @click="handleFileLink(scope.row)"
                v-hasPermi="['kb:document:query']"
              >
                文件链接
              </el-button>
              <el-button
                link
                type="primary"
                @click="openForm('update', scope.row.id)"
                v-hasPermi="['kb:document:update']"
                :disabled="!canManageCurrentKb"
              >
                编辑
              </el-button>
              <el-dropdown
                trigger="click"
                @command="(cmd: string) => handleDropdownCommand(cmd, scope.row)"
              >
                <el-button link type="primary">
                  <span>
                    更多
                    <Icon icon="ep:arrow-down" />
                  </span>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-if="scope.row.vectorTaskId && !isTerminalStatus(getVectorStatus(scope.row))"
                      command="cancelVectorTask"
                      :disabled="!canManageCurrentKb"
                    >
                      取消任务
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="isRetryable(scope.row)"
                      command="retryVectorTask"
                      :disabled="!canManageCurrentKb"
                    >
                      重新处理
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="scope.row.vectorTaskId"
                      command="showTimeline"
                    >
                      时间线
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="isChunkReady(scope.row)"
                      command="showChunks"
                    >
                      切片
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="delete"
                      v-hasPermi="['kb:document:delete']"
                      :disabled="!canManageCurrentKb"
                      divided
                    >
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-table-column>
        </el-table>
        <!-- 分页 -->
        <Pagination
          :total="total"
          v-model:page="queryParams.pageNo"
          v-model:limit="queryParams.pageSize"
          @pagination="getList"
        />
      </ContentWrap>
    </div>
  </div>

  <!-- 表单弹窗：添加/修改 -->
  <DocumentForm ref="formRef" @success="getList" />

  <!-- 处理时间线弹窗 -->
  <Dialog title="向量处理时间线" v-model="timelineDialogVisible" width="520px">
    <div v-if="timelineLoading" v-loading="timelineLoading" class="timeline-loading" />
    <VectorTaskTimeline v-else :stages="timelineStages" />
    <template #footer>
      <el-button @click="timelineDialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>

  <!-- 切片浏览/编辑弹窗（#7） -->
  <Dialog title="切片浏览" v-model="chunkDialogVisible" width="980px">
    <ChunkView
      v-if="chunkDialogVisible"
      ref="chunkViewRef"
      :doc-id="chunkDocId"
      :kb-id="chunkKbId"
      :can-edit="canManageCurrentKb"
    />
    <template #footer>
      <el-button @click="chunkDialogVisible = false">关 闭</el-button>
    </template>
  </Dialog>

  <!-- 新建文件夹弹窗 -->
  <Dialog title="新建文件夹" v-model="folderDialogVisible" width="400px">
    <el-form ref="folderFormRef" :model="folderForm" :rules="folderRules" label-width="80px">
      <el-form-item label="文件夹名称" prop="name">
        <el-input v-model="folderForm.name" placeholder="请输入文件夹名称" maxlength="50" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitFolderForm" type="primary" :disabled="folderLoading"
        >确 定</el-button
      >
      <el-button @click="folderDialogVisible = false">取 消</el-button>
    </template>
  </Dialog>

  <!-- Wiki 入口弹窗（基于当前知识库） -->
  <Dialog
    title="知识库 Wiki"
    v-model="wikiVisible"
    :fullscreen="false"
    width="1200px"
    :scroll="true"
    maxHeight="85vh"
    :draggable="false"
  >
    <WikiBrowser
      v-if="wikiVisible && wikiKbId"
      :key="wikiKbId"
      :kb-id="wikiKbId"
      @open-source-doc="handleOpenSourceDoc"
    />
  </Dialog>
</template>

<script setup lang="ts">
import { isEmpty } from '@/utils/is'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import { DocumentApi, Document } from '@/api/kb/document'
import { LibraryApi } from '@/api/kb/library'
import { FolderApi } from '@/api/kb/folder'
import {
  VectorTaskApi,
  VectorTaskStatus,
  vectorStatusConfig,
  isTerminalStatus,
  type VectorTaskStage
} from '@/api/kb/vectorTask'
import { useVectorTaskWs } from './useVectorTaskWs'
import VectorTaskTimeline from './VectorTaskTimeline.vue'
import DocumentForm from './DocumentForm.vue'
import ChunkView from './ChunkView.vue'
import WikiBrowser from '../wiki/WikiBrowser.vue'

/** 知识库文件 列表 */
defineOptions({ name: 'Document' })

const message = useMessage()
const { t } = useI18n()

// ========== 向量任务 WebSocket 监听 ==========
const { resolveVectorStatus, getProgress, getStep, getErrorMsg, getTaskStatus, fetchTaskDetail } = useVectorTaskWs()

/** 获取文档的向量状态（优先使用 WebSocket 实时数据） */
const getVectorStatus = (row: Document): number | undefined => {
  return resolveVectorStatus(row.vectorStatus, row.vectorTaskId)
}

/** 获取向量状态标签 */
const getVectorStatusLabel = (row: Document): string => {
  const status = getVectorStatus(row)
  if (status === undefined || status === null) return '未处理'
  const config = vectorStatusConfig[status]
  return config?.label || '未知'
}

/** 获取向量状态标签类型 */
const getVectorStatusType = (row: Document): string => {
  const status = getVectorStatus(row)
  if (status === undefined || status === null) return ''
  const config = vectorStatusConfig[status]
  return config?.type || 'info'
}

/** 是否显示进度条 */
const showProgress = (row: Document): boolean => {
  const status = getVectorStatus(row)
  return status === VectorTaskStatus.PROCESSING
}

// ========== 处理时间线弹窗 ==========
const timelineDialogVisible = ref(false)
const timelineLoading = ref(false)
const timelineStages = ref<VectorTaskStage[]>([])

/** 打开处理时间线：优先用 WS 实时 stages，缺失时从任务详情拉取 */
const handleShowTimeline = async (row: Document) => {
  timelineDialogVisible.value = true
  timelineStages.value = []
  // 1) WS 实时数据（处理中任务由 state_bus 实时推送 stages）
  const wsMsg = getTaskStatus(row.vectorTaskId)
  if (wsMsg?.stages?.length) {
    timelineStages.value = wsMsg.stages
    return
  }
  // 2) 兜底：从任务详情拉取历史 stages
  timelineLoading.value = true
  try {
    const detail = await fetchTaskDetail(row.vectorTaskId)
    timelineStages.value = detail?.stages || []
  } finally {
    timelineLoading.value = false
  }
}

// ========== 切片浏览/编辑（#7） ==========
const chunkDialogVisible = ref(false)
const chunkViewRef = ref()
const chunkDocId = ref(0)
const chunkKbId = ref(0)

/** 是否可查看切片：向量处理已完成且有任务记录 */
const isChunkReady = (row: Document): boolean => {
  return row.vectorTaskId != null && getVectorStatus(row) === VectorTaskStatus.COMPLETED
}

/** 打开切片浏览弹窗 */
const handleShowChunks = (row: Document) => {
  chunkDocId.value = row.id
  chunkKbId.value = row.kbId ?? queryParams.kbId ?? 0
  chunkDialogVisible.value = true
  // 等 Dialog 渲染后触发加载
  nextTick(() => chunkViewRef.value?.load?.())
}

/** Wiki 来源文档跳转（source_refs 里的 doc_id）：关闭 wiki 弹窗 → 打开该文档切片浏览 */
const handleOpenSourceDoc = async (docId: string) => {
  wikiVisible.value = false
  const id = Number(docId)
  if (!id) return
  try {
    const doc = await DocumentApi.getDocument(id)
    if (doc) {
      handleShowChunks(doc)
    } else {
      message.warning(`未找到来源文档：${docId}`)
    }
  } catch {
    message.warning(`打开来源文档失败：${docId}`)
  }
}

/** 取消向量任务 */
const handleCancelVectorTask = async (row: Document) => {
  if (!row.vectorTaskId) return
  try {
    await message.confirm('确定取消该向量处理任务吗？')
    await VectorTaskApi.cancelTask(row.vectorTaskId)
    message.success('任务已取消')
    await getList()
  } catch {}
}

/** 是否可重试：失败类终态 + 已取消（FAILED / SUBMIT_FAILED / TIMEOUT / CANCELLED） */
const isRetryable = (row: Document): boolean => {
  const status = getVectorStatus(row)
  return row.vectorTaskId != null && (
    status === VectorTaskStatus.FAILED ||
    status === VectorTaskStatus.SUBMIT_FAILED ||
    status === VectorTaskStatus.TIMEOUT ||
    status === VectorTaskStatus.CANCELLED
  )
}

/** 重试向量任务 */
const handleRetryVectorTask = async (row: Document) => {
  try {
    await message.confirm('确定重新处理该文档的向量任务吗？')
    await VectorTaskApi.retryTask(row.id)
    message.success('已重新提交处理')
    await getList()
  } catch {}
}

/** 下拉菜单命令分发 */
const handleDropdownCommand = (cmd: string, row: Document) => {
  switch (cmd) {
    case 'cancelVectorTask':
      handleCancelVectorTask(row)
      break
    case 'retryVectorTask':
      handleRetryVectorTask(row)
      break
    case 'showTimeline':
      handleShowTimeline(row)
      break
    case 'showChunks':
      handleShowChunks(row)
      break
    case 'delete':
      handleDelete(row.id)
      break
  }
}

const loading = ref(true)
const list = ref<Document[]>([])
const total = ref(0)
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  kbId: undefined,
  folderId: undefined as number | undefined,
  fileName: undefined,
  fileType: undefined,
  tags: undefined,
  status: undefined,
  createTime: []
})
const queryFormRef = ref()
const libraryOptions = ref<any[]>([])
const libraryMap = ref<Record<number, string>>({})
const exportLoading = ref(false)

// ========== 文件夹管理 ==========
const folderTree = ref<any[]>([])
const folderTreeRef = ref()
const currentKbId = ref<number | undefined>(undefined)
const canManageCurrentKb = ref(false) // 当前用户是否有管理权限
const currentFolderId = ref<number | undefined>(undefined)
const currentFolderName = ref('')
const breadcrumbPath = ref<{ id: number; name: string }[]>([])

/** 加载文件夹树 */
const loadFolderTree = async (kbId: number) => {
  if (!kbId) {
    folderTree.value = []
    return
  }
  try {
    const tree = await FolderApi.getFolderTree(kbId)
    folderTree.value = tree || []
  } catch {
    folderTree.value = []
  }
}

/** 知识库选择变化 */
const handleKbChange = async (kbId: number) => {
  currentKbId.value = kbId
  currentFolderId.value = undefined
  currentFolderName.value = ''
  breadcrumbPath.value = []
  queryParams.folderId = undefined
  // 检查当前用户是否有该知识库的管理权限
  if (kbId) {
    try {
      const result = await LibraryApi.canManage(kbId)
      canManageCurrentKb.value = result === true
    } catch {
      canManageCurrentKb.value = false
    }
  } else {
    canManageCurrentKb.value = false
  }
  loadFolderTree(kbId)
  handleQuery()
}

/** 点击文件夹节点 */
const handleFolderClick = (data: any) => {
  const folderId = data.id || 0
  currentFolderId.value = folderId
  currentFolderName.value = data.name || '全部文档'
  queryParams.folderId = folderId || undefined
  queryParams.pageNo = 1
  getList()
  // 更新面包屑
  buildBreadcrumb(folderId)
}

/** 构建面包屑路径 */
const buildBreadcrumb = (targetFolderId: number) => {
  if (!targetFolderId || targetFolderId === 0) {
    breadcrumbPath.value = []
    return
  }
  // 从文件夹树中查找路径
  const findPath = (
    nodes: any[],
    targetId: number,
    path: { id: number; name: string }[]
  ): boolean => {
    for (const node of nodes) {
      if (node.id === targetId) {
        path.push({ id: node.id, name: node.name })
        return true
      }
      if (node.children && node.children.length > 0) {
        path.push({ id: node.id, name: node.name })
        if (findPath(node.children, targetId, path)) {
          return true
        }
        path.pop()
      }
    }
    return false
  }
  const path: { id: number; name: string }[] = []
  findPath(folderTree.value, targetFolderId, path)
  breadcrumbPath.value = path
}

/** 文件夹节点过滤 */
const filterFolderNode = (value: string, data: any) => {
  if (!value) return true
  return data.name.indexOf(value) >= 0
}

// ========== 新建文件夹 ==========
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

/** 打开新建文件夹弹窗 */
const handleCreateFolder = () => {
  if (!currentKbId.value) {
    message.warning('请先选择知识库')
    return
  }
  folderForm.value = { name: '' }
  folderDialogVisible.value = true
}

/** 提交新建文件夹 */
const submitFolderForm = async () => {
  await folderFormRef.value.validate()
  folderLoading.value = true
  try {
    await FolderApi.createFolder({
      kbId: currentKbId.value!,
      name: folderForm.value.name,
      parentId:
        currentFolderId.value && currentFolderId.value !== 0 ? currentFolderId.value : undefined
    })
    message.success(t('common.createSuccess'))
    folderDialogVisible.value = false
    // 刷新文件夹树
    await loadFolderTree(currentKbId.value!)
  } catch {
  } finally {
    folderLoading.value = false
  }
}

// ========== 文档列表 ==========

/** 格式化文件大小 */
const fileSizeFormatter = (_row: any, _column: any, cellValue: number) => {
  if (cellValue === null || cellValue === undefined) return '—'
  if (cellValue < 1024) return cellValue + ' B'
  if (cellValue < 1024 * 1024) return (cellValue / 1024).toFixed(1) + ' KB'
  if (cellValue < 1024 * 1024 * 1024) return (cellValue / (1024 * 1024)).toFixed(1) + ' MB'
  return (cellValue / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

/** 知识库ID → 名称映射 */
const kbIdFormatter = (_row: any, _column: any, cellValue: number): string => {
  return libraryMap.value[cellValue] || String(cellValue)
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    // 未选择知识库时不发起查询：文档无独立权限，必须限定在知识库范围内查询，
    // 避免绕过知识库权限直接拉取全量文档
    if (!queryParams.kbId) {
      list.value = []
      total.value = 0
      return
    }
    const data = await DocumentApi.getDocumentPage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  queryParams.folderId = currentFolderId.value ? currentFolderId.value : undefined
  handleQuery()
}

/** 添加/修改操作 */
const formRef = ref()
const openForm = (type: string, id?: number) => {
  formRef.value.open(type, id)
}

/** 文件链接：现取短时签名 URL 后新标签打开。
 *  不直接存 fileUrl：历史数据存死的内网地址（minio:9000），且签名有有效期，故每次现由后端按配置 domain 生成。 */
const handleFileLink = async (row: Document) => {
  try {
    if (!row.filePath) {
      message.warning('该文件无可访问路径')
      return
    }
    const signedUrl = await DocumentApi.getPresignedGetUrl(row.filePath)
    window.open(signedUrl, '_blank')
  } catch {}
}

/** 删除按钮操作 */
const handleDelete = async (id: number) => {
  try {
    await message.delConfirm()
    await DocumentApi.deleteDocument(id)
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

/** 批量删除知识库文件 */
const handleDeleteBatch = async () => {
  try {
    await message.delConfirm()
    await DocumentApi.deleteDocumentList(checkedIds.value)
    checkedIds.value = []
    message.success(t('common.delSuccess'))
    await getList()
  } catch {}
}

const checkedIds = ref<number[]>([])
const handleRowCheckboxChange = (records: Document[]) => {
  checkedIds.value = records.map((item) => item.id!)
}

/** 导出按钮操作 */
const handleExport = async () => {
  if (!queryParams.kbId) {
    message.warning('请先选择知识库')
    return
  }
  try {
    await message.exportConfirm()
    exportLoading.value = true
    const data = await DocumentApi.exportDocument(queryParams)
    download.excel(data, '知识库文件.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

// ========== Wiki 入口 ==========
const wikiVisible = ref(false)
const wikiKbId = ref(0)

/** 打开 Wiki 弹窗（需先选择知识库才能拿到 kbId） */
const openWiki = () => {
  if (!currentKbId.value) {
    message.warning('请先选择知识库')
    return
  }
  wikiKbId.value = currentKbId.value
  wikiVisible.value = true // WikiBrowser 内部按 kbId 自动加载
}

/** 初始化 **/
onMounted(() => {
  getList()
  loadLibraryOptions()
})

const loadLibraryOptions = async () => {
  const libs = await LibraryApi.getSimpleLibraryList()
  libraryOptions.value = libs
  const map: Record<number, string> = {}
  libs.forEach((lib: any) => {
    map[lib.id] = lib.name
  })
  libraryMap.value = map
}
</script>

<style scoped>
.document-page {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.folder-sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.folder-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.folder-sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.folder-tree-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  max-height: calc(100vh - 280px);
}

.folder-tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.folder-icon {
  color: var(--el-color-warning);
  font-size: 16px;
}

.folder-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-empty {
  padding: 20px 0;
}

.document-main {
  flex: 1;
  min-width: 0;
}

.breadcrumb-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  margin-bottom: 12px;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}

.current-folder-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.vector-progress {
  margin-top: 4px;
}

.vector-progress-bar {
  width: 100%;
}

.vector-step-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
  display: block;
}

.timeline-loading {
  min-height: 80px;
}
</style>
