<template>
  <el-dialog
    :model-value="visible"
    :title="isCreateMode ? '新建 Wiki 页面' : '编辑 Wiki 页面'"
    width="720px"
    :append-to-body="true"
    :close-on-click-modal="false"
    @close="emit('update:visible', false)"
  >
    <el-form v-loading="submitLoading" ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="请输入页面标题" maxlength="120" show-word-limit />
      </el-form-item>
      <el-form-item label="slug" prop="slug">
        <el-input
          v-model="form.slug"
          placeholder="唯一标识，如 product/intro，用于 [[slug|名称]] 互链"
          :disabled="!isCreateMode"
        />
      </el-form-item>
      <el-form-item label="摘要" prop="summary">
        <el-input v-model="form.summary" type="textarea" :rows="2" maxlength="500" placeholder="页面摘要（可选）" />
      </el-form-item>
      <el-form-item label="页面类型" prop="pageType">
        <el-select v-model="form.pageType" clearable placeholder="选择类型（可选）" style="width: 100%">
          <el-option label="概念" value="concept" />
          <el-option label="人物" value="person" />
          <el-option label="组织" value="organization" />
          <el-option label="文档" value="doc" />
        </el-select>
      </el-form-item>
      <el-form-item label="正文" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="14"
          maxlength="50000"
          show-word-limit
          placeholder="支持 Markdown，可用 [[slug|名称]] 引用其他页面"
        />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio :value="0">正常</el-radio>
          <el-radio :value="1">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
      <div v-if="!isCreateMode && page?.revision != null" class="revision-hint">
        当前版本 v{{ page.revision }}。若他人在此期间修改过，保存将提示冲突，需刷新后重试。
      </div>
    </el-form>
    <template #footer>
      <el-button :loading="submitLoading" type="primary" @click="handleSubmit">保 存</el-button>
      <el-button @click="emit('update:visible', false)">取 消</el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance } from 'element-plus'
import { WikiApi, type WikiPageVO } from '@/api/kb/wiki'

defineOptions({ name: 'WikiEditDialog' })

const props = defineProps<{
  visible: boolean
  kbId: number
  page: WikiPageVO | null // 为 null 时是新建
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'success'): void
}>()

const message = useMessage()
const formRef = ref<FormInstance | null>(null)
const submitLoading = ref(false)

const isCreateMode = computed(() => !props.page)

const form = reactive({
  slug: '',
  title: '',
  summary: '',
  pageType: '',
  content: '',
  status: 0
})

const rules = {
  title: [{ required: true, message: '请输入页面标题', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入 slug', trigger: 'blur' }],
  content: [{ required: true, message: '请输入正文内容', trigger: 'blur' }]
}

const handleOpen = () => {
  const p = props.page
  form.slug = p?.slug || ''
  form.title = p?.title || ''
  form.summary = p?.summary || ''
  form.pageType = p?.pageType || ''
  form.content = p?.content || ''
  form.status = p?.status != null ? p.status : 0
  nextTick(() => formRef.value?.clearValidate?.())
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate?.().catch(() => false)
  if (!valid) return
  if (!form.slug.trim() || !form.title.trim() || !form.content.trim()) {
    message.warning('标题、slug、正文不能为空')
    return
  }
  submitLoading.value = true
  try {
    await WikiApi.savePage({
      kbId: props.kbId,
      slug: form.slug.trim(),
      title: form.title.trim(),
      content: form.content,
      summary: form.summary || undefined,
      pageType: form.pageType || undefined,
      status: form.status,
      // 编辑模式携带乐观锁；新建不传
      expectedRevision: isCreateMode.value ? undefined : (props.page?.revision ?? 0)
    })
    message.success('保存成功')
    emit('success')
    emit('update:visible', false)
  } catch {
    // 冲突（错误码 53 WIKI_PAGE_CONFLICT）由全局拦截提示"已被他人修改，请刷新后重试"
  } finally {
    submitLoading.value = false
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) handleOpen()
  }
)
</script>
<style scoped>
.revision-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding-left: 90px;
}
</style>