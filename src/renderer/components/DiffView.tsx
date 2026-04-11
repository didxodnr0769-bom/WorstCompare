import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import * as Diff from 'diff'
import { ArrowLeftRight, Save, ArrowLeft, RotateCcw, RotateCw } from 'lucide-react'

interface DiffViewProps {
  file: string
  leftDir: string
  rightDir: string
  onBack: () => void
  onRefresh: () => void
}

interface HistoryState {
  left: string
  right: string
}

const DiffView: React.FC<DiffViewProps> = ({ file, leftDir, rightDir, onBack, onRefresh }) => {
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [originalLeft, setOriginalLeft] = useState<string>('')
  const [originalRight, setOriginalRight] = useState<string>('')
  const [loading, setLoading] = useState(true)
  
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const scrollRefLeft = useRef<HTMLTextAreaElement>(null)
  const scrollRefRight = useRef<HTMLTextAreaElement>(null)
  const bgRefLeft = useRef<HTMLDivElement>(null)
  const bgRefRight = useRef<HTMLDivElement>(null)

  const isDirtyLeft = leftContent !== originalLeft
  const isDirtyRight = rightContent !== originalRight
  const isDirty = isDirtyLeft || isDirtyRight

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true)
      try {
        const left = await window.api.readFile(`${leftDir}/${file}`) || ''
        const right = await window.api.readFile(`${rightDir}/${file}`) || ''
        setLeftContent(left)
        setRightContent(right)
        setOriginalLeft(left)
        setOriginalRight(right)
        setHistory([{ left, right }])
        setHistoryIndex(0)
      } catch (err) {
        console.error('Error loading files:', err)
      } finally {
        setLoading(false)
      }
    }
    loadFiles()
  }, [file, leftDir, rightDir])

  const pushHistory = useCallback((left: string, right: string) => {
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1)
      if (next.length > 0) {
        const last = next[next.length - 1]
        if (last.left === left && last.right === right) return prev
      }
      const newHistory = [...next, { left, right }].slice(-50)
      setHistoryIndex(newHistory.length - 1)
      return newHistory
    })
  }, [historyIndex])

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1]
      setLeftContent(prev.left)
      setRightContent(prev.right)
      setHistoryIndex(historyIndex - 1)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1]
      setLeftContent(next.left)
      setRightContent(next.right)
      setHistoryIndex(historyIndex + 1)
    }
  }

  const handleCopyLeftToRight = () => {
    setRightContent(leftContent)
    pushHistory(leftContent, leftContent)
  }

  const handleCopyRightToLeft = () => {
    setLeftContent(rightContent)
    pushHistory(rightContent, rightContent)
  }

  const handleSave = async () => {
    if (!isDirty) return
    let success = true
    if (isDirtyLeft) {
      const leftPath = `${leftDir}/${file}`
      success = await window.api.saveFile(leftPath, leftContent) && success
    }
    if (isDirtyRight) {
      const rightPath = `${rightDir}/${file}`
      success = await window.api.saveFile(rightPath, rightContent) && success
    }

    if (success) {
      setOriginalLeft(leftContent)
      setOriginalRight(rightContent)
      onRefresh()
    } else {
      alert('Failed to save file!')
    }
  }

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>, side: 'left' | 'right') => {
    const target = side === 'left' ? scrollRefRight : scrollRefLeft
    const bgTargetSelf = side === 'left' ? bgRefLeft : bgRefRight
    const bgTargetOther = side === 'left' ? bgRefRight : bgRefLeft

    if (target.current) {
      target.current.scrollTop = e.currentTarget.scrollTop
      target.current.scrollLeft = e.currentTarget.scrollLeft
    }
    if (bgTargetSelf.current) {
      bgTargetSelf.current.scrollTop = e.currentTarget.scrollTop
      bgTargetSelf.current.scrollLeft = e.currentTarget.scrollLeft
    }
    if (bgTargetOther.current) {
      bgTargetOther.current.scrollTop = e.currentTarget.scrollTop
      bgTargetOther.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const diffParts = useMemo(() => {
    const diff = Diff.diffLines(leftContent, rightContent)
    const leftRes: { type: string, value: string }[] = []
    const rightRes: { type: string, value: string }[] = []

    diff.forEach(part => {
      const lines = part.value.split('\n')
      // Remove last empty string from split if it exists (trailing newline)
      if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop()
      const value = lines.join('\n') + (part.value.endsWith('\n') ? '\n' : '')

      if (part.added) {
        rightRes.push({ type: 'added', value })
        const lineCount = lines.length
        leftRes.push({ type: 'padding', value: '\n'.repeat(lineCount) })
      } else if (part.removed) {
        leftRes.push({ type: 'removed', value })
        const lineCount = lines.length
        rightRes.push({ type: 'padding', value: '\n'.repeat(lineCount) })
      } else {
        leftRes.push({ type: 'unchanged', value })
        rightRes.push({ type: 'unchanged', value })
      }
    })
    return { leftRes, rightRes }
  }, [leftContent, rightContent])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (e.key === 'y') {
          e.preventDefault()
          redo()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          handleCopyLeftToRight()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          handleCopyRightToLeft()
        } else if (e.key === 's') {
          e.preventDefault()
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [leftContent, rightContent, historyIndex, history])

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div className="diff-view-container">
      <div className="diff-toolbar">
        <div className="toolbar-left">
          <button onClick={onBack} className="back-button" title="Back to Tree">
            <ArrowLeft size={16} />
          </button>
          <div className="file-info">
            <span className="file-name">{file}</span>
            {isDirty && <span className="dirty-indicator">● unsaved changes</span>}
          </div>
        </div>
        <div className="actions">
          <button onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)">
            <RotateCcw size={16} />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)">
            <RotateCw size={16} />
          </button>
          <div className="divider" />
          <button onClick={handleCopyRightToLeft} title="Copy All Right to Left (Ctrl+Left)">
            Copy Right to Left
          </button>
          <button onClick={handleCopyLeftToRight} title="Copy All Left to Right (Ctrl+Right)">
            Copy Left to Right
          </button>
          <div className="divider" />
          <button onClick={handleSave} disabled={!isDirty} className="save-button">
            <Save size={16} /> Save All
          </button>
        </div>
      </div>

      <div className="side-by-side-diff">
        <div className="pane left">
          <div className="pane-header">LEFT FILE {isDirtyLeft && '(MODIFIED)'}</div>
          <div className="editor-wrapper">
            <div className="diff-bg" ref={bgRefLeft}>
              {diffParts.leftRes.map((part, i) => (
                <div key={i} className={`diff-part ${part.type}`}>{part.value}</div>
              ))}
            </div>
            <textarea
              ref={scrollRefLeft}
              className="sync-editor"
              value={leftContent}
              onChange={(e) => {
                setLeftContent(e.target.value)
                pushHistory(e.target.value, rightContent)
              }}
              onScroll={(e) => syncScroll(e, 'left')}
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>
        
        <div className="pane right">
          <div className="pane-header">RIGHT FILE {isDirtyRight && '(MODIFIED)'}</div>
          <div className="editor-wrapper">
            <div className="diff-bg" ref={bgRefRight}>
              {diffParts.rightRes.map((part, i) => (
                <div key={i} className={`diff-part ${part.type}`}>{part.value}</div>
              ))}
            </div>
            <textarea
              ref={scrollRefRight}
              className="sync-editor"
              value={rightContent}
              onChange={(e) => {
                setRightContent(e.target.value)
                pushHistory(leftContent, e.target.value)
              }}
              onScroll={(e) => syncScroll(e, 'right')}
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>
      </div>

      <style>{`
        .diff-view-container { display: flex; flex-direction: column; height: 100%; background: #1e1e1e; color: #ccc; }
        .diff-toolbar { 
          display: flex; justify-content: space-between; padding: 8px 16px; background: #252526; 
          border-bottom: 1px solid #333; align-items: center;
        }
        .toolbar-left { display: flex; align-items: center; gap: 15px; }
        .back-button { background: transparent; border: none; color: #888; cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 4px; }
        .back-button:hover { background: #333; color: white; }
        .file-name { font-weight: 600; color: #ccc; font-family: sans-serif; }
        .dirty-indicator { margin-left: 10px; color: #f1c40f; font-size: 0.8rem; }
        
        .side-by-side-diff { flex: 1; display: flex; overflow: hidden; }
        .pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid #333; position: relative; }
        .pane-header { 
          padding: 6px 12px; background: #333; font-size: 0.7rem; color: #aaa; 
          border-bottom: 1px solid #444; font-family: sans-serif;
        }
        
        .editor-wrapper { flex: 1; position: relative; overflow: hidden; }
        .sync-editor {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          background: transparent; color: #ddd; border: none; resize: none; outline: none;
          padding: 10px 12px; margin: 0; font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px; line-height: 1.6; white-space: pre; overflow: auto;
          z-index: 2; caret-color: white;
        }
        .diff-bg {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          padding: 10px 12px; font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px; line-height: 1.6; white-space: pre; overflow: hidden;
          color: transparent; user-select: none; pointer-events: none; z-index: 1;
        }
        
        .diff-part.added { background: rgba(46, 204, 113, 0.2); }
        .diff-part.removed { background: rgba(231, 76, 60, 0.2); }
        .diff-part.padding { color: transparent; }
        
        .actions { display: flex; gap: 8px; align-items: center; }
        .divider { width: 1px; height: 20px; background: #444; margin: 0 4px; }
        .actions button { 
          padding: 4px 10px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; 
          border-radius: 4px; border: none; cursor: pointer; background: #333; color: #ccc;
        }
        .actions button:hover:not(:disabled) { background: #444; color: white; }
        .actions button:disabled { opacity: 0.3; cursor: not-allowed; }
        .save-button { background: #2ecc71 !important; color: white !important; }
        .save-button:hover:not(:disabled) { background: #27ae60 !important; }
        
        .loading-state { padding: 40px; text-align: center; color: #888; }
      `}</style>
    </div>
  )
}

export default DiffView
