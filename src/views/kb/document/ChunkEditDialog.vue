<template>
  <Dialog title="编辑切片" v-model="dialogVisible" width="720px">
    <el-form v-loading="submitLoading" label-position="top">
      <el-form-item label="切片内容">
        <el-input
          v-model="content"
          type="textarea"
          :rows="14"
          maxlength="20000"
          show-word-limit
          placeholder="请输入修改后的切片内容"
          :disabled="!canEdit"
        />
      </el-form-item>
      <div v-if="chunk?.revision != null" class="revision-hint">
        当前版本 v{{ chunk.revision }}（{{ chunk.revision === 0 ? '从未编辑' : '已有修订历史' }}）。若他人已修改，保存会提示冲突。
      </div>
    </el-form>
    <template #footer>
      <el-button :loading="submitLoading" type="primary" :disabled="!canEdit" @click="handleSubmit">
        保 存
      </el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChunkApi, type ChunkItem } from '@/api/kb/chunk'

defineOptions({ name: 'ChunkEditDialog' })

const props = defineProps<{
  visible: boolean
  docId: number
  kbId: number
  chunk: ChunkItem | null
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'success'): void
}>()

const message = useMessage()
const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
})
const content = ref('')
const submitLoading = ref(false)
const canEdit = computed(() => props.chunk != null && !props.chunk.isImage && props.chunk.chunkRole !== 'parent')

watch(
  () => props.visible,
  (v) => {
    if (v && props.chunk) {
      content.value = props.chunk.content || ''
    }
  }
)

const handleSubmit = async () => {
  if (!props.chunk) return
  if (!content.value.trim()) {
    message.warning('内容不能为空')
    return
  }
  submitLoading.value = true
  try {
    await ChunkApi.updateChunk({
      kbId: props.kbId,
      documentId: props.docId,
      chunkIndex: props.chunk.chunkIndex!,
      content: content.value,
      expectedRevision: props.chunk.revision || 0
    })
    message.success('保存成功')
    emit('success')
    dialogVisible.value = false
  } catch {
    // 冲突/校验错误由全局拦截提示
  } finally {
    submitLoading.value = false
  }
}
</script>
<style scoped>
.revision-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
