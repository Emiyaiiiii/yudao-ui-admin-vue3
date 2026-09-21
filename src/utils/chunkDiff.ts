/**
 * chunkDiff.ts — 自绘简版文本 diff（#7 修订历史展示）
 *
 * 不做字符级高亮、不引第三方依赖：按行贪心 LCS，标记 added（绿）/removed（红）/unchanged。
 * 返回分段列表供前端渲染。
 */

export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged'
  lines: string[]
}

/**
 * 按行计算两个文本的 diff。
 * @param oldText 旧文本
 * @param newText 新文本
 */
export function diffLines(oldText: string, newText: string): DiffSegment[] {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  const lcs = computeLcs(a, b)

  const segments: DiffSegment[] = []
  let i = 0
  let j = 0
  const flush = (type: 'added' | 'removed' | 'unchanged', lines: string[]) => {
    if (!lines.length) return
    const last = segments[segments.length - 1]
    if (last && last.type === type) {
      last.lines.push(...lines)
    } else {
      segments.push({ type, lines })
    }
  }

  for (const match of lcs) {
    // 旧文本中不在 LCS 的行 → removed
    while (i < match.ai) {
      flush('removed', [a[i]])
      i++
    }
    // 新文本中不在 LCS 的行 → added
    while (j < match.bi) {
      flush('added', [b[j]])
      j++
    }
    // 公共行 → unchanged
    flush('unchanged', [a[i]])
    i++
    j++
  }
  while (i < a.length) {
    flush('removed', [a[i]])
    i++
  }
  while (j < b.length) {
    flush('added', [b[j]])
    j++
  }
  return segments
}

function splitLines(text: string): string[] {
  if (!text) return []
  return text.split(/\r?\n/)
}

/** LCS 位置对（贪心 DP，适合切片级文本量） */
function computeLcs(a: string[], b: string[]): { ai: number; bi: number }[] {
  const n = a.length
  const m = b.length
  // dp[i][j]：a[0..i-1] 与 b[0..j-1] 的 LCS 长度
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  // 回溯
  const result: { ai: number; bi: number }[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift({ ai: i - 1, bi: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  return result
}
