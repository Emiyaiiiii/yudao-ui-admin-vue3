<template>
  <ContentWrap class="strategy-matrix">
    <div class="sm-head">
      <div class="sm-title-wrap">
        <div class="sm-title">
          <Icon icon="ep:promotion" :size="16" color="var(--el-color-primary)" />
          图片处理方案
        </div>
        <div class="sm-sub">
          四种方案是平级关系，点击卡片即可设为全局默认；未在知识库中单独指定方案的入库任务将按此执行。
        </div>
      </div>
      <el-button link type="primary" @click="load">刷新</el-button>
    </div>

    <el-row :gutter="12">
      <el-col
        v-for="s in strategies"
        :key="s.code"
        :xs="24" :sm="12" :md="12" :lg="6"
        class="sm-col"
      >
        <div
          class="sm-card"
          :class="['state-' + s.status, { 'is-default': defaultStrategy === s.code }]"
          @click="handleSelect(s)"
        >
          <div class="sm-card-head">
            <span class="sm-name">{{ s.name }}</span>
            <el-tag v-if="defaultStrategy === s.code" size="small" type="primary" effect="dark" class="sm-flag">
              默认
            </el-tag>
            <Icon v-if="s.status === 'ready'" icon="ep:circle-check" :size="16" color="#67c23a" />
            <Icon v-else-if="s.status === 'partial'" icon="ep:warning" :size="16" color="#e6a23c" />
            <Icon v-else icon="ep:circle-close" :size="16" color="#f56c6c" />
          </div>
          <div class="sm-desc">{{ s.desc }}</div>

          <div class="sm-reqs">
            <div
              v-for="req in s.requires"
              :key="req.type + (req.needsVl ? '-vl' : '') + req.label"
              class="sm-req"
              :class="req.status"
            >
              <span class="sm-req-dot" />
              <div class="sm-req-main">
                <div class="sm-req-label">{{ req.label }}</div>
                <div class="sm-req-meta">
                  <template v-if="req.status === 'ok'">
                    <el-tag size="small" type="success" effect="plain">{{ req.activeName || '已激活' }}</el-tag>
                    <el-tag v-if="req.needsVl" size="small" type="success" effect="plain">VL</el-tag>
                  </template>
                  <template v-else-if="req.status === 'warn'">
                    <el-tag size="small" type="warning" effect="plain">已激活但需开启VL</el-tag>
                    <el-button link type="warning" size="small" @click="emit('configure', req.type, req.activeId)">
                      去开启VL
                    </el-button>
                  </template>
                  <template v-else-if="req.status === 'partial'">
                    <el-tag size="small" type="info" effect="plain">可选</el-tag>
                  </template>
                  <template v-else>
                    <el-tag size="small" type="danger" effect="plain">未配置</el-tag>
                    <el-button link type="primary" size="small" @click="emit('configure', req.type)">
                      去配置
                    </el-button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </ContentWrap>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ModelConfigApi } from '@/api/kb/modelconfig'
import { ImageStrategyApi } from '@/api/kb/imagestrategy'
import { useMessage } from '@/hooks/web/useMessage'

defineOptions({ name: 'ImageStrategyMatrix' })

const emit = defineEmits<{ (e: 'configure', modelType: string, activeId?: number): void }>()

const message = useMessage()

// 当前全局默认图片处理方案（点击卡片可设置）
const defaultStrategy = ref('')

type ReqStatus = 'ok' | 'warn' | 'partial' | 'missing'

interface Req {
  type: string
  label: string
  needsVl: boolean
  optional: boolean
  status: ReqStatus
  activeName?: string
  activeId?: number
}

interface Strategy {
  code: string
  name: string
  desc: string
  status: 'ready' | 'partial' | 'blocked'
  requires: Req[]
}

const strategies = ref<Strategy[]>([])

// 四种平级图片处理方案（非递进级别）
const STRATEGY_DEFS = [
  {
    code: 'none',
    name: '纯文本',
    desc: '仅文本向量检索；图片只回显 URL，不提取图片文字、不生成图片向量。',
    requires: [{ type: 'embedding', label: '嵌入模型', needsVl: false, optional: false }]
  },
  {
    code: 'ocr',
    name: 'OCR文字',
    desc: '用 OCR 提取图片中的文字入库，图片内容可按文字检索。',
    requires: [
      { type: 'embedding', label: '嵌入模型', needsVl: false, optional: false },
      { type: 'ocr', label: 'OCR 模型', needsVl: false, optional: false }
    ]
  },
  {
    code: 'vl_summary',
    name: 'VL总结',
    desc: '用 VL 大模型看图生成文字总结入库，图片内容可按总结检索。',
    requires: [
      { type: 'embedding', label: '嵌入模型', needsVl: false, optional: false },
      { type: 'llm', label: 'VL 大模型（看图总结）', needsVl: true, optional: false }
    ]
  },
  {
    code: 'vision',
    name: '视觉召回',
    desc: '多模态嵌入直接编码图片像素，支持按图/按语义找图（问答需另行配 VL 大模型）。',
    requires: [
      { type: 'embedding', label: '嵌入模型（多模态）', needsVl: true, optional: false },
      { type: 'ocr', label: 'OCR 模型', needsVl: false, optional: true }
    ]
  }
]

const load = async () => {
  try {
    defaultStrategy.value = (await ImageStrategyApi.getDefault()) || ''
  } catch {
    defaultStrategy.value = ''
  }
  let list: any[] = []
  try {
    list = (await ModelConfigApi.getSimpleList()) || []
  } catch {
    list = []
  }
  // 按用途分类聚合激活配置
  const byType: Record<string, any[]> = {}
  for (const c of list) {
    const t = c.modelType || ''
    ;(byType[t] = byType[t] || []).push(c)
  }

  strategies.value = STRATEGY_DEFS.map((s) => {
    const requires: Req[] = s.requires.map((r) => {
      const actives = byType[r.type] || []
      // 需要 VL：必须有激活且 vlSupported=true；有激活但 vl 未开 → warn
      if (r.needsVl) {
        const withVl = actives.find((a) => a.vlSupported)
        if (withVl) return { ...r, status: 'ok', activeName: withVl.name, activeId: withVl.id }
        if (actives.length > 0) return { ...r, status: 'warn', activeId: actives[0].id }
        return { ...r, status: r.optional ? 'partial' : 'missing' }
      }
      // 不需要 VL：存在任一激活配置即满足
      if (actives.length > 0) return { ...r, status: 'ok', activeName: actives[0].name, activeId: actives[0].id }
      return { ...r, status: r.optional ? 'partial' : 'missing' }
    })

    const failures = requires.filter((r) => r.status === 'missing' || r.status === 'warn')
    let status: Strategy['status'] = 'ready'
    if (failures.length > 0) {
      status = failures.some((r) => r.status === 'missing') ? 'blocked' : 'partial'
    }
    return { code: s.code, name: s.name, desc: s.desc, status, requires }
  })
}

const refresh = load

// 点击方案卡片 → 设为全局默认
const handleSelect = async (s: Strategy) => {
  if (defaultStrategy.value === s.code) return
  try {
    await ImageStrategyApi.setDefault(s.code)
    defaultStrategy.value = s.code
    message.success(`已将「${s.name}」设为默认图片处理方案`)
  } catch (e) {
    message.error('设置失败：请先在「切片方法」中设置一个默认方法')
  }
}

onMounted(load)
defineExpose({ refresh })
</script>

<style scoped lang="scss">
.strategy-matrix {
  margin-bottom: 8px;
}

.sm-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;

  .sm-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sm-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  .sm-sub {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
}

.sm-col {
  margin-bottom: 12px;
}

.sm-card {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 14px;
  height: 100%;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--el-border-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }

  &.is-default {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px var(--el-color-primary);
  }

  &.state-ready { border-left: 3px solid #67c23a; }
  &.state-partial { border-left: 3px solid #e6a23c; }
  &.state-blocked { border-left: 3px solid #f56c6c; }
}

.sm-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  .sm-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    flex: 1;
  }
}

.sm-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-bottom: 10px;
  min-height: 36px;
}

.sm-reqs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sm-req {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-light);

  .sm-req-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #909399;
    margin-top: 5px;
    flex-shrink: 0;
  }
  &.ok .sm-req-dot { background: #67c23a; }
  &.warn .sm-req-dot { background: #e6a23c; }
  &.missing .sm-req-dot { background: #f56c6c; }
  &.partial .sm-req-dot { background: #909399; }

  .sm-req-main {
    flex: 1;
    min-width: 0;
  }
  .sm-req-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
  }
  .sm-req-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 11px;
  }
}
</style>