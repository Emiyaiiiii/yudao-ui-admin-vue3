<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible" width="700">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="110px"
      v-loading="formLoading"
    >
      <el-form-item :label="builtinLabel('name', '知识库名称')" prop="name">
        <el-input v-model="formData.name" placeholder="请输入知识库名称" />
      </el-form-item>
      <el-form-item label="所属分类" prop="categoryId">
        <el-tree-select
          v-model="formData.categoryId"
          :data="categoryTree"
          :props="defaultTreeProps"
          check-strictly
          default-expand-all
          placeholder="请选择知识库分类"
          style="width: 100%"
          @change="handleCategoryChange"
          :disabled="categoryDisabled"
        />
      </el-form-item>
      <!-- 层级配置由分类自动决定，仅展示 -->
      <el-form-item v-if="selectedLevelName" label="层级配置">
        <el-tag type="info" size="large">
          {{ selectedLevelName }}（{{ visibilityRuleLabel(selectedVisibilityRule) }}）
        </el-tag>
      </el-form-item>
      <el-form-item v-if="isSelectedProjectCategory" label="项目成员">
        <el-tag type="warning" size="large">项目成果库</el-tag>
        <span class="project-flag-tip">将自动纳入项目成员管理，创建人会成为首个项目成员</span>
      </el-form-item>

      <!-- 所有者：根据选中的层级配置动态切换 -->
      <!-- ownerDim=1（用户）→ 个人知识库，自动设为当前用户 -->
      <el-form-item v-if="selectedOwnerDim === 1" label="所有者">
        <el-tag type="primary" size="large">{{ currentUserNickname }}</el-tag>
      </el-form-item>
      <el-form-item v-if="selectedOwnerDim === 2" label="所属部门" prop="ownerId">
        <el-tree-select
          v-model="formData.ownerId"
          :data="deptTree"
          :props="defaultTreeProps"
          check-strictly
          default-expand-all
          placeholder="请选择所属部门"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="图片处理方案" prop="imageStrategy">
        <el-select v-model="formData.imageStrategy" placeholder="请选择图片处理方案" clearable style="width: 100%">
          <el-option label="纯文本（图片只回显URL）" value="none" />
          <el-option label="OCR文字（提取图片文字入库）" value="ocr" />
          <el-option label="VL总结（大模型看图生成总结）" value="vl_summary" />
          <el-option label="视觉召回（多模态嵌入图片像素）" value="vision" />
        </el-select>
      </el-form-item>

      <el-form-item label="封面图片" prop="coverUrl">
        <UploadImg v-model="formData.coverUrl" width="200px" height="120px" />
      </el-form-item>
      <el-form-item :label="builtinLabel('description', '描述')" prop="description">
        <Editor v-model="formData.description" height="150px" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :value="0">启用</el-radio>
          <el-radio :value="1">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
      <!-- 只有个人知识库（rule=1）才能公开到广场 -->
      <el-form-item v-if="selectedVisibilityRule === 1" label="公开到广场" prop="isPublic">
        <el-switch
          v-model="formData.isPublic"
          :active-value="1"
          :inactive-value="0"
          active-text="公开"
          inactive-text="不公开"
        />
      </el-form-item>
      <el-form-item label="共享部门" prop="shareDeptIds" v-if="selectedVisibilityRule === 5">
        <el-select
          v-model="formData.shareDeptIds"
          multiple
          filterable
          placeholder="请选择共享部门"
          style="width: 100%"
        >
          <el-option
            v-for="dept in deptOptions"
            :key="dept.id"
            :label="dept.name"
            :value="dept.id"
          />
        </el-select>
      </el-form-item>

      <!-- ========== KB 级处理配置（留空回退租户级默认） ========== -->
      <el-divider content-position="left">
        <span class="custom-field-divider">处理配置</span>
      </el-divider>
      <el-collapse v-model="activeConfigPanels" class="process-config-collapse">
        <!-- 切片配置 -->
        <el-collapse-item title="切片配置" name="chunking">
          <el-form-item label="切片策略">
            <el-select v-model="formData.processConfig.chunking.strategy" placeholder="默认 fixed_size" clearable style="width: 100%">
              <el-option v-for="opt in chunkStrategyOptions" :key="opt.value" :label="opt.label" :value="opt.value">
                <div class="strategy-option">
                  <span class="strategy-name">{{ opt.label }}</span>
                  <span class="strategy-desc">{{ opt.desc }}</span>
                </div>
              </el-option>
            </el-select>
            <!-- 当前选中策略的适用文档说明 -->
            <div v-if="selectedChunkStrategy" class="strategy-tip">
              <span class="strategy-tip-label">适用文档：</span>{{ selectedChunkStrategy.desc }}
            </div>
          </el-form-item>
          <el-form-item label="分片大小">
            <el-input-number v-model="formData.processConfig.chunking.chunk_size" :min="50" :max="10000" :step="50" controls-position="right" style="width: 100%" placeholder="默认 500" />
          </el-form-item>
          <el-form-item label="重叠大小">
            <el-input-number v-model="formData.processConfig.chunking.chunk_overlap" :min="0" :max="500" :step="10" controls-position="right" style="width: 100%" placeholder="默认 50" />
          </el-form-item>
          <el-form-item label="最小分片">
            <el-input-number v-model="formData.processConfig.chunking.min_chunk_size" :min="0" :max="2000" :step="10" controls-position="right" style="width: 100%" placeholder="默认 100" />
          </el-form-item>
          <el-form-item label="最大分片">
            <el-input-number v-model="formData.processConfig.chunking.max_chunk_size" :min="100" :max="10000" :step="100" controls-position="right" style="width: 100%" placeholder="默认 2000" />
          </el-form-item>
          <el-form-item v-if="formData.processConfig.chunking.strategy === 'parent_child'" label="父块大小">
            <el-input-number v-model="formData.processConfig.chunking.parent_chunk_size" :min="100" :max="20000" :step="100" controls-position="right" style="width: 100%" placeholder="默认 chunk_size×4" />
          </el-form-item>
          <el-form-item v-if="formData.processConfig.chunking.strategy === 'parent_child'" label="子块大小">
            <el-input-number v-model="formData.processConfig.chunking.child_chunk_size" :min="50" :max="5000" :step="50" controls-position="right" style="width: 100%" placeholder="默认 chunk_size" />
          </el-form-item>
          <el-form-item v-if="formData.processConfig.chunking.strategy === 'parent_child'" label="子块重叠">
            <el-input-number v-model="formData.processConfig.chunking.child_chunk_overlap" :min="0" :max="500" :step="10" controls-position="right" style="width: 100%" placeholder="默认 chunk_overlap" />
          </el-form-item>
          <el-form-item label="标题面包屑（ContextHeader）">
            <el-switch v-model="formData.processConfig.chunking.context_header" active-text="开启" inactive-text="关闭" />
            <span class="process-config-tip">切分时前缀拼章节标题面包屑</span>
          </el-form-item>
        </el-collapse-item>

        <!-- 检索配置 -->
        <el-collapse-item title="检索配置" name="retrieval">
          <el-form-item label="TopK">
            <el-input-number v-model="formData.processConfig.retrieval.top_k" :min="1" :max="100" :step="1" controls-position="right" style="width: 100%" placeholder="默认 30" />
          </el-form-item>
          <el-form-item label="检索方式">
            <el-select v-model="formData.processConfig.retrieval.search_type" placeholder="默认 unified" clearable style="width: 100%">
              <el-option label="统一检索（unified）" value="unified" />
              <el-option label="向量检索（vector）" value="vector" />
              <el-option label="关键词检索（keyword）" value="keyword" />
              <el-option label="混合检索（hybrid）" value="hybrid" />
            </el-select>
          </el-form-item>
          <el-form-item label="并行检索">
            <el-switch v-model="formData.processConfig.retrieval.use_parallel" />
          </el-form-item>
          <el-form-item label="分数阈值">
            <el-input-number v-model="formData.processConfig.retrieval.score_threshold" :min="0" :max="1" :step="0.05" :precision="2" controls-position="right" style="width: 100%" placeholder="默认 0.5" />
          </el-form-item>
          <el-form-item label="向量权重">
            <el-input-number v-model="formData.processConfig.retrieval.vector_weight" :min="0" :max="1" :step="0.05" :precision="2" controls-position="right" style="width: 100%" placeholder="默认 0.7" />
          </el-form-item>
          <el-form-item label="关键词权重">
            <el-input-number v-model="formData.processConfig.retrieval.keyword_weight" :min="0" :max="1" :step="0.05" :precision="2" controls-position="right" style="width: 100%" placeholder="默认 0.3" />
          </el-form-item>
          <el-form-item label="并行线程数">
            <el-input-number v-model="formData.processConfig.retrieval.parallel_workers" :min="1" :max="20" :step="1" controls-position="right" style="width: 100%" placeholder="默认 5" />
          </el-form-item>
          <el-form-item label="并行超时(s)">
            <el-input-number v-model="formData.processConfig.retrieval.parallel_timeout" :min="1" :max="120" :step="1" :precision="1" controls-position="right" style="width: 100%" placeholder="默认 10" />
          </el-form-item>
        </el-collapse-item>

        <!-- 重排配置 -->
        <el-collapse-item title="重排配置" name="rerank">
          <el-form-item label="启用重排">
            <el-switch v-model="formData.processConfig.rerank.enabled" />
          </el-form-item>
          <el-form-item label="重排TopK">
            <el-input-number v-model="formData.processConfig.rerank.top_k" :min="1" :max="100" :step="1" controls-position="right" style="width: 100%" placeholder="默认 30" />
          </el-form-item>
          <el-form-item label="超时(s)">
            <el-input-number v-model="formData.processConfig.rerank.timeout" :min="1" :max="120" :step="1" controls-position="right" style="width: 100%" placeholder="默认 30" />
          </el-form-item>
        </el-collapse-item>

        <!-- 模型配置 -->
        <el-collapse-item title="模型配置" name="model">
          <el-form-item label="向量模型">
            <el-select v-model="formData.processConfig.model.embedding_model_uid" placeholder="留空使用租户默认向量模型" clearable filterable style="width: 100%">
              <el-option v-for="m in embeddingModelOptions" :key="m.uid" :label="m.name" :value="m.uid" />
            </el-select>
          </el-form-item>
          <el-form-item label="重排模型">
            <el-select v-model="formData.processConfig.model.rerank_model_uid" placeholder="留空使用租户默认重排模型" clearable filterable style="width: 100%">
              <el-option v-for="m in rerankModelOptions" :key="m.uid" :label="m.name" :value="m.uid" />
            </el-select>
          </el-form-item>
        </el-collapse-item>

        <!-- 后处理配置（#10 可勾选独立开关，缺模型时自动跳过） -->
        <el-collapse-item title="后处理配置" name="postprocess">
          <el-form-item label="问题生成">
            <el-switch v-model="formData.processConfig.postprocess.question_enabled" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="文档摘要">
            <el-switch v-model="formData.processConfig.postprocess.summary_enabled" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="知识图谱">
            <el-switch v-model="formData.processConfig.postprocess.graph_enabled" :disabled="!neo4jReady" active-text="开启" inactive-text="关闭" />
            <span v-if="!neo4jReady" class="process-config-tip">需先部署 Neo4j 基础设施（未配置时不可选）</span>
            <span v-else class="process-config-tip">已配置 Neo4j，可启用图谱抽取</span>
          </el-form-item>
          <el-form-item label="问答对抽取">
            <el-switch v-model="formData.processConfig.postprocess.extract_enabled" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="Wiki 生成">
            <el-switch v-model="formData.processConfig.postprocess.wiki_enabled" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <div class="process-config-hint">各开关独立勾选；缺模型/未部署依赖时该阶段自动跳过，不阻塞入库</div>
        </el-collapse-item>
      </el-collapse>

      <!-- ========== 自定义字段（由分类列模板驱动） ========== -->
      <template v-if="customFields.length">
        <el-divider content-position="left">
          <span class="custom-field-divider">自定义字段</span>
        </el-divider>
        <el-form-item v-for="f in customFields" :key="f.key" :label="f.label || '自定义字段'">
          <!-- 文本 -->
          <el-input v-if="f.type === 'text'" v-model="extForm[f.key || '']" placeholder="请输入" />
          <!-- 数字 -->
          <el-input-number
            v-else-if="f.type === 'number'"
            v-model="extForm[f.key || '']"
            :controls="false"
            placeholder="请输入数字"
            style="width: 100%"
          />
          <!-- 日期 -->
          <el-date-picker
            v-else-if="f.type === 'date'"
            v-model="extForm[f.key || '']"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="请选择日期"
            style="width: 100%"
          />
          <!-- 成员（多选） -->
          <el-select
            v-else-if="f.type === 'member'"
            v-model="extForm[f.key || '']"
            multiple
            filterable
            remote
            :reserve-keyword="false"
            :remote-method="searchUsers"
            :loading="userSearchLoading"
            placeholder="输入姓名搜索，可多选"
            style="width: 100%"
            @change="showSelectedUsersOnly"
          >
            <el-option v-for="u in userOptions" :key="u.id" :label="u.nickname" :value="u.id" />
          </el-select>
          <!-- 部门 -->
          <el-tree-select
            v-else-if="f.type === 'dept'"
            v-model="extForm[f.key || '']"
            :data="allDeptTree"
            :props="defaultTreeProps"
            check-strictly
            default-expand-all
            placeholder="请选择部门"
            style="width: 100%"
          />
          <!-- 下拉选项 -->
          <el-select v-else-if="f.type === 'select'" v-model="extForm[f.key || '']" placeholder="请选择" style="width: 100%">
            <el-option v-for="opt in f.options" :key="opt" :label="opt" :value="opt" />
          </el-select>
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
import { LibraryApi, Library } from '@/api/kb/library'
import { CategoryApi } from '@/api/kb/category'
import { LevelConfigApi } from '@/api/kb/levelconfig'
import { UserDeptApi } from '@/api/kb/userdept'
import { ModelConfigApi } from '@/api/kb/modelconfig'
import { ChunkMethodApi } from '@/api/kb/chunkmethod'
import { ref, reactive, computed } from 'vue'
import * as SystemApi from '@/api/system/dept'
import { getSimpleUserListByIds, getSimpleUserListByNickname } from '@/api/system/user'
import { useUserStore } from '@/store/modules/user'
import { handleTree } from '@/utils/tree'
import { defaultProps } from '@/utils/tree'
import { parseColumnConfig, getCustomColumns, type KbColumn } from '../columnConfig'

/** 知识库 表单 */
defineOptions({ name: 'LibraryForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref({
  id: undefined,
  name: undefined,
  categoryId: undefined,
  kbLevelId: undefined,
  ownerId: undefined,
  description: undefined,
  coverUrl: undefined,
  docCount: undefined,
  status: 0,
  isPublic: 0,
  isProject: 0,
  imageStrategy: '',
  shareDeptIds: [],
  processConfig: {
    chunking: { strategy: '', chunk_size: undefined, chunk_overlap: undefined, min_chunk_size: undefined, max_chunk_size: undefined, parent_chunk_size: undefined, child_chunk_size: undefined, child_chunk_overlap: undefined, context_header: false },
    retrieval: { top_k: undefined, search_type: '', use_parallel: undefined, score_threshold: undefined, vector_weight: undefined, keyword_weight: undefined, parallel_workers: undefined, parallel_timeout: undefined },
    rerank: { enabled: undefined, timeout: undefined, top_k: undefined },
    model: { embedding_model_uid: '', rerank_model_uid: '' },
    postprocess: { question_enabled: false, summary_enabled: false, graph_enabled: false, extract_enabled: false, wiki_enabled: false }
  }
})
const formRules = reactive({
  name: [{ required: true, message: '知识库名称不能为空', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择知识库分类', trigger: 'change' }]
})
const formRef = ref() // 表单 Ref

// 处理配置折叠面板（默认收起）
const activeConfigPanels = ref<string[]>([])

/** 切片策略选项（含适用文档说明）。优先从后端 kb_chunk_method 接口加载（name/description），
 *  加载失败回退内置说明，保证策略与后端 seed 一致、前端不硬编码。 */
const chunkStrategyOptions = ref<{ value: string; label: string; desc: string }[]>([])

/** 内置回退说明（仅接口不可用时使用） */
const CHUNK_STRATEGY_FALLBACK: { value: string; label: string; desc: string }[] = [
  { value: 'fixed_size', label: '固定长度（fixed_size）', desc: '通用文档、纯文本、各类格式的兜底方案，按固定字数切分' },
  { value: 'sentence', label: '按句子切分（sentence）', desc: '句读边界清晰的文本，避免切断完整句子' },
  { value: 'paragraph', label: '按段落切分（paragraph）', desc: '段落结构清晰的文档（报告、制度、说明书）' },
  { value: 'recursive', label: '递归切分（recursive）', desc: 'Markdown/代码/层级结构文档，按分隔符层级递归' },
  { value: 'semantic', label: '语义切分（semantic）', desc: '需嵌入模型；按语义相似度聚合段落，适合概念密集内容' },
  { value: 'parent_child', label: '父-子两级（parent_child）', desc: '需要精确片段召回 + 大上下文回显（长文档、问答型知识库）' },
  { value: 'protected', label: '保护性切分（protected）', desc: '含表格/代码/公式的结构化文档，保证这些块不被切断' },
  { value: 'adaptive', label: '自适应切分（adaptive）', desc: '按文档内容自动选档，各类文档通用，推荐默认' }
]

/** 加载切片策略选项（后端优先，回退内置） */
const loadChunkStrategyOptions = async () => {
  try {
    const list: any[] = await ChunkMethodApi.getSimpleList()
    if (Array.isArray(list) && list.length) {
      chunkStrategyOptions.value = list
        .filter((m) => m?.code)
        .map((m) => ({ value: m.code, label: m.name || m.code, desc: m.description || '' }))
      return
    }
  } catch {
    // 接口不可用，走内置回退
  }
  chunkStrategyOptions.value = [...CHUNK_STRATEGY_FALLBACK]
}

/** 当前选中的切片策略对象（用于显示适用文档说明） */
const selectedChunkStrategy = computed(() => {
  const v = formData.value.processConfig.chunking.strategy
  if (!v) return undefined
  return chunkStrategyOptions.value.find((o) => o.value === v)
})

// 模型选项（向量/重排）
const embeddingModelOptions = ref<any[]>([])
const rerankModelOptions = ref<any[]>([])

/** Neo4j 基础设施是否就绪（N1）：false 时 GraphEnabled 开关置灰不可选 */
const neo4jReady = ref(false)

// 分类树
const categoryTree = ref<any[]>([])
const defaultTreeProps = { ...defaultProps, label: 'name' }

// 层级配置
const levelConfigMap = ref<Record<number, any>>({})      // 层级配置ID → 完整配置
const categoryKbLevelMap = ref<Record<number, number>>({}) // 分类ID → 层级配置ID
const selectedLevelName = ref('')   // 当前选中层级配置名称（仅展示用）
const selectedOwnerDim = ref(0)     // 当前选中层级配置的 owner_dim
const selectedVisibilityRule = ref(0) // 当前选中层级配置的 visibilityRule

// 部门列表
const deptTree = ref<any[]>([])
const deptOptions = ref<any[]>([])
const allDeptTree = ref<any[]>([]) // 完整部门树（用于自定义字段的部门选择）
const allDeptList = ref<any[]>([]) // 扁平部门，用于院级默认所属部门

const isRootDeptParent = (parentId: any) =>
  parentId == null || parentId === 0 || parentId === '0'

/** 当前用户部门链上的第二级（根是第一级「黄河勘测规划设计研究院」） */
const findInstituteDefaultDeptId = () => {
  const userDeptId = userStore.getUser?.deptId
  if (userDeptId == null || userDeptId === 0) return undefined
  const map = new Map<string, any>()
  allDeptList.value.forEach((dept) => {
    if (dept?.id != null) map.set(String(dept.id), dept)
  })
  const chain: any[] = []
  const seen = new Set<string>()
  let current = map.get(String(userDeptId))
  while (current && !seen.has(String(current.id))) {
    seen.add(String(current.id))
    chain.push(current)
    if (isRootDeptParent(current.parentId)) break
    current = map.get(String(current.parentId))
  }
  if (chain.length < 2) return undefined
  return chain[chain.length - 2].id
}

/** 仅院级新建：所属部门未选时，默认用户部门的第二级 */
const applyInstituteDefaultOwner = () => {
  if (formType.value === 'update') return
  if (selectedOwnerDim.value !== 2 || selectedVisibilityRule.value !== 2) return
  if (formData.value.ownerId != null && formData.value.ownerId !== '') return
  const deptId = findInstituteDefaultDeptId()
  if (deptId != null) {
    formData.value.ownerId = deptId
  }
}

// 用户列表（用于自定义字段的成员选择）
const userOptions = ref<any[]>([])
const selectedUserMap = ref(new Map<string, any>())
const userSearchLoading = ref(false)
let userSearchSeq = 0

const collectSelectedMemberIds = () => {
  const ids: string[] = []
  customFields.value
    .filter((f) => f.type === 'member')
    .forEach((f) => {
      const v = extForm.value[f.key || '']
      if (Array.isArray(v)) ids.push(...v.map((id: any) => String(id)))
    })
  return ids
}

const rememberSelectedUsers = () => {
  const selected = new Set(collectSelectedMemberIds())
  const next = new Map<string, any>()
  const take = (u?: any) => {
    if (!u) return
    const id = String(u.id)
    if (selected.has(id)) next.set(id, { ...u, id })
  }
  userOptions.value.forEach(take)
  selectedUserMap.value.forEach(take)
  selectedUserMap.value = next
}

const showSelectedUsersOnly = () => {
  rememberSelectedUsers()
  userOptions.value = Array.from(selectedUserMap.value.values())
}

const searchUsers = async (query: string) => {
  const keyword = (query || '').trim()
  rememberSelectedUsers()
  if (!keyword) {
    userOptions.value = Array.from(selectedUserMap.value.values())
    return
  }
  const seq = ++userSearchSeq
  userSearchLoading.value = true
  try {
    const list = await getSimpleUserListByNickname(keyword)
    if (seq !== userSearchSeq) return
    const map = new Map(selectedUserMap.value)
    ;(list || []).forEach((u: any) => map.set(String(u.id), { ...u, id: String(u.id) }))
    userOptions.value = Array.from(map.values())
  } finally {
    if (seq === userSearchSeq) userSearchLoading.value = false
  }
}

/** 按用户ID批量加载昵称（编辑回显成员用；仅查已选用户，避免全量拉取用户列表） */
const fetchUsersByIds = async (ids: Array<number | string>) => {
  const valid = (ids || []).filter((id) => id !== undefined && id !== null && id !== '')
  if (!valid.length) return
  try {
    const res: any = await getSimpleUserListByIds(valid)
    const list = Array.isArray(res) ? res : []
    const map = new Map(selectedUserMap.value)
    ;(list || []).forEach((u: any) => map.set(String(u.id), { ...u, id: String(u.id) }))
    selectedUserMap.value = map
    userOptions.value = Array.from(map.values())
  } catch (e) {
    console.log('加载成员昵称失败', e)
  }
}

// 自定义字段
const categoryCustomFieldsMap = ref<Record<number, KbColumn[]>>({}) // 分类ID → 自定义字段定义
const categoryColumnMap = ref<Record<number, KbColumn[]>>({}) // 分类ID → 完整列定义（含内置列标题）
const categoryMetaMap = ref<Record<number, { name?: string; parentId?: number; isProject?: number }>>({})
const customFields = ref<KbColumn[]>([]) // 当前分类的自定义字段
const extForm = ref<Record<string, any>>({}) // 自定义字段的表单值

/** 当前所选分类是否属于院级/公司项目成果库 */
const isSelectedProjectCategory = computed(() => isProjectCategoryById(formData.value.categoryId))

const isProjectCategoryById = (categoryId?: number): boolean => {
  if (!categoryId) return false
  const names: string[] = []
  let id: number | undefined = categoryId
  const seen = new Set<number>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const meta = categoryMetaMap.value[id]
    if (!meta) break
    if (meta.isProject === 1) return true
    names.push(meta.name || '')
    id = meta.parentId
  }
  const hasOutcome = names.some((n) => n.includes('项目成果'))
  const underOrg = names.some(
    (n) => n.includes('院级') || n.includes('公司知识库') || (n.includes('公司') && n.includes('知识库'))
  )
  return hasOutcome && underOrg
}

// 当前用户
const userStore = useUserStore()
const currentUserId = computed(() => userStore.getUser?.id)
const currentUserNickname = computed(() => userStore.getUser?.nickname || '当前用户')
// 是否为超管/租户管理员（跳过过滤，显示全部）
const isSuperAdmin = computed(() => {
  const roles = userStore.roles || []
  return roles.includes('super_admin') || roles.includes('tenant_admin')
})

// 可见规则标签映射
const visibilityRuleLabel = (rule: number) => {
  const map: Record<number, string> = {
    1: '按所有者',
    2: '按归属部门',
    3: '全员',
    5: '指定部门列表'
  }
  return map[rule] || `规则${rule}`
}

/** 当前分类下内置列的标题（跟随分类表头配置的重命名；未配置则用默认标题） */
const builtinLabel = (builtin: string, fallback: string): string => {
  const cols = categoryColumnMap.value[formData.value.categoryId] || []
  const col = cols.find((c) => c.source === 'builtin' && c.builtin === builtin)
  return col?.label || fallback
}

/** 层级配置变更时，更新 owner_dim、visibilityRule 和显示名称 */
const applyLevelConfig = (kbLevelId: number, preserveOwnerId = false) => {
  const cfg = levelConfigMap.value[kbLevelId]
  if (cfg) {
    formData.value.kbLevelId = kbLevelId
    selectedLevelName.value = cfg.levelName || ''
    selectedOwnerDim.value = cfg.ownerDim ?? 0
    selectedVisibilityRule.value = cfg.visibilityRule ?? 0
    // 编辑回显时保留已加载的 ownerId，不重置
    if (!preserveOwnerId) {
      // ownerDim=1（用户）→ 个人知识库，自动设为当前用户
      // ownerDim=2 且院级（rule=2）→ 默认用户部门第二级；公司/共享仍留空由用户选
      if (cfg.ownerDim === 1) {
        formData.value.ownerId = currentUserId.value
      } else {
        formData.value.ownerId = undefined
        applyInstituteDefaultOwner()
      }
      // 非个人知识库不能公开到广场
      if (cfg.visibilityRule !== 1) {
        formData.value.isPublic = 0
      }
    }
  } else {
    selectedLevelName.value = ''
    selectedOwnerDim.value = 0
    selectedVisibilityRule.value = 0
  }
}

/** 分类变更时，自动填入对应的层级配置 + 加载自定义字段 */
const handleCategoryChange = (categoryId: number) => {
  if (!categoryId) {
    formData.value.kbLevelId = undefined
    selectedLevelName.value = ''
    selectedOwnerDim.value = 0
    selectedVisibilityRule.value = 0
    customFields.value = []
    extForm.value = {}
    return
  }
  const kbLevelId = categoryKbLevelMap.value[categoryId]
  if (kbLevelId) {
    applyLevelConfig(kbLevelId)
  }
  // 加载该分类的自定义字段
  customFields.value = categoryCustomFieldsMap.value[categoryId] || []
  extForm.value = {}
}

/** 加载初始化数据 */
const loadOptions = async () => {
  // 并行加载分类、层级配置、部门、管理员部门、模型列表（用户不预拉全量：成员下拉远程搜索 + 编辑回显按已选 ids 补昵称）
  const [categoryData, levelData, deptData, adminDeptIds, modelData, infraData] = await Promise.all([
    CategoryApi.getCategoryList(),
    LevelConfigApi.getSimpleLevelConfigList(),
    SystemApi.getSimpleDeptList(),
    UserDeptApi.getMyAdminDepts(),
    ModelConfigApi.getSimpleList().catch(() => []),
    LibraryApi.getPostprocessInfra().catch(() => ({ neo4jReady: false }))
  ])

  // 后处理基础设施就绪状态（Neo4j）：未配置时 GraphEnabled 置灰
  neo4jReady.value = !!infraData?.neo4jReady

  // 按 modelType 拆分向量/重排模型
  const models: any[] = Array.isArray(modelData) ? modelData : []
  embeddingModelOptions.value = models.filter((m) => (m.modelType || '').toLowerCase() === 'embedding')
  rerankModelOptions.value = models.filter((m) => (m.modelType || '').toLowerCase() === 'rerank')

  // 加载切片策略选项（后端 kb_chunk_method 优先，回退内置说明）
  await loadChunkStrategyOptions()

  // 构建层级配置ID → 完整配置映射
  levelConfigMap.value = {}
  levelData.forEach((item: any) => {
    levelConfigMap.value[item.id] = item
  })

  // 完整部门树 + 用户列表（用于自定义字段）；用户改为远程搜索 + 已选回显按需加载
  allDeptList.value = deptData || []
  allDeptTree.value = handleTree(deptData)

  // 构建分类ID → 完整列定义 + 自定义字段映射（从 columnConfig 解析）
  const columnMap: Record<number, KbColumn[]> = {}
  const customMap: Record<number, KbColumn[]> = {}
  const metaMap: Record<number, { name?: string; parentId?: number; isProject?: number }> = {}
  const collectCustom = (items: any[]) => {
    ;(items || []).forEach((item: any) => {
      if (item.id) {
        metaMap[item.id] = { name: item.name, parentId: item.parentId, isProject: item.isProject }
      }
      if (item.id && item.columnConfig) {
        const cols = parseColumnConfig(item.columnConfig)
        columnMap[item.id] = cols
        customMap[item.id] = getCustomColumns(cols)
      }
      if (item.children) collectCustom(item.children)
    })
  }
  collectCustom(categoryData)
  categoryColumnMap.value = columnMap
  categoryCustomFieldsMap.value = customMap
  categoryMetaMap.value = metaMap

  // 超管/租户管理员 → 显示全部，不过滤
  if (isSuperAdmin.value) {
    categoryTree.value = handleTree(categoryData, 'id', 'parentId')
    deptTree.value = handleTree(deptData)
    deptOptions.value = deptData
    // 构建分类ID → 层级配置ID 映射
    const catMap: Record<number, number> = {}
    const flatten = (items: any[]) => {
      items.forEach((item: any) => {
        if (item.kbLevelId) catMap[item.id] = item.kbLevelId
        if (item.children) flatten(item.children)
      })
    }
    flatten(categoryData)
    categoryKbLevelMap.value = catMap
    return
  }

  // 构建管理员部门ID集合（用于过滤）
  const adminDeptSet = new Set<number>(adminDeptIds || [])
  const hasAnyAdminDept = adminDeptSet.size > 0

  // 过滤分类树：只显示用户有权限创建的分类
  // - rule=1（个人知识库）：所有人可见
  // - 其他：只有管理员可见
  const filterCategories = (items: any[]): any[] => {
    return items
      .map((item: any) => {
        const children = item.children ? filterCategories(item.children) : []
        const kbLevelId = item.kbLevelId
        if (!kbLevelId) return null
        const cfg = levelConfigMap.value[kbLevelId]
        if (!cfg) return null
        // 个人知识库（rule=1）→ 所有人可见
        if (cfg.visibilityRule === 1) return { ...item, children }
        // 其他 → 仅管理员可见
        if (hasAnyAdminDept) return { ...item, children }
        // 不满足条件但子节点有内容 → 保留父节点作为分组
        if (children.length > 0) return { ...item, children }
        return null
      })
      .filter(Boolean) as any[]
  }
  const filteredCategoryData = filterCategories(categoryData)
  categoryTree.value = handleTree(filteredCategoryData, 'id', 'parentId')

  // 构建分类ID → 层级配置ID 映射
  const catMap: Record<number, number> = {}
  const flatten = (items: any[]) => {
    items.forEach((item: any) => {
      if (item.kbLevelId) catMap[item.id] = item.kbLevelId
      if (item.children) flatten(item.children)
    })
  }
  flatten(filteredCategoryData)
  categoryKbLevelMap.value = catMap

  // 过滤部门树：只显示用户作为管理员的部门（及其祖先节点以保持树结构）
  const filterDeptTree = (items: any[]): any[] => {
    return items
      .map((item: any) => {
        const children = item.children ? filterDeptTree(item.children) : []
        // 保留：是管理员部门 或 有管理员子节点
        if (adminDeptSet.has(item.id) || children.length > 0) {
          return { ...item, children }
        }
        return null
      })
      .filter(Boolean) as any[]
  }
  const filteredDeptTree = filterDeptTree(handleTree(deptData))
  deptTree.value = filteredDeptTree
  deptOptions.value = deptData
}

const categoryDisabled = ref(false) // 分类选择是否禁用（从总览页预选时禁用）

/** 打开弹窗 */
const open = async (type: string, id?: number, presetCategoryId?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  categoryDisabled.value = false
  // 加载备选项
  await loadOptions()
  // 如果传入了预选分类，直接选中并禁用分类选择
  if (presetCategoryId) {
    formData.value.categoryId = presetCategoryId
    categoryDisabled.value = true
    handleCategoryChange(presetCategoryId)
  }
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      const data = await LibraryApi.getLibrary(id)
      // 一次性构造 formData：processConfig 与默认结构合并，避免中间态缺 retrieval 等分组导致模板访问 undefined 报错
      formData.value = { ...data, processConfig: mergeProcessConfig(data.processConfig) }
      // 回显时同步层级配置信息（保留已加载的 ownerId，避免被重置）
      if (data.kbLevelId) {
        applyLevelConfig(data.kbLevelId, true)
      }
      // 回显自定义字段
      customFields.value = categoryCustomFieldsMap.value[data.categoryId] || []
      applyExtValues(data.extValues)
      rememberSelectedUsers()
      // 异步补成员昵称：不阻塞弹窗初始化（内部已 try/catch）
      fetchUsersByIds(collectSelectedMemberIds())
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗

/** 回显自定义字段值（后端存的是字符串，按类型转成表单值） */
const applyExtValues = (extValues?: Record<string, string>) => {
  extForm.value = {}
  if (!extValues) return
  customFields.value.forEach((f) => {
    const key = f.key
    if (!key) return
    const raw = extValues[key]
    if (raw === undefined || raw === null) return
    if (f.type === 'member') {
      try {
        const parsed = JSON.parse(raw)
        extForm.value[key] = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : []
      } catch {
        extForm.value[key] = []
      }
    } else if (f.type === 'number') {
      extForm.value[key] = Number(raw)
    } else {
      // text / date / dept / select：均保持字符串。
      // dept 存的是雪花ID字符串，转 Number 会丢精度且与树节点的字符串 id 匹配不上
      extForm.value[key] = raw
    }
  })
}

/** 序列化自定义字段值为字符串 map（成员多选 → JSON 数组字符串） */
const serializeExtValues = (): Record<string, string> => {
  const result: Record<string, string> = {}
  customFields.value.forEach((f) => {
    const key = f.key
    if (!key) return
    const v = extForm.value[key]
    if (v === undefined || v === null || v === '') return
    if (f.type === 'member') {
      result[key] = JSON.stringify(v)
    } else {
      result[key] = String(v)
    }
  })
  return result
}

/** 提交表单 */
const emit = defineEmits(['success']) // 定义 success 事件，用于操作成功后的回调
const submitForm = async () => {
  // 校验表单
  await formRef.value.validate()
  // 提交请求
  formLoading.value = true
  try {
    // 用浅拷贝构造请求体，避免直接改写响应式 formData.value 触发模板重渲染（top_k undefined）或污染回显数据
    const req = { ...formData.value } as any
    // 删除 docCount，创建时不需要
    delete req.docCount
    // 清理 processConfig：仅保留显式设置的值，空值不覆盖租户级默认
    req.processConfig = sanitizeProcessConfig(formData.value.processConfig)
    // 附带自定义字段值
    req.extValues = serializeExtValues()
    req.isProject = isSelectedProjectCategory.value ? 1 : 0
    req.memberIds = customFields.value
      .filter((f) => f.type === 'member')
      .flatMap((f) => (Array.isArray(extForm.value[f.key || '']) ? extForm.value[f.key || ''] : []))
      .map((id: any) => String(id))
    if (formType.value === 'create') {
      applyInstituteDefaultOwner()
      req.ownerId = formData.value.ownerId
      await LibraryApi.createLibrary(req)
      message.success(t('common.createSuccess'))
    } else {
      await LibraryApi.updateLibrary(req)
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
    name: undefined,
    categoryId: undefined,
    kbLevelId: undefined,
    ownerId: undefined,
    description: undefined,
    coverUrl: undefined,
    docCount: undefined,
    status: 0,
    isPublic: 0,
    isProject: 0,
    imageStrategy: '',
    shareDeptIds: [],
    processConfig: {
      chunking: { strategy: '', chunk_size: undefined, chunk_overlap: undefined, min_chunk_size: undefined, max_chunk_size: undefined, parent_chunk_size: undefined, child_chunk_size: undefined, child_chunk_overlap: undefined, context_header: false },
      retrieval: { top_k: undefined, search_type: '', use_parallel: undefined, score_threshold: undefined, vector_weight: undefined, keyword_weight: undefined, parallel_workers: undefined, parallel_timeout: undefined },
      rerank: { enabled: undefined, timeout: undefined, top_k: undefined },
      model: { embedding_model_uid: '', rerank_model_uid: '' },
      postprocess: { question_enabled: false, summary_enabled: false, graph_enabled: false, extract_enabled: false, wiki_enabled: false }
    }
  }
  selectedLevelName.value = ''
  selectedOwnerDim.value = 0
  selectedVisibilityRule.value = 0
  customFields.value = []
  extForm.value = {}
  activeConfigPanels.value = []
  formRef.value?.resetFields()
}

/**
 * 合并后端返回的 processConfig 与默认结构。
 * 保证 v-model 绑定的嵌套路径一定存在；缺失字段保持 undefined/''，提交时按 undefined 过滤。
 */
const mergeProcessConfig = (remote?: Record<string, any>) => {
  const base = {
    chunking: { strategy: '', chunk_size: undefined, chunk_overlap: undefined, min_chunk_size: undefined, max_chunk_size: undefined, parent_chunk_size: undefined, child_chunk_size: undefined, child_chunk_overlap: undefined, context_header: false },
    retrieval: { top_k: undefined, search_type: '', use_parallel: undefined, score_threshold: undefined, vector_weight: undefined, keyword_weight: undefined, parallel_workers: undefined, parallel_timeout: undefined },
    rerank: { enabled: undefined, timeout: undefined, top_k: undefined },
    model: { embedding_model_uid: '', rerank_model_uid: '' },
    postprocess: { question_enabled: false, summary_enabled: false, graph_enabled: false, extract_enabled: false, wiki_enabled: false }
  }
  const src = remote || {}
  ;(Object.keys(base) as Array<keyof typeof base>).forEach((group) => {
    const srcGroup = src[group]
    if (srcGroup && typeof srcGroup === 'object') {
      Object.assign(base[group], srcGroup)
    }
  })
  return base
}

/**
 * 提交前清理 processConfig：递归移除 undefined / null / '' ，
 * 仅保留用户显式设置的值，避免空值覆盖租户级默认配置。
 * 空分组也一并移除。
 */
const sanitizeProcessConfig = (cfg: Record<string, any> | undefined): Record<string, any> | undefined => {
  if (!cfg) return undefined
  const result: Record<string, any> = {}
  Object.keys(cfg).forEach((group) => {
    const groupObj = cfg[group]
    if (!groupObj || typeof groupObj !== 'object') return
    const cleaned: Record<string, any> = {}
    Object.keys(groupObj).forEach((key) => {
      const v = groupObj[key]
      if (v === undefined || v === null || v === '') return
      cleaned[key] = v
    })
    if (Object.keys(cleaned).length > 0) {
      result[group] = cleaned
    }
  })
  return Object.keys(result).length > 0 ? result : undefined
}
</script>

<style scoped>
.custom-field-divider {
  font-size: 13px;
  color: var(--el-color-primary);
}

.project-flag-tip {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.process-config-collapse {
  margin-top: 4px;
}

.process-config-collapse :deep(.el-collapse-item__header) {
  font-weight: 600;
}

.process-config-tip {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-color-warning);
}

.process-config-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-top: 2px;
}

.strategy-option {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}
.strategy-name {
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.strategy-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: normal;
}
.strategy-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  padding: 4px 8px;
}
.strategy-tip-label {
  font-weight: 500;
  color: var(--el-text-color-primary);
}
</style>
