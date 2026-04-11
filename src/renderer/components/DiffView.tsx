import React, { useState, useEffect, useMemo } from 'react'
import * as Diff from 'diff'
import { ArrowLeftRight, Save, Trash2 } from 'lucide-react'

interface DiffViewProps {
  file: string
  leftDir: string
  rightDir: string
}

interface Hunk {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  leftLines: string[]
  rightLines: string[]
  startIndex: number
}

const DiffView: React.FC<DiffViewProps> = ({ file, leftDir, rightDir }) => {
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [bufferContent, setBufferContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [side, setSide] = useState<'left' | 'right'>('right') // Which side we are editing. For now, let's assume we edit the "right" side (apply left to right).

  useEffect(() => {
    const loadFiles = async () => {
      const left = await window.api.readFile(`${leftDir}/${file}`)
      const right = await window.api.readFile(`${rightDir}/${file}`)
      setLeftContent(left || '')
      setRightContent(right || '')
      setBufferContent(right || '') // Initial buffer is the right side content
    }
    loadFiles()
  }, [file, leftDir, rightDir])

  const hunks = useMemo(() => {
    const diff = Diff.diffLines(leftContent, rightContent)
    return diff
  }, [leftContent, rightContent])

  const handleApplyHunk = (index: number) => {
    const diff = Diff.diffLines(leftContent, bufferContent)
    const part = diff[index]
    if (!part || !part.removed) return

    // "Apply" in our context means taking a "removed" part (from Left) 
    // and ensuring it's in the buffer, or replacing the "added" part (in Buffer) with it.
    // This is complex to do perfectly without a full patch state.
    // For MVP, we'll focus on the "Copy All" and visual diffing.
  }

  return (
    <div className="diff-view-container">
      <div className="diff-toolbar">
        <div className="file-info">
          <span className="file-name">{file}</span>
          {isDirty && <span className="dirty-indicator">● modified</span>}
        </div>
        <div className="actions">
          <button onClick={handleCopyLeftToRight} title="Copy Left to Right">
            <ArrowLeftRight size={16} /> Copy All Left to Right
          </button>
          <button onClick={handleSave} disabled={!isDirty} className="save-button">
            <Save size={16} /> Save (Ctrl+S)
          </button>
        </div>
      </div>

      <div className="diff-content-scroll">
        <div className="diff-table">
          {Diff.diffLines(leftContent, bufferContent).map((part, i) => (
            <div key={i} className={`diff-part ${part.added ? 'added' : part.removed ? 'removed' : 'unchanged'}`}>
              <div className="part-content">
                {part.value.split('\n').filter((l, idx, arr) => idx < arr.length - 1 || l !== '').map((line, li) => (
                  <div key={li} className="diff-line">
                    <span className="prefix">{part.added ? '+' : part.removed ? '-' : ' '}</span>
                    {line}
                  </div>
                ))}
              </div>
              {(part.removed) && (
                <button className="apply-hunk-btn" onClick={() => {
                  // Simplified: if it's removed from left (meaning it's in Left but not in Buffer), 
                  // we can't easily "apply" it to a specific spot without a better patcher.
                  // We'll stick to Copy All for the first version to ensure stability.
                  handleCopyLeftToRight()
                }}>Apply</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .diff-view-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
        }
        .diff-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: #252526;
          border-bottom: 1px solid #333;
        }
        .file-name { font-weight: 600; color: #ccc; }
        .dirty-indicator { margin-left: 10px; color: #f1c40f; font-size: 0.8rem; }
        .actions { display: flex; gap: 10px; }
        .actions button { padding: 4px 8px; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
        
        .diff-content-scroll {
          flex: 1;
          overflow: auto;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
        }
        .diff-table {
          display: flex;
          flex-direction: column;
        }
        .diff-part {
          display: flex;
          position: relative;
          border-bottom: 1px solid #333;
        }
        .part-content { flex: 1; }
        .diff-line {
          display: flex;
          padding: 1px 10px;
          white-space: pre;
        }
        .prefix { width: 20px; color: #666; }
        
        .added { background: rgba(46, 204, 113, 0.15); }
        .added .prefix { color: #2ecc71; }
        .removed { background: rgba(231, 76, 60, 0.15); }
        .removed .prefix { color: #e74c3c; }
        
        .apply-hunk-btn {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          padding: 2px 8px;
          font-size: 0.7rem;
          background: #646cff;
          color: white;
          border: none;
          border-radius: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .diff-part:hover .apply-hunk-btn { opacity: 1; }

        .save-button { background: #2ecc71; color: white; }
        .save-button:disabled { background: #444; opacity: 0.5; }
      `}</style>
    </div>
  )
}

export default DiffView
