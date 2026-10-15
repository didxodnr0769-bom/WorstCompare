export const COMPARISON_PRESETS_STORAGE_KEY = 'app-comparison-presets'
const DEFAULT_EXCLUDES = 'node_modules, .git, dist, build, .DS_Store'

export interface ComparisonValues {
  leftDir: string
  rightDir: string
  excludes: string
}

export interface ComparisonPreset extends ComparisonValues {
  id: string
  name: string
}

export interface ComparisonSettings extends ComparisonValues {
  presets: ComparisonPreset[]
  selectedPresetId: string
}

export type ComparisonAction =
  | { type: 'edit'; values: Partial<ComparisonValues> }
  | { type: 'select'; id: string }
  | { type: 'save'; id: string; name: string }
  | { type: 'update' }
  | { type: 'delete' }

export function normalizeExcludePatterns(value: string): string {
  return value
    .split(',')
    .map(pattern => pattern.trim())
    .filter(Boolean)
    .join(', ')
}

export function getPresetNameError(name: string, presets: { name: string }[]): string | null {
  const trimmed = name.trim()
  if (!trimmed) return '프리셋 이름을 입력해 주세요.'
  if (presets.some(preset => preset.name === trimmed)) return '이미 사용 중인 이름입니다.'
  return null
}

export function loadComparisonSettings(
  saved: string | null,
  legacyPresets: string | null,
  legacyExcludes: string | null
): ComparisonSettings {
  const fallback: ComparisonSettings = {
    leftDir: '',
    rightDir: '',
    excludes: legacyExcludes ?? DEFAULT_EXCLUDES,
    presets: [],
    selectedPresetId: '',
  }

  const restore = (raw: string | null, legacy: boolean): ComparisonSettings | null => {
    if (!raw) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      const data = parsed as Record<string, unknown>
      if (!Array.isArray(data.presets)) return null
      const presets: ComparisonPreset[] = []
      for (const item of data.presets) {
        if (!item || typeof item !== 'object') continue
        const { id, name } = item
        const excludes = legacy ? item.patterns : item.excludes
        const leftDir = legacy ? '' : item.leftDir
        const rightDir = legacy ? '' : item.rightDir
        if (
          typeof id !== 'string' ||
          !id.trim() ||
          typeof name !== 'string' ||
          getPresetNameError(name, presets) ||
          typeof excludes !== 'string' ||
          typeof leftDir !== 'string' ||
          typeof rightDir !== 'string' ||
          presets.some(preset => preset.id === id)
        ) {
          continue
        }
        presets.push({ id, name: name.trim(), leftDir, rightDir, excludes })
      }
      const excludes = legacy ? data.value : data.excludes
      return {
        leftDir: !legacy && typeof data.leftDir === 'string' ? data.leftDir : '',
        rightDir: !legacy && typeof data.rightDir === 'string' ? data.rightDir : '',
        excludes: typeof excludes === 'string' ? excludes : fallback.excludes,
        presets,
        selectedPresetId: presets.some(preset => preset.id === data.selectedPresetId)
          ? (data.selectedPresetId as string)
          : '',
      }
    } catch {
      return null
    }
  }

  return restore(saved, false) ?? restore(legacyPresets, true) ?? fallback
}

export function comparisonSettingsReducer(
  state: ComparisonSettings,
  action: ComparisonAction
): ComparisonSettings {
  switch (action.type) {
    case 'edit':
      return { ...state, ...action.values }
    case 'select': {
      const preset = state.presets.find(item => item.id === action.id)
      return {
        ...state,
        selectedPresetId: preset?.id ?? '',
        leftDir: preset?.leftDir ?? state.leftDir,
        rightDir: preset?.rightDir ?? state.rightDir,
        excludes: preset?.excludes ?? state.excludes,
      }
    }
    case 'save': {
      if (getPresetNameError(action.name, state.presets)) return state
      if (!action.id.trim() || state.presets.some(preset => preset.id === action.id)) return state
      if (!state.leftDir.trim() || !state.rightDir.trim()) return state
      const preset = {
        id: action.id,
        name: action.name.trim(),
        leftDir: state.leftDir,
        rightDir: state.rightDir,
        excludes: normalizeExcludePatterns(state.excludes),
      }
      return {
        ...state,
        presets: [...state.presets, preset],
        selectedPresetId: preset.id,
      }
    }
    case 'update':
      if (!state.leftDir.trim() || !state.rightDir.trim()) return state
      return {
        ...state,
        presets: state.presets.map(preset =>
          preset.id === state.selectedPresetId
            ? {
                ...preset,
                leftDir: state.leftDir,
                rightDir: state.rightDir,
                excludes: normalizeExcludePatterns(state.excludes),
              }
            : preset
        ),
      }
    case 'delete':
      return {
        ...state,
        presets: state.presets.filter(preset => preset.id !== state.selectedPresetId),
        selectedPresetId: '',
      }
  }
}
