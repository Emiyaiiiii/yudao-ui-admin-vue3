<template>
  <Dialog
    class="skill-bind-dialog"
    :title="'Skill 绑定 - ' + agentName"
    v-model="dialogVisible"
    width="800px"
    append-to-body
    scroll
    :max-height="'520px'"
  >
    <el-alert
      title="从 Java 技能商店选择技能安装到智能体，技能来源为 QwenPaw 技能池（按可见性过滤）。创建智能体时也可在表单中勾选初始技能。"
      type="info"
      :closable="false"
      show-icon
      class="mb-16px"
    />
    <div class="flex items-center justify-between mb-8px">
      <span class="font-bold text-14px">已安装技能</span>
      <el-input
        v-model="installedSearch"
        placeholder="搜索名称 / 标识"
        clearable
        class="!w-220px"
      >
        <template #prefix><Icon icon="ep:search" /></template>
      </el-input>
    </div>
    <el-table v-loading="installedLoading" :data="pagedInstalled" :stripe="true" size="small">
      <el-table-column label="技能名称" align="center" min-width="140px">
        <template #default="scope">
          {{ scope.row.name || scope.row.skill_key || scope.row.skillName || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="版本" align="center" width="100px">
        <template #default="scope">
          {{ scope.row.version || scope.row.version_text || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="启用" align="center" width="80px">
        <template #default="scope">
          <el-tag :type="isEnabled(scope.row) ? 'success' : 'info'" size="small">
            {{ isEnabled(scope.row) ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="90px">
        <template #default="scope">
          <el-button link type="danger" @click="handleUninstall(scope.row)">卸载</el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      v-if="filteredInstalled.length > pageSize"
      :total="filteredInstalled.length"
      v-model:page="installedPage"
      v-model:limit="pageSize"
    />

    <div class="flex items-center justify-between mt-16px mb-8px">
      <span class="font-bold text-14px">技能商店（可安装）</span>
      <el-input
        v-model="storeSearch"
        placeholder="搜索名称 / 标识 / 描述"
        clearable
        class="!w-220px"
      >
        <template #prefix><Icon icon="ep:search" /></template>
      </el-input>
    </div>
    <el-table v-loading="storeLoading" :data="pagedStore" :stripe="true" size="small">
      <el-table-column label="图标" align="center" width="50px">
        <template #default="scope">
          <span class="text-18px">{{ scope.row.icon || '📦' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="显示名称" align="center" prop="displayName" min-width="120px" />
      <el-table-column label="技能标识" align="center" prop="skillName" width="120px">
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
      <el-table-column label="版本" align="center" width="80px">
        <template #default="scope">
          {{ scope.row.version || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="140px">
        <template #default="scope">
          <el-button link type="primary" @click="handleShowDetail(scope.row)">详情</el-button>
          <el-button
            link
            type="primary"
            :disabled="isInstalled(scope.row.skillName)"
            @click="handleInstall(scope.row)"
          >
            {{ isInstalled(scope.row.skillName) ? '已安装' : '安装' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      v-if="filteredStore.length > pageSize"
      :total="filteredStore.length"
      v-model:page="storePage"
      v-model:limit="pageSize"
    />

    <!-- 技能详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="`技能详情：${skillDetail?.name || ''}`" width="640px" append-to-body>
      <el-descriptions v-if="skillDetail" :column="2" border size="small" class="mb-16px">
        <el-descriptions-item label="名称" :span="2">{{ skillDetail.name }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ skillDetail.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="来源">{{ skillDetail.source || '-' }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ skillDetail.last_updated || '-' }}</el-descriptions-item>
        <el-descriptions-item label="标签" :span="2">{{ (skillDetail.tags || []).join('、') || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="skillDetail?.content" class="mb-8px font-bold text-14px">YAML 定义</div>
      <pre
        v-if="skillDetail?.content"
        class="p-12px border-radius-8px bg-[var(--el-fill-color-lighter)] text-12px overflow-auto max-h-260px whitespace-pre-wrap"
      >{{ skillDetail.content }}</pre>
    </el-dialog>
  </Dialog>
</template>

<script setup lang="ts">
import { AgentRemoteApi } from '@/api/ai/agentRemote'
import { SkillMetaApi, SkillMeta } from '@/api/ai/skillmeta'

/** 智能体-Skill 绑定管理（从 Java 技能商店安装，按可见性过滤） */
defineOptions({ name: 'AgentBindSkill' })

const message = useMessage()
const emit = defineEmits(['success'])
const dialogVisible = ref(false)
const installedLoading = ref(false)
const storeLoading = ref(false)
const installedList = ref<any[]>([]) // 已安装技能（QwenPaw 侧）
const storeList = ref<SkillMeta[]>([]) // Java 技能商店可见列表
const agentId = ref<number>()
const agentName = ref('')
const detailVisible = ref(false) // 技能详情弹窗
const skillDetail = ref<any>() // 技能详情（含 YAML）

// 搜索与分页（前端过滤/分页）
const pageSize = ref(10)
const installedSearch = ref('')
const storeSearch = ref('')
const installedPage = ref(1)
const storePage = ref(1)

/** 已安装列表：按 名称 / 标识 过滤 */
const filteredInstalled = computed(() => {
  const kw = installedSearch.value.trim().toLowerCase()
  if (!kw) return installedList.value
  return installedList.value.filter((s) => {
    const name = String(s.name || s.skill_key || s.skillName || '').toLowerCase()
    return name.includes(kw)
  })
})
/** 已安装列表：分页后的数据 */
const pagedInstalled = computed(() => filteredInstalled.value.slice((installedPage.value - 1) * pageSize.value, installedPage.value * pageSize.value))

/** 商店列表：按 名称 / 标识 / 描述 过滤 */
const filteredStore = computed(() => {
  const kw = storeSearch.value.trim().toLowerCase()
  if (!kw) return storeList.value
  return storeList.value.filter((s) => {
    const name = String(s.displayName || '').toLowerCase()
    const skill = String(s.skillName || '').toLowerCase()
    const desc = String(s.description || '').toLowerCase()
    return name.includes(kw) || skill.includes(kw) || desc.includes(kw)
  })
})
/** 商店列表：分页后的数据 */
const pagedStore = computed(() => filteredStore.value.slice((storePage.value - 1) * pageSize.value, storePage.value * pageSize.value))

/** 打开弹窗 */
const open = async (id: number, name: string) => {
  dialogVisible.value = true
  agentId.value = id
  agentName.value = name
  await Promise.all([getInstalledList(), getStoreList()])
}
defineExpose({ open })

/** 查询已安装技能（QwenPaw 侧） */
const getInstalledList = async () => {
  installedLoading.value = true
  try {
    installedList.value = await AgentRemoteApi.listSkills(agentId.value)
  } finally {
    installedLoading.value = false
  }
}

/** 查询 Java 技能商店可见列表 */
const getStoreList = async () => {
  storeLoading.value = true
  try {
    storeList.value = await SkillMetaApi.getVisibleSkillMetaList()
  } finally {
    storeLoading.value = false
  }
}

/** 判断已安装技能是否启用 */
const isEnabled = (row: any) => {
  return row.enabled === true || row.enabled === 1 || row.enabled === 'true'
}

/** 判断技能是否已安装 */
const isInstalled = (skillName: string) => {
  if (!skillName) return false
  return installedList.value.some((s) => {
    const n = s.name || s.skill_key || s.skillName
    return n === skillName
  })
}

/** 从技能商店安装到智能体 */
const handleInstall = async (row: SkillMeta) => {
  try {
    await message.confirm('确定安装技能「' + row.displayName + '」到该智能体？')
    await AgentRemoteApi.installSkill(agentId.value, row.skillName)
    message.success('安装成功')
    await getInstalledList()
    emit('success')
  } catch {}
}

/** 卸载技能 */
const handleUninstall = async (row: any) => {
  const name = row.name || row.skill_key || row.skillName
  try {
    await message.delConfirm()
    await AgentRemoteApi.uninstallSkill(agentId.value, name)
    message.success('卸载成功')
    await getInstalledList()
    emit('success')
  } catch {}
}

/** 查看技能池详情（含 YAML 定义） */
const handleShowDetail = async (row: SkillMeta) => {
  detailVisible.value = true
  skillDetail.value = null
  try {
    skillDetail.value = await AgentRemoteApi.getSkillPoolDetail(row.skillName)
  } catch {
    message.error('获取技能详情失败')
  }
}
</script>

<style lang="scss" scoped>
:deep(.skill-bind-dialog .el-dialog__body) {
  padding-bottom: 28px !important;
}
</style>
