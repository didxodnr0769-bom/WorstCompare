import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import * as Diff from 'diff'
import { Save, ArrowLeft, RotateCcw, RotateCw, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react'

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

interface Hunk {
  id: number
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  leftValue: string
  rightValue: string
  leftLineStart: number
  rightLineStart: number
  lineCount: number
}

const DiffView: React.FC<DiffViewProps> = ({ file, leftDir, rightDir, onBack, onRefresh }) => {
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [originalLeft, setOriginalLeft] = useState<string>('')
  const [originalRight, setOriginalRight] = useState<string>('')
  const [loading, setLoading] = useState(true)
  
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [currentHunkIndex, setCurrentHunkIndex] = useState(-1) // Index of diff-only hunks

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
        const normalize = (txt: string) => txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const nLeft = normalize(left)
        const nRight = normalize(right)
        setLeftContent(nLeft)
        setRightContent(nRight)
        setOriginalLeft(nLeft)
        setOriginalRight(nRight)
        setHistory([{ left: nLeft, right: nRight }])
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
      setLeftContent(prev.left); setRightContent(prev.right)
      setHistoryIndex(historyIndex - 1)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1]
      setLeftContent(next.left); setRightContent(next.right)
      setHistoryIndex(historyIndex + 1)
    }
  }

  const handleSave = async () => {
    if (!isDirty) return
    let success = true
    if (isDirtyLeft) success = await window.api.saveFile(`${leftDir}/${file}`, leftContent) && success
    if (isDirtyRight) success = await window.api.saveFile(`${rightDir}/${file}`, rightContent) && success
    if (success) { setOriginalLeft(leftContent); setOriginalRight(rightContent); onRefresh(); }
    else alert('Failed to save file!')
  }

  const hunks = useMemo(() => {
    const diff = Diff.diffLines(leftContent, rightContent)
    const result: Hunk[] = []
    let leftLine = 0
    let rightLine = 0

    for (let i = 0; i < diff.length; i++) {
      const part = diff[i]
      const next = diff[i+1]

      if (part.removed && next && next.added) {
        const leftL = part.value.split('\n'); if (leftL[leftL.length-1] === '' && leftL.length > 1) leftL.pop()
        const rightL = next.value.split('\n'); if (rightL[rightL.length-1] === '' && rightL.length > 1) rightL.pop()
        const max = Math.max(leftL.length, rightL.length)
        result.push({ id: result.length, type: 'modified', leftValue: part.value, rightValue: next.value, leftLineStart: leftLine, rightLineStart: rightLine, lineCount: max })
        leftLine += leftL.length; rightLine += rightL.length; i++
      } else if (part.removed) {
        const lines = part.value.split('\n'); if (lines[lines.length-1] === '' && lines.length > 1) lines.pop()
        result.push({ id: result.length, type: 'removed', leftValue: part.value, rightValue: '', leftLineStart: leftLine, rightLineStart: rightLine, lineCount: lines.length })
        leftLine += lines.length
      } else if (part.added) {
        const lines = part.value.split('\n'); if (lines[lines.length-1] === '' && lines.length > 1) lines.pop()
        result.push({ id: result.length, type: 'added', leftValue: '', rightValue: part.value, leftLineStart: leftLine, rightLineStart: rightLine, lineCount: lines.length })
        rightLine += lines.length
      } else {
        const lines = part.value.split('\n'); if (lines[lines.length-1] === '' && lines.length > 1) lines.pop()
        result.push({ id: result.length, type: 'unchanged', leftValue: part.value, rightValue: part.value, leftLineStart: leftLine, rightLineStart: rightLine, lineCount: lines.length })
        leftLine += lines.length; rightLine += lines.length
      }
    }
    return result
  }, [leftContent, rightContent])

  const diffHunksOnly = useMemo(() => hunks.filter(h => h.type !== 'unchanged'), [hunks])

  const applyHunk = useCallback((hunk: Hunk, direction: 'to-right' | 'to-left') => {
    if (direction === 'to-right') {
      const lines = rightContent.split('\n')
      const leftVal = hunk.leftValue.endsWith('\n') ? hunk.leftValue.slice(0, -1) : hunk.leftValue
      const rightLinesCount = hunk.rightValue.split('\n').filter((l, i, a) => i < a.length - 1 || l !== '').length || (hunk.rightValue === '' ? 0 : 1)
      const newLines = [...lines]; newLines.splice(hunk.rightLineStart, rightLinesCount, leftVal)
      const nextRight = newLines.join('\n'); setRightContent(nextRight); pushHistory(leftContent, nextRight)
    } else {
      const lines = leftContent.split('\n')
      const rightVal = hunk.rightValue.endsWith('\n') ? hunk.rightValue.slice(0, -1) : hunk.rightValue
      const leftLinesCount = hunk.leftValue.split('\n').filter((l, i, a) => i < a.length - 1 || l !== '').length || (hunk.leftValue === '' ? 0 : 1)
      const newLines = [...lines]; newLines.splice(hunk.leftLineStart, leftLinesCount, rightVal)
      const nextLeft = newLines.join('\n'); setLeftContent(nextLeft); pushHistory(nextLeft, rightContent)
    }
  }, [leftContent, rightContent, pushHistory])

  const handleCopyAll = (direction: 'to-right' | 'to-left') => {
    if (direction === 'to-right') { setRightContent(leftContent); pushHistory(leftContent, leftContent); }
    else { setLeftContent(rightContent); pushHistory(rightContent, rightContent); }
  }

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>, side: 'left' | 'right') => {
    const other = side === 'left' ? scrollRefRight : scrollRefLeft
    const bgSelf = side === 'left' ? bgRefLeft : bgRefRight
    const bgOther = side === 'left' ? bgRefRight : bgRefLeft
    const { scrollTop, scrollLeft } = e.currentTarget
    if (other.current) { other.current.scrollTop = scrollTop; other.current.scrollLeft = scrollLeft; }
    if (bgSelf.current) { bgSelf.current.scrollTop = scrollTop; bgSelf.current.scrollLeft = scrollLeft; }
    if (bgOther.current) { bgOther.current.scrollTop = scrollTop; bgOther.current.scrollLeft = scrollLeft; }
  }

  const scrollToHunk = useCallback((index: number) => {
    if (index < 0 || index >= diffHunksOnly.length) return
    const hunk = diffHunksOnly[index]
    let visualLineIndex = 0
    for (const h of hunks) { if (h === hunk) break; visualLineIndex += h.lineCount; }
    const scrollTop = visualLineIndex * 21
    if (scrollRefLeft.current) scrollRefLeft.current.scrollTo({ top: scrollTop, behavior: 'smooth' })
  }, [hunks, diffHunksOnly])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
      else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        if (diffHunksOnly.length === 0) return
        let next = e.key === 'ArrowDown' ? currentHunkIndex + 1 : currentHunkIndex - 1
        if (next >= diffHunksOnly.length) next = 0
        if (next < 0) next = diffHunksOnly.length - 1
        setCurrentHunkIndex(next); scrollToHunk(next)
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        else if (e.key === 'y') { e.preventDefault(); redo(); }
        else if (e.key === 's') { e.preventDefault(); handleSave(); }
        else if (e.key === 'ArrowRight' && currentHunkIndex !== -1) { e.preventDefault(); applyHunk(diffHunksOnly[currentHunkIndex], 'to-right'); }
        else if (e.key === 'ArrowLeft' && currentHunkIndex !== -1) { e.preventDefault(); applyHunk(diffHunksOnly[currentHunkIndex], 'to-left'); }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [hunks, diffHunksOnly, currentHunkIndex, scrollToHunk, leftContent, rightContent, historyIndex, history, applyHunk])

  const renderDiffBackground = (side: 'left' | 'right') => {
    return hunks.map((hunk, i) => {
      const isLeft = side === 'left'
      const content = isLeft ? hunk.leftValue : hunk.rightValue
      const lines = content.split('\n'); if (lines[lines.length-1] === '' && lines.length > 1) lines.pop()
      const type = hunk.type === 'unchanged' ? 'unchanged' : hunk.type === 'modified' ? (isLeft ? 'removed' : 'added') : hunk.type
      const isSelected = diffHunksOnly[currentHunkIndex] === hunk

      return (
        <div key={i} className={`diff-hunk-group ${type} ${isSelected ? 'selected' : ''}`} onClick={() => {
          const idx = diffHunksOnly.indexOf(hunk); if (idx !== -1) setCurrentHunkIndex(idx)
        }}>
          {lines.map((line, li) => <div key={li} className="diff-line-bg">{line || ' '}</div>)}
          {lines.length < hunk.lineCount && <div className="diff-line-bg padding" style={{ height: (hunk.lineCount - lines.length) * 21 }} />}
          {hunk.type !== 'unchanged' && (
            <div className="hunk-actions">
              {isLeft ? (
                <button className="hunk-btn" onClick={(e) => { e.stopPropagation(); applyHunk(hunk, 'to-right'); }} title="Apply Hunk to Right (Ctrl+→)"><ChevronRight size={14} /></button>
              ) : (
                <button className="hunk-btn" onClick={(e) => { e.stopPropagation(); applyHunk(hunk, 'to-left'); }} title="Apply Hunk to Left (Ctrl+←)"><ChevronLeft size={14} /></button>
              )}
            </div>
          )}
        </div>
      )
    })
  }

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div className="diff-view-container">
      <div className="diff-toolbar">
        <div className="toolbar-left">
          <button onClick={onBack} className="back-button" title="Back (Esc)"><ArrowLeft size={16} /></button>
          <span className="file-name">{file} {isDirty && <span className="dirty-indicator">●</span>}</span>
        </div>
        <div className="hunk-nav">
          {diffHunksOnly.length > 0 ? (
            <div className="hunk-status">
              <span className="hunk-info">Change {currentHunkIndex + 1} of {diffHunksOnly.length}</span>
              <span className="hunk-hint">(Alt+↑/↓ to Navigate, Ctrl+←/→ to Apply)</span>
            </div>
          ) : <span>No differences</span>}
        </div>
        <div className="actions">
          <button onClick={() => handleCopyAll('to-right')} title="Copy Entire Left to Right"><ArrowLeftRight size={14} /> Copy All</button>
          <div className="divider" />
          <button onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)"><RotateCcw size={14} /></button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)"><RotateCw size={14} /></button>
          <button onClick={handleSave} disabled={!isDirty} className="save-btn" title="Save All (Ctrl+S)">Save All</button>
        </div>
      </div>

      <div className="side-by-side-diff">
        <div className="pane left">
          <div className="pane-header">LEFT (SOURCE)</div>
          <div className="editor-wrapper">
            <div className="diff-bg" ref={bgRefLeft}>{renderDiffBackground('left')}</div>
            <textarea ref={scrollRefLeft} className="sync-editor" value={leftContent} 
              onChange={e => { setLeftContent(e.target.value); pushHistory(e.target.value, rightContent); }}
              onScroll={e => syncScroll(e, 'left')} spellCheck={false} wrap="off" />
          </div>
        </div>
        <div className="pane right">
          <div className="pane-header">RIGHT (TARGET)</div>
          <div className="editor-wrapper">
            <div className="diff-bg" ref={bgRefRight}>{renderDiffBackground('right')}</div>
            <textarea ref={scrollRefRight} className="sync-editor" value={rightContent}
              onChange={e => { setRightContent(e.target.value); pushHistory(leftContent, e.target.value); }}
              onScroll={e => syncScroll(e, 'right')} spellCheck={false} wrap="off" />
          </div>
        </div>
      </div>

      <style>{`
        .diff-view-container { display: flex; flex-direction: column; height: 100%; background: #1e1e1e; color: #ccc; }
        .diff-toolbar { display: flex; justify-content: space-between; padding: 8px 16px; background: #252526; border-bottom: 1px solid #333; align-items: center; min-height: 48px; }
        .toolbar-left { display: flex; align-items: center; gap: 12px; }
        .file-name { font-family: sans-serif; font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }
        .dirty-indicator { color: #f1c40f; margin-left: 4px; }
        .hunk-nav { display: flex; flex: 1; justify-content: center; }
        .hunk-status { display: flex; flex-direction: column; align-items: center; background: #333; padding: 2px 16px; border-radius: 20px; border: 1px solid #444; }
        .hunk-info { font-size: 0.75rem; color: #646cff; font-weight: 600; }
        .hunk-hint { font-size: 0.6rem; color: #888; margin-top: 1px; }
        
        .side-by-side-diff { flex: 1; display: flex; overflow: hidden; }
        .pane { flex: 1; display: flex; flex-direction: column; border-right: 1px solid #333; position: relative; }
        .pane-header { padding: 4px 12px; background: #333; font-size: 0.65rem; color: #888; border-bottom: 1px solid #444; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .editor-wrapper { flex: 1; position: relative; overflow: hidden; }
        .sync-editor, .diff-bg {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          padding: 10px 12px; margin: 0;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 21px;
          white-space: pre; tab-size: 4; letter-spacing: normal; word-spacing: normal;
        }
        .sync-editor { background: transparent; color: #ddd; border: none; resize: none; outline: none; z-index: 2; caret-color: white; overflow: auto; }
        .diff-bg { color: transparent; user-select: none; pointer-events: none; z-index: 1; overflow: hidden; }

        .diff-hunk-group { position: relative; cursor: pointer; border: 1px solid transparent; }
        .diff-hunk-group.removed { background: rgba(231, 76, 60, 0.2); }
        .diff-hunk-group.added { background: rgba(46, 204, 113, 0.2); }
        .diff-hunk-group.selected { border: 1px solid #646cff; background: rgba(100, 108, 255, 0.15); }
        .diff-line-bg { height: 21px; }
        
        .hunk-actions { position: absolute; right: 4px; top: 2px; z-index: 10; pointer-events: auto; }
        .hunk-btn { 
          background: #646cff; color: white; border: none; border-radius: 4px; 
          padding: 2px; cursor: pointer; display: flex; opacity: 0; transition: opacity 0.2s;
        }
        .diff-hunk-group:hover .hunk-btn, .diff-hunk-group.selected .hunk-btn { opacity: 1; }
        
        .actions { display: flex; gap: 8px; align-items: center; }
        .divider { width: 1px; height: 16px; background: #444; margin: 0 4px; }
        .actions button { padding: 4px 8px; border: none; border-radius: 4px; background: #333; color: #ccc; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px; }
        .actions button:hover:not(:disabled) { background: #444; color: white; }
        .actions button:disabled { opacity: 0.3; cursor: not-allowed; }
        .save-btn { background: #2ecc71 !important; color: white !important; }
        .loading-state { padding: 40px; text-align: center; }
      `}</style>
    </div>
  )
}

export default DiffView
