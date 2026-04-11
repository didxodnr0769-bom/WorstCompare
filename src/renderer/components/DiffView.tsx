import React, { useState, useEffect, useMemo } from 'react'
import * as Diff from 'diff'
import { ArrowLeftRight, Save } from 'lucide-react'

interface DiffViewProps {
  file: string
  leftDir: string
  rightDir: string
}

const DiffView: React.FC<DiffViewProps> = ({ file, leftDir, rightDir }) => {
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [bufferContent, setBufferContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true)
      try {
        const left = await window.api.readFile(`${leftDir}/${file}`)
        const right = await window.api.readFile(`${rightDir}/${file}`)
        setLeftContent(left || '')
        setRightContent(right || '')
        setBufferContent(right || '')
        setIsDirty(false)
      } catch (err) {
        console.error('Error loading files:', err)
      } finally {
        setLoading(false)
      }
    }
    loadFiles()
  }, [file, leftDir, rightDir])

  const handleCopyLeftToRight = () => {
    setBufferContent(leftContent)
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (!isDirty) return
    const targetPath = `${rightDir}/${file}`
    const success = await window.api.saveFile(targetPath, bufferContent)
    if (success) {
      setIsDirty(false)
      setRightContent(bufferContent)
    } else {
      alert('Failed to save file!')
    }
  }

  useEffect(() => {
    const listener = () => handleSave()
    window.addEventListener('save-current-file', listener)
    return () => window.removeEventListener('save-current-file', listener)
  }, [isDirty, bufferContent, rightDir, file])

  const diffParts = useMemo(() => {
    return Diff.diffLines(leftContent, bufferContent)
  }, [leftContent, bufferContent])

  if (loading) {
    return <div className="loading-state">Loading file content...</div>
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
          {diffParts.length === 0 && <div className="no-diff">No differences or file is empty.</div>}
          {diffParts.map((part, i) => (
            <div key={i} className={`diff-part ${part.added ? 'added' : part.removed ? 'removed' : 'unchanged'}`}>
              <div className="part-content">
                {part.value.split('\n').filter((l, idx, arr) => idx < arr.length - 1 || l !== '').map((line, li) => (
                  <div key={li} className="diff-line">
                    <span className="prefix">{part.added ? '+' : part.removed ? '-' : ' '}</span>
                    {line}
                  </div>
                ))}
              </div>
              {part.removed && (
                <button className="apply-hunk-btn" onClick={() => handleCopyLeftToRight()}>
                  Apply
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .loading-state, .no-diff {
          padding: 40px;
          text-align: center;
          color: #888;
          font-style: italic;
        }
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
          top: 5px;
          padding: 2px 8px;
          font-size: 0.7rem;
          background: #646cff;
          color: white;
          border: none;
          border-radius: 4px;
          opacity: 0;
          transition: opacity 0.2s;
          cursor: pointer;
        }
        .diff-part:hover .apply-hunk-btn { opacity: 1; }

        .save-button { background: #2ecc71; color: white; }
        .save-button:disabled { background: #444; opacity: 0.5; }
      `}</style>
    </div>
  )
}

export default DiffView
