import React, { useState } from 'react'
import { FolderOpen, Play, RotateCw, History, Undo2, Redo2 } from 'lucide-react'
import ComparisonPresets from './ComparisonPresets'
import { ComparisonAction, ComparisonSettings } from '../comparisonPresets'

interface HistoryItem {
  left: string
  right: string
  timestamp: number
}

interface FolderSelectorProps {
  leftDir: string
  rightDir: string
  setLeftDir: (path: string) => void
  setRightDir: (path: string) => void
  comparisonSettings: ComparisonSettings
  onSettingsChange: (action: ComparisonAction) => void
  onCompare: () => void
  onRefresh: () => void
  hasResults: boolean
  history: HistoryItem[]
  onSelectHistory: (h: HistoryItem) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  disabled: boolean
}

const FolderSelector: React.FC<FolderSelectorProps> = ({
  leftDir,
  rightDir,
  setLeftDir,
  setRightDir,
  comparisonSettings,
  onSettingsChange,
  onCompare,
  onRefresh,
  hasResults,
  history,
  onSelectHistory,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  disabled,
}) => {
  const [showHistory, setShowHistory] = useState(false)

  const handleSelect = async (side: 'left' | 'right') => {
    const path = await window.api.selectFolder()
    if (path) {
      if (side === 'left') setLeftDir(path)
      else setRightDir(path)
    }
  }

  return (
    <fieldset className="folder-selector-container" disabled={disabled}>
      <ComparisonPresets settings={comparisonSettings} onChange={onSettingsChange} />
      <div className="folder-inputs">
        <div className="folder-input-group">
          <label>왼쪽 폴더</label>
          <div className="input-with-button">
            <input type="text" value={leftDir} readOnly placeholder="폴더 선택..." />
            <button onClick={() => handleSelect('left')} title="폴더 선택">
              <FolderOpen size={18} />
            </button>
          </div>
        </div>

        <div className="folder-input-group">
          <label>오른쪽 폴더</label>
          <div className="input-with-button">
            <input type="text" value={rightDir} readOnly placeholder="폴더 선택..." />
            <button onClick={() => handleSelect('right')} title="폴더 선택">
              <FolderOpen size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="folder-input-group">
        <label className="label-with-help" htmlFor="exclude-patterns">
          제외 패턴
          <span className="help-tip" tabIndex={0}>
            <span className="help-mark">?</span>
            <span className="help-tip-content">
              비교에서 제외할 폴더·파일 패턴입니다.
              <br />
              쉼표(,)로 구분해 여러 개를 입력할 수 있습니다.
              <br />
              경로에 입력한 문자열이 포함되면 비교 대상에서 제외됩니다.
              <br />
              예: node_modules, .git, dist, build, .DS_Store
            </span>
          </span>
        </label>
        <input
          id="exclude-patterns"
          type="text"
          value={comparisonSettings.excludes}
          onChange={event =>
            onSettingsChange({ type: 'edit', values: { excludes: event.target.value } })
          }
          placeholder="node_modules, .git, ..."
          className="exclude-input"
        />
      </div>

      <div className="action-buttons">
        <button className="compare-button" onClick={onCompare} disabled={!leftDir || !rightDir}>
          <Play size={18} /> 비교
        </button>
        <button
          className="undo-button"
          onClick={onUndo}
          disabled={!canUndo}
          title="실행 취소 (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          className="redo-button"
          onClick={onRedo}
          disabled={!canRedo}
          title="다시 실행 (Ctrl+Y)"
        >
          <Redo2 size={18} />
        </button>
        {hasResults && (
          <button
            className="refresh-button"
            onClick={onRefresh}
            title="비교 새로고침 (모든 폴더 접힘)"
          >
            <RotateCw size={18} /> 새로고침
          </button>
        )}
        <button
          className={`history-toggle ${showHistory ? 'active' : ''}`}
          onClick={() => setShowHistory(!showHistory)}
          title="비교 기록"
        >
          <History size={18} />
        </button>
      </div>

      {showHistory && (
        <div className="history-dropdown">
          {history.length === 0 && <div className="no-history">기록이 없습니다.</div>}
          {history.map((h, i) => (
            <div
              key={i}
              className="history-item"
              onClick={() => {
                onSelectHistory(h)
                setShowHistory(false)
              }}
            >
              <div className="h-path">왼쪽: {h.left}</div>
              <div className="h-path">오른쪽: {h.right}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .folder-selector-container {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 15px;
          background: var(--card-bg);
          padding: 15px;
          border-radius: 8px;
          margin: 0 0 15px;
          min-width: 0;
          border: 1px solid var(--border-color);
        }
        .folder-inputs {
          display: flex;
          gap: 20px;
        }
        .folder-input-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .folder-input-group label {
          font-size: 0.8rem;
          color: var(--label-color);
          text-transform: uppercase;
        }
        .label-with-help { display: inline-flex; align-items: center; gap: 5px; }
        .help-tip { position: relative; display: inline-flex; align-items: center; cursor: help; outline: none; }
        .help-mark {
          display: inline-flex; align-items: center; justify-content: center;
          width: 14px; height: 14px; border-radius: 50%;
          border: 1px solid var(--label-color); color: var(--label-color);
          font-size: 0.62rem; font-weight: 700; line-height: 1; text-transform: none;
        }
        .help-tip:hover .help-mark, .help-tip:focus .help-mark { border-color: #646cff; color: #646cff; }
        .help-tip-content {
          position: absolute; left: 0; top: calc(100% + 8px); z-index: 200;
          width: 320px; max-width: 70vw; padding: 10px 12px;
          background: var(--header-bg); color: var(--text-color);
          border: 1px solid var(--border-color); border-radius: 6px;
          font-size: 0.72rem; font-weight: 400; line-height: 1.6;
          text-transform: none; white-space: normal; letter-spacing: normal;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          opacity: 0; visibility: hidden; transition: opacity 0.15s ease; pointer-events: none;
        }
        .help-tip:hover .help-tip-content, .help-tip:focus .help-tip-content {
          opacity: 1; visibility: visible;
        }
        .input-with-button {
          display: flex;
          gap: 8px;
        }
        .input-with-button input {
          flex: 1;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          padding: 6px 10px;
          border-radius: 4px;
          color: var(--input-text);
          font-size: 0.85rem;
          font-family: inherit;
        }
        .exclude-input {
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          padding: 6px 10px;
          border-radius: 4px;
          color: var(--input-text);
          font-size: 0.85rem;
          font-family: inherit;
          width: 100%;
          display: block;
        }
        .action-buttons {
          display: flex;
          gap: 10px;
        }
        .compare-button, .refresh-button, .history-toggle, .undo-button, .redo-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 16px;
          font-weight: 600;
          font-size: 0.9rem;
          border-radius: 4px;
        }
        .compare-button {
          background: #646cff;
          color: white;
          flex: 1;
          border: none;
        }
        .compare-button:hover { background: #535bf2; }
        .compare-button:disabled { background: var(--secondary-button-bg); color: var(--secondary-button-text); cursor: not-allowed; opacity: 0.6; }
        
        .undo-button, .redo-button, .refresh-button, .history-toggle {
          background: var(--secondary-button-bg);
          color: var(--secondary-button-text);
          border: 1px solid var(--input-border);
          padding: 6px 12px;
        }
        .undo-button:hover:not(:disabled), .redo-button:hover:not(:disabled), .refresh-button:hover, .history-toggle:hover { 
          background: var(--tree-row-hover); 
          color: var(--text-color); 
        }
        .undo-button:disabled, .redo-button:disabled {
          cursor: not-allowed;
          opacity: 0.3;
        }
        
        .history-toggle.active { background: #646cff; color: white; border-color: #646cff; }

        .history-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--card-bg);
          border: 1px solid var(--input-border);
          border-top: none;
          z-index: 100;
          max-height: 250px;
          overflow-y: auto;
          box-shadow: 0 10px 15px rgba(0,0,0,0.3);
          border-radius: 0 0 8px 8px;
        }
        .history-item {
          padding: 10px 15px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
        }
        .history-item:hover { background: var(--tree-row-hover); }
        .h-path { font-size: 0.75rem; color: var(--label-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .no-history { padding: 20px; text-align: center; color: var(--label-color); font-size: 0.9rem; }
      `}</style>
    </fieldset>
  )
}

export default FolderSelector
