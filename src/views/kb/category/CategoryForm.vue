<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible" width="720px">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="110px"
      v-loading="formLoading"
    >
      <el-form-item label="分类名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入分类名称" />
      </el-form-item>
      <el-form-item label="关联层级配置" prop="kbLevelId">
        <el-select v-model="formData.kbLevelId" placeholder="请选择层级配置" style="width: 100%">
          <el-option
            v-for="item in levelConfigOptions"
            :key="item.id"
            :label="item.levelName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="父分类ID: 0=顶级分类" prop="parentId">
        <el-tree-select
          v-model="formData.parentId"
          :data="categoryTree"
          :props="defaultProps"
          check-strictly
          default-expand-all
          placeholder="请选择父分类ID: 0=顶级分类"
        />
      </el-form-item>
      <el-form-item label="排序" prop="sort">
        <el-input v-model="formData.sort" placeholder="请输入排序" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :value="0">启用</el-radio>
          <el-radio :value="1">禁用</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- ========== 表头配置（自定义表头 / 列模板） ========== -->
      <el-form-item label="表头配置">
        <div class="column-config">
          <div class="column-config-toolbar">
            <el-dropdown @command="addBuiltinColumn" trigger="click">
              <el-button link type="primary" size="small">＋ 添加内置列</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="b in availableBuiltins"
                    :key="b.builtin"
                    :command="b.builtin"
                  >
                    {{ b.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button link type="primary" size="small" @click="addCustomField">
              ＋ 添加自定义字段
            </el-button>
          </div>

          <div v-if="columnList.length" class="column-config-list">
            <div
              v-for="(col, idx) in columnList"
              :key="col.source === 'builtin' ? col.builtin : col.key"
              class="column-config-item"
            >
              <div class="column-item-head">
                <el-tag :type="col.source === 'builtin' ? 'info' : 'warning'" size="small">
                  {{ col.source === 'builtin' ? '内置' : '自定义' }}
                </el-tag>
                <span class="column-item-kind">
                  {{ col.source === 'builtin' ? builtinLabel(col.builtin) : '业务字段' }}
                </span>
                <span class="column-item-actions">
                  <el-button link type="primary" size="small" :disabled="idx === 0" @click="moveColumn(idx, -1)">
                    上移
                  </el-button>
                  <el-button
                    link
                    type="primary"
                    size="small"
                    :disabled="idx === columnList.length - 1"
                    @click="moveColumn(idx, 1)"
                  >
                    下移
                  </el-button>
                  <el-button link type="danger" size="small" @click="removeColumn(idx)">删除</el-button>
                </span>
              </div>
              <div class="column-item-body">
                <el-input v-model="col.label" placeholder="列标题（如：项目名称）" size="small" style="width: 200px">
                  <template #prepend>标题</template>
                </el-input>
                <template v-if="col.source === 'custom'">
                  <el-select v-model="col.type" placeholder="字段类型" size="small" style="width: 140px" @change="handleTypeChange(col)">
                    <el-option v-for="t in CUSTOM_FIELD_TYPES" :key="t.type" :label="t.label" :value="t.type" />
                  </el-select>
                  <el-select
                    v-if="col.type === 'select'"
                    v-model="col.options"
                    multiple
                    filterable
                    allow-create
                    default-first-option
                    placeholder="输入选项后回车"
                    size="small"
                    style="width: 240px"
                  />
                </template>
              </div>
            </div>
          </div>
          <div v-else class="column-config-empty">尚未配置列，将默认展示「名称 / 归属 / 文档数 / 创建时间」</div>
          <div class="column-config-tip">
            「序号」列由大屏固定展示；内置列标题可重命名；自定义字段的值在新建/编辑知识库时填写。
          </div>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitForm" type="primary" :disabled="formLoading">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { CategoryApi, Category } from '@/api/kb/category'
import { LevelConfigApi } from '@/api/kb/levelconfig'
import { defaultProps, handleTree } from '@/utils/tree'
import {
  parseColumnConfig,
  stringifyColumnConfig,
  BUILTIN_COLUMNS,
  CUSTOM_FIELD_TYPES,
  type KbColumn,
  genFieldKey
} from '../columnConfig'

/** 知识库分类 表单 */
defineOptions({ name: 'CategoryForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref({
  id: undefined,
  name: undefined,
  kbLevelId: undefined,
  parentId: undefined,
  sort: undefined,
  status: undefined,
  columnConfig: undefined
})
const formRules = reactive({
  name: [{ required: true, message: '分类名称不能为空', trigger: 'blur' }]
})
const formRef = ref() // 表单 Ref
const categoryTree = ref() // 树形结构
const levelConfigOptions = ref<any[]>([])

// 表头配置（列模板）
const columnList = ref<KbColumn[]>([])

/** 尚未添加的内置列（用于下拉） */
const availableBuiltins = computed(() => {
  const used = new Set(
    columnList.value.filter((c) => c.source === 'builtin').map((c) => c.builtin)
  )
  return BUILTIN_COLUMNS.filter((b) => !used.has(b.builtin))
})

/** 内置列默认标题 */
const builtinLabel = (builtin?: string): string => {
  return BUILTIN_COLUMNS.find((b) => b.builtin === builtin)?.label || builtin || ''
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      const data = await CategoryApi.getCategory(id)
      formData.value = data
      // 解析已有的表头配置
      columnList.value = parseColumnConfig(data.columnConfig)
    } finally {
      formLoading.value = false
    }
  } else {
    // 新增：使用默认列模板
    columnList.value = parseColumnConfig(null)
  }
  await getCategoryTree()
  await getLevelConfigOptions()
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗

/** 获得层级配置列表 */
const getLevelConfigOptions = async () => {
  levelConfigOptions.value = await LevelConfigApi.getSimpleLevelConfigList()
}

/** 添加内置列 */
const addBuiltinColumn = (builtin: string) => {
  const def = BUILTIN_COLUMNS.find((b) => b.builtin === builtin)
  if (!def) return
  columnList.value.push({ source: 'builtin', builtin, label: def.label })
}

/** 添加自定义字段 */
const addCustomField = () => {
  columnList.value.push({ source: 'custom', key: genFieldKey(), label: '', type: 'text' })
}

/** 字段类型变化时，为下拉类型初始化选项 */
const handleTypeChange = (col: KbColumn) => {
  if (col.type === 'select' && !col.options) {
    col.options = []
  }
}

/** 删除列 */
const removeColumn = (idx: number) => {
  columnList.value.splice(idx, 1)
}

/** 上移/下移列 */
const moveColumn = (idx: number, delta: number) => {
  const target = idx + delta
  if (target < 0 || target >= columnList.value.length) return
  const arr = columnList.value
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
}

/** 提交表单 */
const emit = defineEmits(['success']) // 定义 success 事件，用于操作成功后的回调
const submitForm = async () => {
  // 校验表单
  await formRef.value.validate()
  // 提交请求
  formLoading.value = true
  try {
    // 序列化表头配置
    formData.value.columnConfig = stringifyColumnConfig(columnList.value)
    const data = formData.value as unknown as Category
    if (formType.value === 'create') {
      await CategoryApi.createCategory(data)
      message.success(t('common.createSuccess'))
    } else {
      await CategoryApi.updateCategory(data)
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
    kbLevelId: undefined,
    parentId: undefined,
    sort: undefined,
    status: undefined,
    columnConfig: undefined
  }
  columnList.value = parseColumnConfig(null)
  formRef.value?.resetFields()
}

/** 获得知识库分类树 */
const getCategoryTree = async () => {
  categoryTree.value = []
  const data = await CategoryApi.getCategoryList(undefined)
  const root: Tree = { id: 0, name: '顶级知识库分类', children: [] }
  root.children = handleTree(data, 'id', 'parentId')
  categoryTree.value.push(root)
}
</script>

<style scoped>
.column-config {
  width: 100%;
}

.column-config-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.column-config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.column-config-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 6px 10px;
}

.column-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.column-item-kind {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.column-item-actions {
  display: flex;
  align-items: center;
}

.column-item-body {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.column-config-empty {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.column-config-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
