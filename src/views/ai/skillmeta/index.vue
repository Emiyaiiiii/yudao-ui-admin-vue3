<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form class="-mb-15px" :model="queryParams" ref="queryFormRef" :inline="true" label-width="68px">
      <el-form-item label="关键字" prop="search">
        <el-input
          v-model="queryParams.search"
          placeholder="技能名称/描述"
          clearable
          @keyup.enter="handleQuery"
          class="!w-200px"
        />
      </el-form-item>
      <el-form-item label="来源" prop="source">
        <el-select v-model="queryParams.source" placeholder="全部来源" clearable class="!w-140px">
          <el-option label="内置" value="builtin" />
          <el-option label="自定义" value="customized" />
        </el-select>
      </el-form-item>
      <el-form-item label="可见性" prop="visibility">
        <el-select v-model="queryParams.visibility" placeholder="全部" clearable class="!w-120px">
          <el-option label="公开" :value="1" />
          <el-option label="个人" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button type="primary" plain @click="uploadDialogVisible = true">
          <Icon icon="ep:upload" class="mr-5px" /> 上传技能
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-alert
      title="技能商店即 QwenPaw 技能池（内置 + 自定义技能），可在智能体详情中按需安装，或创建智能体时勾选为初始技能。"
      type="info"
      :closable="false"
      show-icon
      class="mb-16px"
    />
    <el-table v-loading="loading" :data="list" :stripe="true" :show-overflow-tooltip="true">
      <el-table-column label="图标" align="center" width="60px">
        <template #default="scope">
          <span class="text-20px">{{ scope.row.icon || '📦' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="显示名称" align="center" prop="displayName" min-width="140px" />
      <el-table-column label="技能标识" align="center" prop="skillName" min-width="120px">
        <template #default="scope">
          <el-text type="info" size="small">{{ scope.row.skillName }}</el-text>
        </template>
      </el-table-column>
      <el-table-column label="来源" align="center" width="90px">
        <template #default="scope">
          <el-tag :type="scope.row.source === 'builtin' ? 'primary' : 'warning'" size="small">
            {{ scope.row.source === 'builtin' ? '内置' : '自定义' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="版本" align="center" width="90px">
        <template #default="scope">
          {{ scope.row.version || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="可见性" align="center" width="90px">
        <template #default="scope">
          <el-tag :type="scope.row.visibility === 1 ? 'success' : 'info'" size="small">
            {{ scope.row.visibility === 1 ? '公开' : '个人' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" width="80px">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'" size="small">
            {{ scope.row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="160px" fixed="right">
        <template #default="scope">
          <el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button>
          <el-button link type="primary" @click="openDetail(scope.row)">详情</el-button>
          <el-button link type="danger" @click="handleDelete(scope.row.id)">删除</el-button>
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

  <!-- 上传技能对话框 -->
  <el-dialog v-model="uploadDialogVisible" title="上传技能到技能池" width="520px" append-to-body>
    <el-form :model="uploadForm" label-width="80px">
      <el-form-item label="技能包" required>
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :limit="1"
          accept=".zip"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
        >
          <el-button type="primary" plain>选择 .zip 文件</el-button>
          <template #tip>
            <div class="el-upload__tip">仅支持 .zip 格式的技能包</div>
          </template>
        </el-upload>
      </el-form-item>
      <el-form-item label="技能标识">
        <el-input v-model="uploadForm.targetName" placeholder="可选，不填则自动推断" />
      </el-form-item>
      <el-form-item label="显示名称">
        <el-input v-model="uploadForm.displayName" placeholder="可选" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="uploadForm.description" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
      <el-form-item label="图标">
        <el-input v-model="uploadForm.icon" placeholder="emoji 或 URL，如 📄" />
      </el-form-item>
      <el-form-item label="可见性">
        <el-radio-group v-model="uploadForm.visibility">
          <el-radio :label="1">公开</el-radio>
          <el-radio :label="0">个人</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="标签">
        <el-input v-model="uploadForm.tags" placeholder='JSON 数组，如 ["pdf","文档"]' />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="uploadDialogVisible = false">取 消</el-button>
      <el-button type="primary" :loading="uploading" @click="handleUpload">上 传</el-button>
    </template>
  </el-dialog>

  <!-- 编辑对话框 -->
  <el-dialog v-model="editDialogVisible" title="编辑技能信息" width="480px" append-to-body>
    <el-form :model="editForm" label-width="80px">
      <el-form-item label="技能标识">
        <el-input v-model="editForm.skillName" disabled />
      </el-form-item>
      <el-form-item label="显示名称">
        <el-input v-model="editForm.displayName" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="editForm.description" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="图标">
        <el-input v-model="editForm.icon" placeholder="emoji 或 URL" />
      </el-form-item>
      <el-form-item label="可见性">
        <el-radio-group v-model="editForm.visibility">
          <el-radio :label="1">公开</el-radio>
          <el-radio :label="0">个人</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="标签">
        <el-input v-model="editForm.tags" placeholder='JSON 数组，如 ["pdf","文档"]' />
      </el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="editForm.status">
          <el-radio :label="1">启用</el-radio>
          <el-radio :label="0">停用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editDialogVisible = false">取 消</el-button>
      <el-button type="primary" :loading="editLoading" @click="handleEdit">保 存</el-button>
    </template>
  </el-dialog>

  <!-- 技能详情抽屉 -->
  <el-drawer v-model="detailVisible" title="技能详情" size="500px">
    <el-descriptions :column="1" border size="small" v-if="detailRow">
      <el-descriptions-item label="图标">{{ detailRow.icon || '📦' }}</el-descriptions-item>
      <el-descriptions-item label="显示名称">{{ detailRow.displayName }}</el-descriptions-item>
      <el-descriptions-item label="技能标识">{{ detailRow.skillName }}</el-descriptions-item>
      <el-descriptions-item label="来源">{{ detailRow.source }}</el-descriptions-item>
      <el-descriptions-item label="版本">{{ detailRow.version || '-' }}</el-descriptions-item>
      <el-descriptions-item label="可见性">{{ detailRow.visibility === 1 ? '公开' : '个人' }}</el-descriptions-item>
      <el-descriptions-item label="描述">{{ detailRow.description || '-' }}</el-descriptions-item>
      <el-descriptions-item label="标签">{{ detailRow.tags || '-' }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ detailRow.createTime }}</el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<script setup lang="ts">
import { SkillMetaApi, SkillMeta } from '@/api/ai/skillmeta'

/** 技能商店管理（QwenPaw 技能池元数据） */
defineOptions({ name: 'AiSkillMetaIndex' })

const { error, warning, success, delConfirm } = useMessage()
const loading = ref(true)
const total = ref(0)
const list = ref<SkillMeta[]>([])
const queryParams = reactive({
  pageNo: 1,
  pageSize: 20,
  search: undefined as string | undefined,
  source: undefined as string | undefined,
  visibility: undefined as number | undefined
})
const queryFormRef = ref()

// 上传对话框
const uploadDialogVisible = ref(false)
const uploading = ref(false)
const uploadRef = ref()
const uploadFile = ref<File | null>(null)
const uploadForm = reactive({
  targetName: '',
  displayName: '',
  description: '',
  icon: '',
  visibility: 1,
  tags: ''
})

// 编辑对话框
const editDialogVisible = ref(false)
const editLoading = ref(false)
const editForm = reactive({
  id: 0,
  skillName: '',
  displayName: '',
  description: '',
  icon: '',
  visibility: 1,
  tags: '',
  status: 1
})

// 详情抽屉
const detailVisible = ref(false)
const detailRow = ref<SkillMeta | null>(null)

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const res = await SkillMetaApi.getSkillMetaPage(queryParams)
    list.value = res.list
    total.value = res.total
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
  queryFormRef.value?.resetFields()
  queryParams.search = undefined
  queryParams.source = undefined
  queryParams.visibility = undefined
  handleQuery()
}

/** 文件选择 */
const handleFileChange = (file: any) => {
  uploadFile.value = file.raw
}
const handleFileRemove = () => {
  uploadFile.value = null
}

/** 上传技能 */
const handleUpload = async () => {
  if (!uploadFile.value) {
    warning('请先选择 .zip 文件')
    return
  }
  uploading.value = true
  try {
    await SkillMetaApi.uploadSkill({
      file: uploadFile.value,
      targetName: uploadForm.targetName || undefined,
      displayName: uploadForm.displayName || undefined,
      description: uploadForm.description || undefined,
      icon: uploadForm.icon || undefined,
      visibility: uploadForm.visibility,
      tags: uploadForm.tags || undefined
    })
    success('上传成功')
    uploadDialogVisible.value = false
    // 重置表单
    uploadFile.value = null
    uploadForm.targetName = ''
    uploadForm.displayName = ''
    uploadForm.description = ''
    uploadForm.icon = ''
    uploadForm.visibility = 1
    uploadForm.tags = ''
    await getList()
  } catch (e) {
    error('上传失败：' + (e as Error).message)
  } finally {
    uploading.value = false
  }
}

/** 打开编辑 */
const openEdit = (row: SkillMeta) => {
  editForm.id = row.id
  editForm.skillName = row.skillName
  editForm.displayName = row.displayName
  editForm.description = row.description || ''
  editForm.icon = row.icon || ''
  editForm.visibility = row.visibility ?? 1
  editForm.tags = row.tags || ''
  editForm.status = row.status ?? 1
  editDialogVisible.value = true
}

/** 保存编辑 */
const handleEdit = async () => {
  editLoading.value = true
  try {
    await SkillMetaApi.updateSkillMeta({
      id: editForm.id,
      skillName: editForm.skillName,
      displayName: editForm.displayName,
      description: editForm.description,
      icon: editForm.icon,
      visibility: editForm.visibility,
      tags: editForm.tags,
      status: editForm.status
    } as SkillMeta)
    success('更新成功')
    editDialogVisible.value = false
    await getList()
  } catch (e) {
    error('更新失败：' + (e as Error).message)
  } finally {
    editLoading.value = false
  }
}

/** 查看详情 */
const openDetail = (row: SkillMeta) => {
  detailRow.value = row
  detailVisible.value = true
}

/** 删除 */
const handleDelete = async (id: number) => {
  try {
    await delConfirm()
    await SkillMetaApi.deleteSkillMeta(id)
    success('删除成功')
    await getList()
  } catch {}
}

/** 初始化 **/
onMounted(() => {
  getList()
})
</script>
