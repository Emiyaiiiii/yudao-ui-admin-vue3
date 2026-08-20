/**
 * 知识库列表「自定义表头」配置
 *
 * 说明：
 * 1. 每个分类在「分类管理」里配置一份「列模板」，存储为 JSON 字符串，形如：
 *    [
 *      {"source":"builtin","builtin":"name","label":"项目名称"},
 *      {"source":"custom","key":"project_member","label":"项目成员","type":"member"}
 *    ]
 * 2. source=builtin：映射 kb_library 内置字段，label 可重命名。
 * 3. source=custom：自定义业务字段，值存 kb_library_ext 键值表（field_key → field_value）。
 * 4. 本文件被「分类管理」「知识库表单」「知识库大屏」共用。
 */

/** 内置列注册表（kb_library 固定字段，可改名标题） */
export interface BuiltinColumnDef {
  /** 内置字段标识，与 kb_library / LibraryRespVO 字段对应 */
  builtin: string
  /** 默认标题 */
  label: string
}

export const BUILTIN_COLUMNS: BuiltinColumnDef[] = [
  { builtin: 'name', label: '名称' },
  { builtin: 'description', label: '描述' },
  { builtin: 'docCount', label: '文档数' },
  { builtin: 'creator', label: '创建人' },
  { builtin: 'owner', label: '归属' },
  { builtin: 'isPublic', label: '公开状态' },
  { builtin: 'status', label: '状态' },
  { builtin: 'createTime', label: '创建时间' }
]

/** 自定义字段类型 */
export const CUSTOM_FIELD_TYPES: { type: string; label: string }[] = [
  { type: 'text', label: '文本' },
  { type: 'date', label: '日期' },
  { type: 'number', label: '数字' },
  { type: 'member', label: '成员(多选)' },
  { type: 'dept', label: '部门' },
  { type: 'select', label: '下拉选项' }
]

/** 列定义（列模板里的一行） */
export interface KbColumn {
  /** 列来源：内置 / 自定义 */
  source: 'builtin' | 'custom'
  /** source=builtin 时的内置字段 */
  builtin?: string
  /** source=custom 时的字段 key */
  key?: string
  /** 列标题 */
  label: string
  /** source=custom 时的字段类型：text/date/number/member/dept/select */
  type?: string
  /** type=select 时的选项 */
  options?: string[]
}

/** 默认列模板（分类未配置时使用） */
export const DEFAULT_COLUMNS: KbColumn[] = [
  { source: 'builtin', builtin: 'name', label: '名称' },
  { source: 'builtin', builtin: 'owner', label: '归属' },
  { source: 'builtin', builtin: 'docCount', label: '文档数' },
  { source: 'builtin', builtin: 'createTime', label: '创建时间' }
]

/**
 * 解析 columnConfig JSON → 列定义数组
 * 空/非法 JSON → 返回默认模板
 */
export function parseColumnConfig(json?: string | null): KbColumn[] {
  if (!json) return DEFAULT_COLUMNS.map((c) => ({ ...c }))
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return DEFAULT_COLUMNS.map((c) => ({ ...c }))
    return arr
      .filter((c: any) => c && (c.source === 'custom' ? c.key : c.builtin))
      .map((c: any) => ({
        source: c.source === 'custom' ? 'custom' : 'builtin',
        builtin: c.builtin,
        key: c.key,
        label: c.label || '',
        type: c.type,
        options: Array.isArray(c.options) ? c.options : undefined
      }))
  } catch {
    return DEFAULT_COLUMNS.map((c) => ({ ...c }))
  }
}

/** 序列化为 JSON 字符串，用于保存到后端 */
export function stringifyColumnConfig(columns: KbColumn[]): string {
  return JSON.stringify(columns)
}

/** 从列模板中提取自定义字段定义（用于知识库表单动态渲染输入项） */
export function getCustomColumns(columns: KbColumn[]): KbColumn[] {
  return columns.filter((c) => c.source === 'custom' && c.key)
}

/** 生成一个唯一的自定义字段 key */
export function genFieldKey(): string {
  return 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
