<template>
  <div ref="containerRef" class="wiki-graph" v-loading="loading">
    <div ref="canvasRef" class="wiki-graph-canvas"></div>
    <div v-if="!loading && !hasNodes" class="wiki-graph-empty">
      <el-empty description="暂无图谱数据" :image-size="48" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import type { WikiGraphData, WikiGraphNode } from '@/api/kb/wiki'

defineOptions({ name: 'WikiGraph' })

const props = defineProps<{
  graph: WikiGraphData | null
  loading?: boolean
  selected?: string
  /** 增量更新（bloom）时保留已有节点坐标 */
  preserveLayout?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', slug: string): void
  (e: 'bloom', slug: string): void
  (e: 'pivot', slug: string): void
}>()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLDivElement>()

// ========== 节点/边类型 ==========
interface GNode {
  x: number
  y: number
  vx: number
  vy: number
  slug: string
  title: string
  type: string
  linkCount: number
  familiar: boolean
  pinned: boolean
}
interface GEdge {
  line: SVGLineElement
  source: string
  target: string
  bidir: boolean
}
interface GNodeEl {
  g: SVGGElement
  circle: SVGCircleElement
  text: SVGTextElement
  activeRing: SVGCircleElement
  node: GNode
}

const hasNodes = computed(() => !!props.graph?.nodes?.length)
const nodeColorMap: Record<string, string> = {
  summary: '#0052d9',
  entity: '#2ba471',
  concept: '#e37318',
  synthesis: '#0594fa',
  comparison: '#d54941',
  index: '#8c8c8c',
  default: '#0052d9'
}

let graphSvg: SVGSVGElement | null = null
let graphNodes: GNode[] = []
let nodeMap = new Map<string, GNode>()
let graphNodeEls: GNodeEl[] = []
let graphEdgeEls: GEdge[] = []
let graphAdjacency = new Map<string, Set<string>>()
let graphAnimFrame = 0
let graphHoverLeaveTimer: ReturnType<typeof setTimeout> | null = null
let graphSelectedSlug = ''
let graphHighlightSlug: string | null = null

// pan/zoom 状态
let panZoom = { scale: 1, translateX: 0, translateY: 0 }
let animId = 0
let showArrows = true

function nodeRadius(n: GNode): number {
  return Math.max(8, Math.min(24, 8 + Math.log(n.linkCount + 1) * 4))
}

function setEdgePositions(line: SVGLineElement, s: GNode, t: GNode) {
  const dx = t.x - s.x
  const dy = t.y - s.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  const rS = nodeRadius(s) + 4
  const rT = nodeRadius(t) + 4
  line.setAttribute('x1', String(s.x + ux * rS))
  line.setAttribute('y1', String(s.y + uy * rS))
  line.setAttribute('x2', String(t.x - ux * rT))
  line.setAttribute('y2', String(t.y - uy * rT))
}

function applyTransform() {
  const root = graphSvg?.querySelector('.graph-root') as SVGGElement | null
  if (root) {
    root.setAttribute('transform', `translate(${panZoom.translateX},${panZoom.translateY}) scale(${panZoom.scale})`)
  }
  updateLabelsVisibility()
}

function updateLabelsVisibility() {
  for (const { text, node } of graphNodeEls) {
    if (node.slug === graphSelectedSlug || node.slug === graphHighlightSlug) {
      text.style.opacity = '1'
      continue
    }
    let threshold = 0.5
    if (node.linkCount > 10) threshold = 0.2
    else if (node.linkCount > 5) threshold = 0.35
    else if (node.linkCount > 2) threshold = 0.45
    text.style.opacity = panZoom.scale < threshold ? '0' : '1'
  }
}

// ========== 渲染 ==========
interface RenderOpts {
  preserveLayout?: boolean
  anchorSlug?: string
}

function renderGraph(opts: RenderOpts = {}) {
  const container = canvasRef.value
  if (!container) return
  const data = props.graph
  if (!data || !data.nodes?.length) {
    container.innerHTML = ''
    return
  }

  if (graphAnimFrame) { cancelAnimationFrame(graphAnimFrame); graphAnimFrame = 0 }
  if (graphHoverLeaveTimer) { clearTimeout(graphHoverLeaveTimer); graphHoverLeaveTimer = null }

  const width = container.clientWidth || 800
  const height = container.clientHeight || 600

  const priorCoords = new Map<string, { x: number; y: number; vx: number; vy: number; pinned: boolean }>()
  if (opts.preserveLayout) {
    for (const n of graphNodes) {
      priorCoords.set(n.slug, { x: n.x, y: n.y, vx: n.vx, vy: n.vy, pinned: n.pinned })
    }
  }

  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.style.width = '100%'
  svg.style.height = '100%'
  container.innerHTML = ''
  container.appendChild(svg)
  graphSvg = svg

  const rootG = document.createElementNS(NS, 'g')
  rootG.setAttribute('class', 'graph-root')
  svg.appendChild(rootG)
  const edgeG = document.createElementNS(NS, 'g')
  rootG.appendChild(edgeG)
  const nodeG = document.createElementNS(NS, 'g')
  rootG.appendChild(nodeG)

  // adjacency（无向邻居）
  graphAdjacency = new Map<string, Set<string>>()
  for (const edge of data.edges) {
    if (!graphAdjacency.has(edge.source)) graphAdjacency.set(edge.source, new Set())
    if (!graphAdjacency.has(edge.target)) graphAdjacency.set(edge.target, new Set())
    graphAdjacency.get(edge.source)!.add(edge.target)
    graphAdjacency.get(edge.target)!.add(edge.source)
  }

  const anchorCoord = opts.anchorSlug ? priorCoords.get(opts.anchorSlug) : undefined
  const anchorX = anchorCoord?.x ?? width / 2
  const anchorY = anchorCoord?.y ?? height / 2

  nodeMap = new Map()
  graphNodes = data.nodes.map((n, i) => {
    const prior = opts.preserveLayout ? priorCoords.get(n.slug) : undefined
    let x: number, y: number, vx = 0, vy = 0, pinned = false
    if (prior) {
      x = prior.x; y = prior.y; vx = prior.vx; vy = prior.vy; pinned = prior.pinned
    } else if (opts.preserveLayout && opts.anchorSlug) {
      const jitterR = 40
      const angle = Math.random() * Math.PI * 2
      x = anchorX + jitterR * Math.cos(angle)
      y = anchorY + jitterR * Math.sin(angle)
    } else {
      const angle = (2 * Math.PI * i) / data.nodes.length
      const r = Math.min(width, height) * 0.35
      x = width / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 50
      y = height / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 50
    }
    const node: GNode = {
      x, y, vx, vy,
      slug: n.slug, title: n.title, type: n.pageType || 'default',
      linkCount: n.linkCount || 0, familiar: !!n.familiar, pinned
    }
    nodeMap.set(n.slug, node)
    return node
  })

  // defs：箭头 + 阴影
  const defs = document.createElementNS(NS, 'defs')
  const markerEnd = document.createElementNS(NS, 'marker')
  markerEnd.setAttribute('id', 'wiki-arrow-end')
  markerEnd.setAttribute('viewBox', '0 0 10 6')
  markerEnd.setAttribute('refX', '10'); markerEnd.setAttribute('refY', '3')
  markerEnd.setAttribute('markerWidth', '8'); markerEnd.setAttribute('markerHeight', '6')
  markerEnd.setAttribute('orient', 'auto')
  const arrowEndPath = document.createElementNS(NS, 'path')
  arrowEndPath.setAttribute('d', 'M0,0 L10,3 L0,6 L2,3 Z')
  arrowEndPath.setAttribute('fill', '#c0c4cc')
  markerEnd.appendChild(arrowEndPath)
  defs.appendChild(markerEnd)

  const markerStart = document.createElementNS(NS, 'marker')
  markerStart.setAttribute('id', 'wiki-arrow-start')
  markerStart.setAttribute('viewBox', '0 0 10 6')
  markerStart.setAttribute('refX', '0'); markerStart.setAttribute('refY', '3')
  markerStart.setAttribute('markerWidth', '8'); markerStart.setAttribute('markerHeight', '6')
  markerStart.setAttribute('orient', 'auto')
  const arrowStartPath = document.createElementNS(NS, 'path')
  arrowStartPath.setAttribute('d', 'M10,0 L0,3 L10,6 L8,3 Z')
  arrowStartPath.setAttribute('fill', '#c0c4cc')
  markerStart.appendChild(arrowStartPath)
  defs.appendChild(markerStart)

  for (const id of ['wiki-arrow-end-hl', 'wiki-arrow-start-hl']) {
    const m = document.createElementNS(NS, 'marker')
    m.setAttribute('id', id)
    m.setAttribute('viewBox', '0 0 10 6')
    m.setAttribute('refX', id.includes('end') ? '10' : '0')
    m.setAttribute('refY', '3')
    m.setAttribute('markerWidth', '8'); m.setAttribute('markerHeight', '6')
    m.setAttribute('orient', 'auto')
    const p = document.createElementNS(NS, 'path')
    p.setAttribute('d', id.includes('end') ? 'M0,0 L10,3 L0,6 L2,3 Z' : 'M10,0 L0,3 L10,6 L8,3 Z')
    p.setAttribute('fill', '#0052d9')
    m.appendChild(p)
    defs.appendChild(m)
  }
  svg.appendChild(defs)

  // 双向边去重
  const edgePairSet = new Set<string>()
  for (const e of data.edges) edgePairSet.add(`${e.source}→${e.target}`)
  graphEdgeEls = []
  const processedPairs = new Set<string>()
  for (const edge of data.edges) {
    const pairKey = [edge.source, edge.target].sort().join('↔')
    if (processedPairs.has(pairKey)) continue
    processedPairs.add(pairKey)
    const bidir = edgePairSet.has(`${edge.target}→${edge.source}`)
    const line = document.createElementNS(NS, 'line')
    line.setAttribute('stroke', '#c0c4cc')
    line.setAttribute('stroke-width', '1.2')
    line.setAttribute('stroke-opacity', '0.4')
    line.setAttribute('marker-end', 'url(#wiki-arrow-end)')
    if (bidir) line.setAttribute('marker-start', 'url(#wiki-arrow-start)')
    if (!showArrows) {
      line.removeAttribute('marker-end')
      line.removeAttribute('marker-start')
    }
    line.style.transition = 'stroke 0.2s, stroke-width 0.2s, stroke-opacity 0.2s'
    edgeG.appendChild(line)
    graphEdgeEls.push({ line, source: edge.source, target: edge.target, bidir })
  }

  // 节点
  graphNodeEls = []
  for (const n of graphNodes) {
    const g = document.createElementNS(NS, 'g')
    g.style.cursor = 'pointer'
    const r = nodeRadius(n)

    const visibleNeighbors = graphAdjacency.get(n.slug)?.size ?? 0
    const hiddenNeighbors = Math.max(0, n.linkCount - visibleNeighbors)
    const isEgoCenter = data.meta?.mode === 'ego' && data.meta.center === n.slug
    const showExpansionRing = hiddenNeighbors > 0 && !isEgoCenter

    const expansionRing = document.createElementNS(NS, 'circle')
    expansionRing.setAttribute('r', String(r + 3))
    expansionRing.setAttribute('fill', 'none')
    expansionRing.setAttribute('stroke', nodeColorMap[n.type] || '#8c8c8c')
    expansionRing.setAttribute('stroke-width', '1.5')
    expansionRing.setAttribute('stroke-dasharray', '3 3')
    expansionRing.setAttribute('pointer-events', 'none')
    expansionRing.style.opacity = showExpansionRing ? '0.55' : '0'
    expansionRing.style.transition = 'opacity 0.2s'
    g.appendChild(expansionRing)

    if (n.familiar) {
      const familiarRing = document.createElementNS(NS, 'circle')
      familiarRing.setAttribute('r', String(r + 7))
      familiarRing.setAttribute('fill', 'none')
      familiarRing.setAttribute('stroke', '#0052d9')
      familiarRing.setAttribute('stroke-width', '2')
      familiarRing.setAttribute('pointer-events', 'none')
      familiarRing.style.opacity = '0.9'
      g.appendChild(familiarRing)
    }

    const activeRing = document.createElementNS(NS, 'circle')
    activeRing.setAttribute('r', String(r + 5))
    activeRing.setAttribute('fill', 'none')
    activeRing.setAttribute('stroke', nodeColorMap[n.type] || '#8c8c8c')
    activeRing.setAttribute('stroke-width', '2')
    activeRing.style.opacity = '0'
    activeRing.style.transition = 'opacity 0.2s'
    g.appendChild(activeRing)

    const circle = document.createElementNS(NS, 'circle')
    circle.setAttribute('r', String(r))
    circle.setAttribute('fill', nodeColorMap[n.type] || '#8c8c8c')
    circle.setAttribute('stroke', '#fff')
    circle.setAttribute('stroke-width', '2')
    circle.style.transition = 'r 0.2s, stroke-width 0.2s, opacity 0.2s'
    g.appendChild(circle)

    const text = document.createElementNS(NS, 'text')
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dy', String(r + 14))
    text.setAttribute('font-size', '11')
    text.setAttribute('fill', 'var(--el-text-color-secondary)')
    text.setAttribute('pointer-events', 'none')
    text.style.transition = 'opacity 0.2s'
    text.style.textShadow = '0 1px 3px var(--el-bg-color), 0 -1px 3px var(--el-bg-color), 1px 0 3px var(--el-bg-color), -1px 0 3px var(--el-bg-color)'
    text.textContent = n.title.length > 14 ? n.title.substring(0, 14) + '…' : n.title
    g.appendChild(text)

    // hover 展开按钮（⊕）
    let bloomBtn: SVGGElement | null = null
    const bloomBtnEligible = !isEgoCenter && data.meta?.mode === 'ego' && hiddenNeighbors > 0
    if (bloomBtnEligible) {
      bloomBtn = document.createElementNS(NS, 'g')
      bloomBtn.style.opacity = '0'
      bloomBtn.style.transition = 'opacity 0.15s'
      bloomBtn.style.pointerEvents = 'none'
      bloomBtn.style.cursor = 'pointer'
      const btnOffset = r + 6
      const btnX = Math.SQRT1_2 * btnOffset
      const btnY = -Math.SQRT1_2 * btnOffset
      const btnBg = document.createElementNS(NS, 'circle')
      btnBg.setAttribute('cx', String(btnX)); btnBg.setAttribute('cy', String(btnY))
      btnBg.setAttribute('r', '8')
      btnBg.setAttribute('fill', 'var(--el-bg-color, #fff)')
      btnBg.setAttribute('stroke', '#0052d9')
      btnBg.setAttribute('stroke-width', '1.5')
      bloomBtn.appendChild(btnBg)
      const crossV = document.createElementNS(NS, 'line')
      crossV.setAttribute('x1', String(btnX)); crossV.setAttribute('x2', String(btnX))
      crossV.setAttribute('y1', String(btnY - 4)); crossV.setAttribute('y2', String(btnY + 4))
      crossV.setAttribute('stroke', '#0052d9'); crossV.setAttribute('stroke-width', '1.8')
      crossV.setAttribute('stroke-linecap', 'round')
      bloomBtn.appendChild(crossV)
      const crossH = document.createElementNS(NS, 'line')
      crossH.setAttribute('x1', String(btnX - 4)); crossH.setAttribute('x2', String(btnX + 4))
      crossH.setAttribute('y1', String(btnY)); crossH.setAttribute('y2', String(btnY))
      crossH.setAttribute('stroke', '#0052d9'); crossH.setAttribute('stroke-width', '1.8')
      crossH.setAttribute('stroke-linecap', 'round')
      bloomBtn.appendChild(crossH)
      bloomBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        emit('bloom', n.slug)
      })
      g.appendChild(bloomBtn)
    }

    // hover 高亮
    g.addEventListener('mouseenter', () => {
      if (graphHoverLeaveTimer) { clearTimeout(graphHoverLeaveTimer); graphHoverLeaveTimer = null }
      if (bloomBtn) { bloomBtn.style.opacity = '1'; bloomBtn.style.pointerEvents = 'auto' }
      if (graphHighlightSlug === n.slug) return
      graphHighlightSlug = n.slug
      applyHighlight(graphSelectedSlug || n.slug)
    })
    g.addEventListener('mouseleave', () => {
      if (graphHoverLeaveTimer) clearTimeout(graphHoverLeaveTimer)
      if (bloomBtn) { bloomBtn.style.opacity = '0'; bloomBtn.style.pointerEvents = 'none' }
      graphHoverLeaveTimer = setTimeout(() => {
        graphHoverLeaveTimer = null
        graphHighlightSlug = null
        if (graphSelectedSlug) applyHighlight(graphSelectedSlug)
        else clearHighlight()
      }, 60)
    })

    // 单击（220ms 防抖区分双击）/ shift 单击 / 双击
    let pendingSingleClick: ReturnType<typeof setTimeout> | null = null
    g.addEventListener('click', (e) => {
      e.stopPropagation()
      if (e.shiftKey) {
        if (pendingSingleClick) { clearTimeout(pendingSingleClick); pendingSingleClick = null }
        emit('bloom', n.slug)
        return
      }
      if (pendingSingleClick) clearTimeout(pendingSingleClick)
      pendingSingleClick = setTimeout(() => {
        pendingSingleClick = null
        graphSelectedSlug = n.slug
        applyHighlight(n.slug)
        // 自动平移到中心（为右侧抽屉让位）
        if (svg) {
          const cw = container.clientWidth
          const ch = container.clientHeight
          flyTo(cw / 2 - n.x * panZoom.scale - 240, ch / 2 - n.y * panZoom.scale)
        }
        emit('select', n.slug)
      }, 220)
    })
    g.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      if (pendingSingleClick) { clearTimeout(pendingSingleClick); pendingSingleClick = null }
      emit('pivot', n.slug)
    })

    setupDrag(g, n)
    nodeG.appendChild(g)
    graphNodeEls.push({ g, circle, text, activeRing, node: n })
  }

  setupPanZoom(svg)

  // 力导向模拟
  let alpha = 1.0
  function tick() {
    alpha *= 0.985
    if (alpha < 0.02) { graphAnimFrame = 0; return }

    const sorted = [...graphNodes].sort((a, b) => a.x - b.x)
    const MAX = 300
    const MAX_SQ = MAX * MAX
    for (let i = 0; i < sorted.length; i++) {
      const n1 = sorted[i]
      for (let j = i + 1; j < sorted.length; j++) {
        const n2 = sorted[j]
        const dx = n2.x - n1.x
        if (dx > MAX) break
        const dy = n2.y - n1.y
        if (Math.abs(dy) > MAX) continue
        const distSq = dx * dx + dy * dy
        if (distSq > MAX_SQ) continue
        const dist = Math.sqrt(distSq) || 1
        const force = (200 * alpha) / Math.max(distSq, 100) * 60
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        if (!n1.pinned) { n1.vx -= fx; n1.vy -= fy }
        if (!n2.pinned) { n2.vx += fx; n2.vy += fy }
      }
    }
    for (const e of (props.graph?.edges || [])) {
      const s = nodeMap.get(e.source)
      const t = nodeMap.get(e.target)
      if (!s || !t) continue
      const dx = t.x - s.x
      const dy = t.y - s.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist - 120) * 0.005 * alpha
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      if (!s.pinned) { s.vx += fx; s.vy += fy }
      if (!t.pinned) { t.vx -= fx; t.vy -= fy }
    }
    const gravityStrength = Math.min(0.01, 0.001 + graphNodes.length * 0.00002)
    for (const n of graphNodes) {
      if (n.pinned) continue
      n.vx += (width / 2 - n.x) * gravityStrength * alpha
      n.vy += (height / 2 - n.y) * gravityStrength * alpha
    }
    for (const n of graphNodes) {
      if (n.pinned) continue
      n.vx *= 0.6
      n.vy *= 0.6
      const v = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
      if (v > 20) { n.vx = (n.vx / v) * 20; n.vy = (n.vy / v) * 20 }
      n.x += n.vx
      n.y += n.vy
    }
    for (const { g, node } of graphNodeEls) {
      g.setAttribute('transform', `translate(${node.x},${node.y})`)
    }
    for (const e of graphEdgeEls) {
      const s = nodeMap.get(e.source)
      const t = nodeMap.get(e.target)
      if (s && t) setEdgePositions(e.line, s, t)
    }
    graphAnimFrame = requestAnimationFrame(tick)
  }

  for (const { g, node } of graphNodeEls) {
    g.setAttribute('transform', `translate(${node.x},${node.y})`)
  }
  for (const e of graphEdgeEls) {
    const s = nodeMap.get(e.source)
    const t = nodeMap.get(e.target)
    if (s && t) setEdgePositions(e.line, s, t)
  }
  if (graphSelectedSlug && nodeMap.has(graphSelectedSlug)) {
    applyHighlight(graphSelectedSlug)
  }
  graphAnimFrame = requestAnimationFrame(tick)
}

// ========== 拖动 ==========
function setupDrag(g: SVGGElement, node: GNode) {
  let dragging = false
  let startX = 0, startY = 0

  function getPoint(e: MouseEvent) {
    const svg = graphSvg
    if (!svg) return { x: e.clientX, y: e.clientY }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const rootG = svg.querySelector('.graph-root') as SVGGElement | null
    const ctm = rootG?.getCTM()?.inverse()
    if (ctm) {
      const p = pt.matrixTransform(ctm)
      return { x: p.x, y: p.y }
    }
    return { x: e.clientX, y: e.clientY }
  }

  function onStart(e: MouseEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    dragging = true
    node.pinned = true
    const p = getPoint(e)
    startX = p.x - node.x
    startY = p.y - node.y
    g.querySelector('circle')?.setAttribute('stroke-width', '3')
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
  }
  function onMove(e: MouseEvent) {
    if (!dragging) return
    const p = getPoint(e)
    node.x = p.x - startX
    node.y = p.y - startY
    node.vx = 0; node.vy = 0
    g.setAttribute('transform', `translate(${node.x},${node.y})`)
    for (const edge of graphEdgeEls) {
      if (edge.source === node.slug || edge.target === node.slug) {
        const sn = nodeMap.get(edge.source)
        const tn = nodeMap.get(edge.target)
        if (sn && tn) setEdgePositions(edge.line, sn, tn)
      }
    }
  }
  function onEnd() {
    dragging = false
    g.querySelector('circle')?.setAttribute('stroke', '#fff')
    g.querySelector('circle')?.setAttribute('stroke-width', '2')
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onEnd)
  }
  g.addEventListener('mousedown', onStart)
}

// ========== Pan / Zoom ==========
function flyTo(tx: number, ty: number, s?: number, duration = 400) {
  cancelAnimationFrame(animId)
  const startX = panZoom.translateX, startY = panZoom.translateY, startScale = panZoom.scale
  const targetScale = s || panZoom.scale
  const startTime = performance.now()
  const animate = (time: number) => {
    let t = (time - startTime) / duration
    if (t > 1) t = 1
    const ease = 1 - Math.pow(1 - t, 3)
    panZoom.translateX = startX + (tx - startX) * ease
    panZoom.translateY = startY + (ty - startY) * ease
    panZoom.scale = startScale + (targetScale - startScale) * ease
    applyTransform()
    if (t < 1) animId = requestAnimationFrame(animate)
  }
  animId = requestAnimationFrame(animate)
}

function setupPanZoom(svg: SVGSVGElement) {
  let panning = false
  let panStartX = 0, panStartY = 0
  let dragStartX = 0, dragStartY = 0

  svg.addEventListener('wheel', (e) => {
    e.preventDefault()
    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08
    const newScale = Math.max(0.2, Math.min(5, panZoom.scale * zoomFactor))
    const rect = svg.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    panZoom.translateX = cx - (cx - panZoom.translateX) * (newScale / panZoom.scale)
    panZoom.translateY = cy - (cy - panZoom.translateY) * (newScale / panZoom.scale)
    panZoom.scale = newScale
    applyTransform()
  }, { passive: false })

  svg.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    const tag = (e.target as Element).tagName
    if (tag === 'svg' || tag === 'SVG') {
      panning = true
      panStartX = e.clientX - panZoom.translateX
      panStartY = e.clientY - panZoom.translateY
      dragStartX = e.clientX
      dragStartY = e.clientY
      svg.style.cursor = 'grabbing'
    }
  })
  window.addEventListener('mousemove', (e) => {
    if (!panning) return
    panZoom.translateX = e.clientX - panStartX
    panZoom.translateY = e.clientY - panStartY
    applyTransform()
  })
  window.addEventListener('mouseup', (e) => {
    if (panning) {
      panning = false
      svg.style.cursor = 'default'
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        const tag = (e.target as Element).tagName
        if (tag === 'svg' || tag === 'SVG') {
          graphSelectedSlug = ''
          clearHighlight()
          emit('select', '')
        }
      }
    }
  })
}

// ========== 高亮 ==========
function applyHighlight(slug: string) {
  const neighbors = graphAdjacency.get(slug) || new Set()
  for (const { g, circle, activeRing, node } of graphNodeEls) {
    const r = nodeRadius(node)
    if (node.slug === slug || node.slug === graphHighlightSlug) {
      circle.setAttribute('r', String(r + 3))
      circle.setAttribute('stroke-width', '3')
      g.style.opacity = '1'
    } else if (neighbors.has(node.slug)) {
      circle.setAttribute('r', String(r))
      circle.setAttribute('stroke-width', '2')
      g.style.opacity = '1'
    } else {
      circle.setAttribute('r', String(r))
      circle.setAttribute('stroke-width', '2')
      g.style.opacity = '0.2'
    }
    activeRing.style.opacity = node.slug === graphSelectedSlug ? '1' : '0'
  }
  for (const e of graphEdgeEls) {
    if (e.source === slug || e.target === slug) {
      e.line.setAttribute('stroke-opacity', '0.9')
      e.line.setAttribute('stroke-width', '2')
      const focusNode = graphNodeEls.find(n => n.node.slug === slug)?.node
      const hlColor = focusNode ? (nodeColorMap[focusNode.type] || '#0052d9') : '#0052d9'
      e.line.setAttribute('stroke', hlColor)
      e.line.setAttribute('marker-end', 'url(#wiki-arrow-end-hl)')
      if (e.bidir) e.line.setAttribute('marker-start', 'url(#wiki-arrow-start-hl)')
    } else {
      e.line.setAttribute('stroke-opacity', '0.08')
      e.line.setAttribute('stroke-width', '1')
      e.line.setAttribute('marker-end', 'url(#wiki-arrow-end)')
      if (e.bidir) e.line.setAttribute('marker-start', 'url(#wiki-arrow-start)')
      else e.line.removeAttribute('marker-start')
    }
  }
}

function clearHighlight() {
  if (graphSelectedSlug) {
    applyHighlight(graphSelectedSlug)
    return
  }
  for (const { g, circle, activeRing, node } of graphNodeEls) {
    circle.setAttribute('r', String(nodeRadius(node)))
    circle.setAttribute('stroke-width', '2')
    g.style.opacity = '1'
    activeRing.style.opacity = '0'
  }
  for (const e of graphEdgeEls) {
    e.line.setAttribute('stroke', '#c0c4cc')
    e.line.setAttribute('stroke-width', '1.2')
    e.line.setAttribute('stroke-opacity', '0.4')
    e.line.setAttribute('marker-end', 'url(#wiki-arrow-end)')
    if (e.bidir) e.line.setAttribute('marker-start', 'url(#wiki-arrow-start)')
    else e.line.removeAttribute('marker-start')
  }
}

// ========== 暴露给父组件 ==========
/** 适应屏幕：把全部节点包进视口 */
function fitView() {
  if (!graphNodes.length || !graphSvg) return
  const container = canvasRef.value
  if (!container) return
  const width = container.clientWidth || 800
  const height = container.clientHeight || 600
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of graphNodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
  }
  const padding = 60
  const boxWidth = Math.max(maxX - minX, 100) + padding * 2
  const boxHeight = Math.max(maxY - minY, 100) + padding * 2
  const scaleX = width / boxWidth
  const scaleY = height / boxHeight
  const targetScale = Math.max(0.2, Math.min(2, Math.min(scaleX, scaleY)))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const targetTx = width / 2 - cx * targetScale
  const targetTy = height / 2 - cy * targetScale
  flyTo(targetTx, targetTy, targetScale, 600)
}

/** 切换箭头显示 */
function toggleArrows() {
  showArrows = !showArrows
  for (const e of graphEdgeEls) {
    if (showArrows) {
      e.line.setAttribute('marker-end', 'url(#wiki-arrow-end)')
      if (e.bidir) e.line.setAttribute('marker-start', 'url(#wiki-arrow-start)')
    } else {
      e.line.removeAttribute('marker-end')
      e.line.removeAttribute('marker-start')
    }
  }
  return showArrows
}

function getScale() {
  return panZoom.scale
}

defineExpose({ fitView, toggleArrows, getScale })

// ========== 生命周期 ==========
watch(
  () => props.graph,
  async (g) => {
    await nextTick()
    if (g && g.nodes?.length) {
      graphSelectedSlug = props.selected || ''
      renderGraph({ preserveLayout: !!props.preserveLayout })
    } else {
      if (graphAnimFrame) { cancelAnimationFrame(graphAnimFrame); graphAnimFrame = 0 }
      if (canvasRef.value) canvasRef.value.innerHTML = ''
      graphNodes = []
      graphNodeEls = []
      graphEdgeEls = []
    }
  }
)

watch(
  () => props.selected,
  (slug) => {
    if (slug) {
      graphSelectedSlug = slug
      if (nodeMap.has(slug)) applyHighlight(slug)
    } else {
      graphSelectedSlug = ''
      clearHighlight()
    }
  }
)

onMounted(() => {
  if (props.graph?.nodes?.length) {
    graphSelectedSlug = props.selected || ''
    renderGraph({ preserveLayout: false })
  }
})

onUnmounted(() => {
  if (graphAnimFrame) cancelAnimationFrame(graphAnimFrame)
  if (animId) cancelAnimationFrame(animId)
  if (graphHoverLeaveTimer) clearTimeout(graphHoverLeaveTimer)
})
</script>
<style scoped>
.wiki-graph {
  position: relative;
  width: 100%;
  min-height: 520px;
  height: 100%;
  flex: 1;
}
.wiki-graph-canvas {
  width: 100%;
  height: 100%;
  min-height: 520px;
}
.wiki-graph-canvas :deep(svg) {
  cursor: grab;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color);
}
.wiki-graph-canvas :deep(svg:active) {
  cursor: grabbing;
}
.wiki-graph-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
