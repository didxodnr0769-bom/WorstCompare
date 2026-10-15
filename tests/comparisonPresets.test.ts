import { describe, expect, it } from 'vitest'
import {
  comparisonSettingsReducer,
  getPresetNameError,
  loadComparisonSettings,
  normalizeExcludePatterns,
  type ComparisonSettings,
  type ComparisonValues,
} from '../src/renderer/comparisonPresets'

const webValues: ComparisonValues = {
  leftDir: '/projects/web-before',
  rightDir: '/projects/web-after',
  excludes: 'node_modules, .git',
}

const svnValues: ComparisonValues = {
  leftDir: '/projects/svn-before',
  rightDir: '/projects/svn-after',
  excludes: '.svn, build',
}

function settings(values: Partial<ComparisonValues> = {}): ComparisonSettings {
  return { ...webValues, ...values, presets: [], selectedPresetId: '' }
}

function savedSettings(): ComparisonSettings {
  return comparisonSettingsReducer(settings(), { type: 'save', id: 'web', name: '웹' })
}

describe('비교 프리셋', () => {
  it('왼쪽 경로·오른쪽 경로·제외 패턴을 하나의 이름으로 저장하고 선택한다', () => {
    const original = settings({ excludes: ' node_modules ,, .git, dist, ' })
    const saved = comparisonSettingsReducer(original, {
      type: 'save',
      id: 'web',
      name: '  웹 프로젝트  ',
    })

    expect(saved.presets).toEqual([
      { ...webValues, id: 'web', name: '웹 프로젝트', excludes: 'node_modules, .git, dist' },
    ])
    expect(saved.selectedPresetId).toBe('web')
    expect(original.presets).toEqual([])
    expect(original.selectedPresetId).toBe('')
  })

  it('프리셋 선택은 세 입력을 모두 선택한 값으로 교체한다', () => {
    const state: ComparisonSettings = {
      ...webValues,
      presets: [
        { ...webValues, id: 'web', name: '웹' },
        { ...svnValues, id: 'svn', name: 'SVN' },
      ],
      selectedPresetId: 'web',
    }

    const selected = comparisonSettingsReducer(state, { type: 'select', id: 'svn' })

    expect(selected).toEqual({ ...state, ...svnValues, selectedPresetId: 'svn' })
    expect(state.leftDir).toBe(webValues.leftDir)
  })

  it.each([
    { leftDir: '/edited-left' },
    { rightDir: '/edited-right' },
    { excludes: '.svn, build' },
  ])('입력 하나만 편집해도 저장된 세트와 나머지 입력을 보호한다 (%o)', values => {
    const saved = savedSettings()
    const edited = comparisonSettingsReducer(saved, { type: 'edit', values })

    expect(edited).toEqual({ ...saved, ...values })
    expect(edited.selectedPresetId).toBe('web')
    expect(edited.presets[0]).toEqual({ ...webValues, id: 'web', name: '웹' })
    expect(saved).toEqual({
      ...webValues,
      presets: [{ ...webValues, id: 'web', name: '웹' }],
      selectedPresetId: 'web',
    })
  })

  it('저장값 복원은 미저장한 세 입력을 모두 원래 세트로 되돌린다', () => {
    const saved = savedSettings()
    const edited = comparisonSettingsReducer(saved, { type: 'edit', values: svnValues })

    expect(comparisonSettingsReducer(edited, { type: 'select', id: 'web' })).toEqual(saved)
  })

  it('덮어쓰기는 선택한 프리셋의 세 값만 갱신한다', () => {
    const state: ComparisonSettings = {
      ...svnValues,
      excludes: ' .svn ,, build, ',
      presets: [
        { ...webValues, id: 'web', name: '웹' },
        { ...webValues, id: 'svn', name: 'SVN' },
      ],
      selectedPresetId: 'svn',
    }

    const updated = comparisonSettingsReducer(state, { type: 'update' })

    expect(updated.presets).toEqual([
      { ...webValues, id: 'web', name: '웹' },
      { ...svnValues, id: 'svn', name: 'SVN' },
    ])
    expect(updated.selectedPresetId).toBe('svn')
    expect(state.presets[1]).toEqual({ ...webValues, id: 'svn', name: 'SVN' })
  })

  it('프리셋 삭제는 현재 세 입력과 다른 프리셋을 보존한다', () => {
    const state: ComparisonSettings = {
      ...svnValues,
      presets: [
        { ...webValues, id: 'web', name: '웹' },
        { ...svnValues, id: 'svn', name: 'SVN' },
      ],
      selectedPresetId: 'web',
    }

    expect(comparisonSettingsReducer(state, { type: 'delete' })).toEqual({
      ...svnValues,
      presets: [{ ...svnValues, id: 'svn', name: 'SVN' }],
      selectedPresetId: '',
    })
    expect(state.presets).toHaveLength(2)
  })

  it.each(['', '없는 ID'])('선택 해제와 없는 ID 선택은 현재 세 입력을 보존한다 (%s)', id => {
    const saved = savedSettings()
    const edited = comparisonSettingsReducer(saved, { type: 'edit', values: svnValues })

    expect(comparisonSettingsReducer(edited, { type: 'select', id })).toEqual({
      ...edited,
      selectedPresetId: '',
    })
  })

  it('선택이 없을 때 덮어쓰기와 삭제는 기존 프리셋에 영향을 주지 않는다', () => {
    const state = { ...savedSettings(), selectedPresetId: '' }

    expect(comparisonSettingsReducer(state, { type: 'update' })).toEqual(state)
    expect(comparisonSettingsReducer(state, { type: 'delete' })).toEqual(state)
  })

  it('빈 제외 패턴도 세트로 저장·선택·덮어쓰기할 수 있다', () => {
    const empty = comparisonSettingsReducer(settings({ excludes: ' , , ' }), {
      type: 'save',
      id: 'all',
      name: '전체 비교',
    })
    expect(empty.presets[0]).toEqual({ ...webValues, excludes: '', id: 'all', name: '전체 비교' })

    const selected = comparisonSettingsReducer(empty, { type: 'select', id: 'all' })
    expect(selected.excludes).toBe('')
    expect(selected.leftDir).toBe(webValues.leftDir)
    expect(selected.rightDir).toBe(webValues.rightDir)

    const edited = comparisonSettingsReducer(selected, {
      type: 'edit',
      values: { excludes: 'dist' },
    })
    const updated = comparisonSettingsReducer(edited, { type: 'update' })
    expect(updated.presets[0].excludes).toBe('dist')

    const cleared = comparisonSettingsReducer(updated, { type: 'edit', values: { excludes: '' } })
    expect(comparisonSettingsReducer(cleared, { type: 'update' }).presets[0].excludes).toBe('')
  })

  it.each([
    { leftDir: '' },
    { rightDir: '' },
    { leftDir: '  ' },
    { rightDir: '  ' },
    { leftDir: '', rightDir: '' },
  ])('좌우 경로가 모두 준비되기 전에는 새 저장과 덮어쓰기를 막는다 (%o)', values => {
    const unsaved = settings(values)
    const edited = comparisonSettingsReducer(savedSettings(), { type: 'edit', values })

    expect(comparisonSettingsReducer(unsaved, { type: 'save', id: 'web', name: '웹' })).toEqual(
      unsaved
    )
    expect(comparisonSettingsReducer(edited, { type: 'update' })).toEqual(edited)
    expect(edited.presets[0]).toEqual({ ...webValues, id: 'web', name: '웹' })
  })

  it('빈 이름과 앞뒤 공백만 다른 중복 이름은 저장할 수 없다', () => {
    const saved = savedSettings()

    expect(getPresetNameError('  ', saved.presets)).toBeTruthy()
    expect(getPresetNameError(' 웹 ', saved.presets)).toBeTruthy()
    expect(getPresetNameError(' SVN ', saved.presets)).toBeNull()
    expect(comparisonSettingsReducer(saved, { type: 'save', id: 'other', name: ' 웹 ' })).toEqual(
      saved
    )
    expect(comparisonSettingsReducer(saved, { type: 'save', id: 'other', name: '  ' })).toEqual(
      saved
    )
  })

  it.each(['web', '', '  '])('중복 또는 빈 ID로 프리셋을 추가하지 않는다 (%s)', id => {
    const saved = savedSettings()

    expect(comparisonSettingsReducer(saved, { type: 'save', id, name: '다른 이름' })).toEqual(saved)
  })

  it('이전 제외 입력은 빈 좌우 경로와 함께 복원하고 제외 없음도 보존한다', () => {
    expect(loadComparisonSettings(null, null, '.svn, build')).toEqual(
      settings({ leftDir: '', rightDir: '', excludes: '.svn, build' })
    )
    expect(loadComparisonSettings(null, null, '')).toEqual(
      settings({ leftDir: '', rightDir: '', excludes: '' })
    )
    expect(loadComparisonSettings(null, null, null)).toEqual(
      settings({
        leftDir: '',
        rightDir: '',
        excludes: 'node_modules, .git, dist, build, .DS_Store',
      })
    )
  })

  it('이전 제외 프리셋의 이름·패턴·선택을 빈 좌우 경로 세트로 마이그레이션한다', () => {
    const legacy = JSON.stringify({
      value: '미저장 제외 입력',
      presets: [
        { id: 'web', name: '웹', patterns: 'node_modules, .git' },
        { id: 'all', name: '전체', patterns: '' },
      ],
      selectedPresetId: 'web',
    })

    const restored = loadComparisonSettings(null, legacy, '더 오래된 제외 설정')

    expect(restored).toEqual({
      leftDir: '',
      rightDir: '',
      excludes: '미저장 제외 입력',
      presets: [
        { id: 'web', name: '웹', leftDir: '', rightDir: '', excludes: 'node_modules, .git' },
        { id: 'all', name: '전체', leftDir: '', rightDir: '', excludes: '' },
      ],
      selectedPresetId: 'web',
    })

    const selected = comparisonSettingsReducer(restored, { type: 'select', id: 'all' })
    expect(selected.leftDir).toBe('')
    expect(selected.rightDir).toBe('')
    expect(selected.excludes).toBe('')
    expect(comparisonSettingsReducer(selected, { type: 'update' })).toEqual(selected)
  })

  it('새 비교 설정이 있으면 이전 제외 프리셋과 입력보다 우선한다', () => {
    const state = savedSettings()
    const legacy = JSON.stringify({
      value: '.svn',
      presets: [{ id: 'old', name: '이전', patterns: '.svn' }],
      selectedPresetId: 'old',
    })

    expect(loadComparisonSettings(JSON.stringify(state), legacy, 'build')).toEqual(state)
  })

  it.each(['{broken', 'null', '42', '"text"'])(
    '손상되거나 잘못된 새 저장 데이터는 이전 프리셋으로 복구한다 (%s)',
    raw => {
      const legacy = JSON.stringify({
        value: '.svn',
        presets: [{ id: 'old', name: '이전', patterns: '.svn' }],
        selectedPresetId: 'old',
      })

      expect(loadComparisonSettings(raw, legacy, 'build')).toEqual(
        loadComparisonSettings(null, legacy, 'build')
      )
    }
  )

  it('이전 저장 데이터까지 손상되었으면 기존 제외 입력으로 복구한다', () => {
    expect(loadComparisonSettings('{broken', '{broken', '.svn')).toEqual(
      settings({ leftDir: '', rightDir: '', excludes: '.svn' })
    )
  })

  it('새 저장 데이터의 유효한 세트만 살리고 손상·중복 항목을 제외한다', () => {
    const restored = loadComparisonSettings(
      JSON.stringify({
        ...svnValues,
        selectedPresetId: 'web',
        presets: [
          null,
          false,
          { ...webValues, id: 'web', name: ' 웹 ' },
          { ...svnValues, id: 'web', name: '중복 ID' },
          { ...svnValues, id: 'duplicate-name', name: '웹' },
          { ...svnValues, id: 'blank-name', name: ' ' },
          { ...svnValues, id: ' ', name: '빈 ID' },
          { ...svnValues, id: 'bad-left', name: '잘못된 경로', leftDir: 7 },
          { ...svnValues, id: 'bad-excludes', name: '잘못된 패턴', excludes: ['.git'] },
          { ...svnValues, id: 'svn', name: 'SVN' },
        ],
      }),
      null,
      '기존 제외'
    )

    expect(restored).toEqual({
      ...svnValues,
      presets: [
        { ...webValues, id: 'web', name: '웹' },
        { ...svnValues, id: 'svn', name: 'SVN' },
      ],
      selectedPresetId: 'web',
    })
  })

  it('이전 프리셋도 손상 항목과 중복 이름·ID를 거른 뒤 변환한다', () => {
    const restored = loadComparisonSettings(
      null,
      JSON.stringify({
        value: '',
        presets: [
          null,
          { id: 'web', name: '웹', patterns: '.git' },
          { id: 'web', name: '중복 ID', patterns: 'dist' },
          { id: 'other', name: ' 웹 ', patterns: 'build' },
          { id: 'bad', name: '손상', patterns: 7 },
        ],
        selectedPresetId: 'bad',
      }),
      'legacy'
    )

    expect(restored).toEqual({
      leftDir: '',
      rightDir: '',
      excludes: '',
      presets: [{ id: 'web', name: '웹', leftDir: '', rightDir: '', excludes: '.git' }],
      selectedPresetId: '',
    })
  })

  it('사라진 선택 ID는 해제하고 현재 세 입력은 보존한다', () => {
    const state = { ...savedSettings(), ...svnValues, selectedPresetId: 'deleted' }

    expect(loadComparisonSettings(JSON.stringify(state), null, null)).toEqual({
      ...state,
      selectedPresetId: '',
    })
  })

  it('직렬화 왕복은 세 입력의 미저장 변경과 저장된 원본을 함께 보존한다', () => {
    const saved = savedSettings()
    const draft = comparisonSettingsReducer(saved, { type: 'edit', values: svnValues })
    const restored = loadComparisonSettings(JSON.stringify(draft), null, '과거 값')

    expect(restored).toEqual(draft)
    expect(restored.presets[0]).toEqual({ ...webValues, id: 'web', name: '웹' })
    expect(restored.selectedPresetId).toBe('web')
    expect(comparisonSettingsReducer(restored, { type: 'select', id: 'web' })).toEqual(saved)
  })

  it('이전 프리셋에서 좌우 경로를 채워 덮어쓰면 완전한 비교 세트로 복원할 수 있다', () => {
    const migrated = loadComparisonSettings(
      null,
      JSON.stringify({
        value: '.svn',
        presets: [{ id: 'svn', name: 'SVN', patterns: '.svn' }],
        selectedPresetId: 'svn',
      }),
      null
    )
    const edited = comparisonSettingsReducer(migrated, { type: 'edit', values: svnValues })
    const updated = comparisonSettingsReducer(edited, { type: 'update' })
    const restored = loadComparisonSettings(JSON.stringify(updated), null, null)

    expect(restored).toEqual(updated)
    expect(restored.presets[0]).toEqual({ ...svnValues, id: 'svn', name: 'SVN' })
  })

  it('패턴 정리는 공백과 빈 항목만 제거하고 실제 비교 문자열은 보존한다', () => {
    expect(normalizeExcludePatterns(' .git , dir/name ,, *.log, .git, ')).toBe(
      '.git, dir/name, *.log, .git'
    )
    expect(normalizeExcludePatterns(' , , ')).toBe('')
  })
})
