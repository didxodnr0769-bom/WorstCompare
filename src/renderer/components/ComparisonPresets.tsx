import React, { useState } from 'react'
import {
  ComparisonAction,
  ComparisonSettings,
  getPresetNameError,
  normalizeExcludePatterns,
} from '../comparisonPresets'

interface ComparisonPresetsProps {
  settings: ComparisonSettings
  onChange: (action: ComparisonAction) => void
}

const ComparisonPresets: React.FC<ComparisonPresetsProps> = ({ settings, onChange }) => {
  const [isNaming, setIsNaming] = useState(false)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const selected = settings.presets.find(preset => preset.id === settings.selectedPresetId)
  const canSave = !!settings.leftDir.trim() && !!settings.rightDir.trim()
  const isModified =
    selected &&
    (settings.leftDir !== selected.leftDir ||
      settings.rightDir !== selected.rightDir ||
      normalizeExcludePatterns(settings.excludes) !== normalizeExcludePatterns(selected.excludes))

  const closeNameForm = () => {
    setIsNaming(false)
    setName('')
    setNameError(null)
  }

  const savePreset = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    const error = getPresetNameError(name, settings.presets)
    if (error) {
      setNameError(error)
      return
    }
    onChange({ type: 'save', id: crypto.randomUUID(), name })
    closeNameForm()
  }

  return (
    <div className="folder-input-group comparison-presets">
      <label htmlFor="comparison-preset">비교 프리셋</label>
      <div className="comparison-preset-controls">
        <select
          id="comparison-preset"
          value={settings.selectedPresetId}
          onChange={event => {
            onChange({ type: 'select', id: event.target.value })
            closeNameForm()
          }}
        >
          <option value="">
            직접 입력{settings.presets.length === 0 ? ' · 저장된 프리셋 없음' : ''}
          </option>
          {settings.presets.map(preset => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
              {preset.id === selected?.id && isModified ? ' (수정됨)' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setIsNaming(true)}
          disabled={isNaming || !canSave}
          aria-expanded={isNaming}
          title={canSave ? '현재 경로와 제외 패턴을 함께 저장' : '양쪽 폴더를 먼저 선택해 주세요.'}
        >
          새 프리셋 저장
        </button>
        {selected && (
          <>
            {isModified && (
              <button type="button" onClick={() => onChange({ type: 'select', id: selected.id })}>
                저장값 복원
              </button>
            )}
            <button
              type="button"
              disabled={!isModified || !canSave}
              onClick={() => onChange({ type: 'update' })}
              title={`현재 경로와 제외 패턴을 “${selected.name}”에 저장`}
            >
              덮어쓰기
            </button>
            <button
              type="button"
              onClick={() => {
                onChange({ type: 'delete' })
                closeNameForm()
              }}
              title={`“${selected.name}” 프리셋 삭제`}
            >
              삭제
            </button>
          </>
        )}
      </div>
      {isNaming && (
        <form className="comparison-preset-form" onSubmit={savePreset}>
          <div className="comparison-preset-name">
            <label htmlFor="comparison-preset-name">프리셋 이름</label>
            <input
              id="comparison-preset-name"
              value={name}
              onChange={event => {
                setName(event.target.value)
                setNameError(null)
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') closeNameForm()
              }}
              placeholder="예: A 프로젝트, B 프로젝트"
              autoFocus
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'comparison-preset-name-error' : undefined}
            />
          </div>
          <button type="submit" disabled={!canSave}>
            저장
          </button>
          <button type="button" onClick={closeNameForm}>
            취소
          </button>
          {nameError && (
            <div id="comparison-preset-name-error" className="comparison-preset-error" role="alert">
              {nameError}
            </div>
          )}
        </form>
      )}
      <div className="comparison-preset-hint">
        {selected && (!selected.leftDir || !selected.rightDir)
          ? '이전에 저장한 제외 패턴 프리셋입니다. 양쪽 폴더를 선택하고 덮어쓰기로 경로를 추가하세요.'
          : isModified
            ? '경로 또는 제외 패턴을 수정했습니다. 프리셋에 남기려면 덮어쓰기를 눌러 주세요.'
            : '왼쪽·오른쪽 폴더와 제외 패턴을 함께 저장합니다. 선택 후 비교를 눌러 주세요.'}
      </div>
      <style>{`
        .comparison-preset-controls, .comparison-preset-form {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .comparison-preset-controls select, .comparison-preset-name input {
          min-width: 0;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          padding: 6px 10px;
          border-radius: 4px;
          color: var(--input-text);
          font: inherit;
          font-size: 0.85rem;
        }
        .comparison-preset-controls select { flex: 1; min-width: 180px; }
        .comparison-presets button {
          background: var(--secondary-button-bg);
          color: var(--secondary-button-text);
          border: 1px solid var(--input-border);
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 0.8rem;
          white-space: nowrap;
        }
        .comparison-presets button:hover:not(:disabled) { background: var(--tree-row-hover); }
        .comparison-presets button:disabled { opacity: 0.5; cursor: not-allowed; }
        .comparison-preset-form {
          align-items: flex-end;
          padding: 12px;
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          border-radius: 6px;
        }
        .comparison-preset-name { display: flex; flex: 1; min-width: 180px; flex-direction: column; gap: 6px; }
        .comparison-preset-hint, .comparison-preset-error { font-size: 0.75rem; color: var(--label-color); }
        .comparison-preset-error { flex-basis: 100%; color: var(--status-left-only); }
      `}</style>
    </div>
  )
}

export default ComparisonPresets
