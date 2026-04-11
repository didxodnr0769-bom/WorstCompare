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

interface VisualLine {
  text: string
  type: 'added' | 'removed' | 'unchanged' | 'padding'
  hunkId: number
}

const LINE_HEIGHT = 21

const DiffView: React.FC<DiffViewProps> = ({ file, leftDir, rightDir, onBack, onRefresh }) => {
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [originalLeft, setOriginalLeft] = useState<string>('')
  const [originalRight, setOriginalRight] = useState<string>('')
  const [loading, setLoading] = useState(true)
  
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [currentHunkIndex, setCurrentHunkIndex] = useState(-1)

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
        const nLeft = normalize(left); const nRight = normalize(right)
        setLeftContent(nLeft); setRightContent(nRight)
        setOriginalLeft(nLeft); setOriginalRight(nRight)
        setHistory([{ left: nLeft, right: nRight }]); setHistoryIndex(0)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    loadFiles()
  }, [file, leftDir, rightDir])

  const pushHistory = useCallback((left: string, right: string) => {
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1)
      if (next.length > 0 && next[next.length - 1].left === left && next[next.length - 1].right === right) return prev
      const newH = [...next, { left, right }].slice(-50)
      setHistoryIndex(newH.length - 1); return newH
    })
  }, [historyIndex])

  const undo = () => { if (historyIndex > 0) { const p = history[historyIndex - 1]; setLeftContent(p.left); setRightContent(p.right); setHistoryIndex(historyIndex - 1) } }
  const redo = () => { if (historyIndex < history.length - 1) { const n = history[historyIndex + 1]; setLeftContent(n.left); setRightContent(n.right); setHistoryIndex(historyIndex + 1) } }

  const handleSave = async () => {
    if (!isDirty) return
    let s = true
    if (isDirtyLeft) s = await window.api.saveFile(`${leftDir}/${file}`, leftContent) && s
    if (isDirtyRight) s = await window.api.saveFile(`${rightDir}/${file}`, rightContent) && s
    if (s) { setOriginalLeft(leftContent); setOriginalRight(rightContent); onRefresh() }
    else alert('Save failed')
  }

  const hunks = useMemo(() => {
    const diff = Diff.diffLines(leftContent, rightContent)
    const result: Hunk[] = []
    let leftLine = 0; let rightLine = 0

    for (let i = 0; i < diff.length; i++) {
      const p = diff[i]; const next = diff[i+1]
      const split = (v: string) => {
        const lines = v.split('\n'); if (lines[lines.length-1] === '' && lines.length > 1) lines.pop(); return lines
      }

      if (p.removed && next && next.added) {
        const lL = split(p.value); const rL = split(next.value)
        const max = Math.max(lL.length, rL.length)
        result.push({ id: result.length, type: 'modified', leftValue: p.value, rightValue: next.value, leftLineStart: leftLine, rightLineStart: rightLine, lineCount: max })
        leftLine += lL.length; rightLine += rL.length; i++
      } else if (p.removed) {
        const lL = split(p.value)
        result.push({ id: result.length, type: 'removed', leftValue: p.value, rightValue: '', leftLineStart: leftLine, rightLineStart: rightLine, lineCount: lL.length })
        leftLine += lL.length
      } else if (p.added) {
        const rL = split(p.value)
        result.push({ id: result.length, type: 'added', leftValue: '', rightValue: p.value, leftLineStart: leftLine, rightLineStart: rightLine, lineCount: rL.length })
        rightLine += rL.length
      } else {
        const lL = split(p.value)
        result.push({ id: result.length, type: 'unchanged', leftValue: p.value, rightValue: p.value, leftLineStart: leftLine, rightLineStart: rightLine, lineCount: lL.length })
        leftLine += lL.length; rightLine += lL.length
      }
    }
    return result
  }, [leftContent, rightContent])

  const diffHunksOnly = useMemo(() => hunks.filter(h => h.type !== 'unchanged'), [hunks])

  const visualLines = useMemo(() => {
    const left: VisualLine[] = []; const right: VisualLine[] = []
    hunks.forEach(h => {
      const split = (v: string) => {
        const lines = v.split('\n'); if (lines[lines.length-1] === '' && lines.length > 1) lines.pop(); return lines
      }
      const lL = h.leftValue ? split(h.leftValue) : []; const rL = h.rightValue ? split(h.rightValue) : []
      
      for (let i = 0; i < h.lineCount; i++) {
        left.push({ 
          text: lL[i] || '', 
          type: i < lL.length ? (h.type === 'unchanged' ? 'unchanged' : 'removed') : 'padding', 
          hunkId: h.id 
        })
        right.push({ 
          text: rL[i] || '', 
          type: i < rL.length ? (h.type === 'unchanged' ? 'unchanged' : 'added') : 'padding', 
          hunkId: h.id 
        })
      }
    })
    return { left, right }
  }, [hunks])

  const applyHunk = useCallback((hunk: Hunk, dir: 'to-right' | 'to-left') => {
    const split = (v: string) => {
      const lines = v.split('\n'); if (lines[lines.length-1] === '' && lines.length > 1) lines.pop(); return lines
    }
    if (dir === 'to-right') {
      const lines = rightContent.split('\n')
      const val = hunk.leftValue.endsWith('\n') ? hunk.leftValue.slice(0, -1) : hunk.leftValue
      const rCount = split(hunk.rightValue).length || (hunk.rightValue === '' ? 0 : 1)
      const next = [...lines]; next.splice(hunk.rightLineStart, rCount, val)
      const nR = next.join('\n'); setRightContent(nR); pushHistory(leftContent, nR)
    } else {
      const lines = leftContent.split('\n')
      const val = hunk.rightValue.endsWith('\n') ? hunk.rightValue.slice(0, -1) : hunk.rightValue
      const lCount = split(hunk.leftValue).length || (hunk.leftValue === '' ? 0 : 1)
      const next = [...lines]; next.splice(hunk.leftLineStart, lCount, val)
      const nL = next.join('\n'); setLeftContent(nL); pushHistory(nL, rightContent)
    }
  }, [leftContent, rightContent, pushHistory])

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>, side: 'left' | 'right') => {
    const other = side === 'left' ? scrollRefRight : scrollRefLeft
    const bgS = side === 'left' ? bgRefLeft : bgRefRight; const bgO = side === 'left' ? bgRefRight : bgRefLeft
    const { scrollTop, scrollLeft } = e.currentTarget
    if (other.current) { other.current.scrollTop = scrollTop; other.current.scrollLeft = scrollLeft }
    if (bgS.current) { bgS.current.scrollTop = scrollTop; bgS.current.scrollLeft = scrollLeft }
    if (bgO.current) { bgO.current.scrollTop = scrollTop; bgO.current.scrollLeft = scrollLeft }
  }

  const scrollToHunk = useCallback((index: number) => {
    if (index < 0 || index >= diffHunksOnly.length) return
    const h = diffHunksOnly[index]; let vIdx = 0
    for (const item of hunks) { if (item === h) break; vIdx += item.lineCount }
    const top = vIdx * LINE_HEIGHT
    if (scrollRefLeft.current) scrollRefLeft.current.scrollTop = top
    if (scrollRefRight.current) scrollRefRight.current.scrollTop = top
  }, [hunks, diffHunksOnly])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
      else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault(); if (diffHunksOnly.length === 0) return
        let n = e.key === 'ArrowDown' ? currentHunkIndex + 1 : currentHunkIndex - 1
        if (n >= diffHunksOnly.length) n = 0; if (n < 0) n = diffHunksOnly.length - 1
        setCurrentHunkIndex(n); scrollToHunk(n)
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
        else if (e.key === 'y') { e.preventDefault(); redo() }
        else if (e.key === 's') { e.preventDefault(); handleSave() }
        else if (e.key === 'ArrowRight' && currentHunkIndex !== -1) { e.preventDefault(); applyHunk(diffHunksOnly[currentHunkIndex], 'to-right') }
        else if (e.key === 'ArrowLeft' && currentHunkIndex !== -1) { e.preventDefault(); applyHunk(diffHunksOnly[currentHunkIndex], 'to-left') }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [hunks, diffHunksOnly, currentHunkIndex, scrollToHunk, leftContent, rightContent, historyIndex, history, applyHunk])

  const renderBackground = (side: 'left' | 'right') => {
    const lines = side === 'left' ? visualLines.left : visualLines.right
    const selectedHunkId = diffHunksOnly[currentHunkIndex]?.id
    return (
      <div className="diff-lines-container">
        {lines.map((l, i) => (
          <div key={i} className={`diff-line-bg ${l.type} ${l.hunkId === selectedHunkId ? 'hunk-selected' : ''}`} style={{ height: LINE_HEIGHT }}>
            <span className="line-text-hidden">{l.text || '\u00A0'}</span>
            {l.type !== 'unchanged' && l.type !== 'padding' && i === visualLines[side].findIndex(x => x.hunkId === l.hunkId) && (
              <div className="hunk-actions-floating">
                <button className="hunk-btn-mini" onClick={() => applyHunk(hunks.find(h => h.id === l.hunkId)!, side === 'left' ? 'to-right' : 'to-left')}>
                  {side === 'left' ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  const totalVisualLines = visualLines.left.length
  const renderMinimap = () => (
    <div className="diff-minimap">
      {diffHunksOnly.map((h, i) => {
        let vIdx = 0; for (const item of hunks) { if (item === h) break; vIdx += item.lineCount }
        const top = (vIdx / totalVisualLines) * 100
        const height = (h.lineCount / totalVisualLines) * 100
        return (
          <div key={i} className={`minimap-marker ${h.type} ${i === currentHunkIndex ? 'active' : ''}`}
            style={{ top: `${top}%`, height: `${Math.max(height, 0.5)}%` }}
            onClick={() => { setCurrentHunkIndex(i); scrollToHunk(i) }} />
        )
      })}
    </div>
  )

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div className="diff-view-container">
      <div className="diff-toolbar">
        <div className="toolbar-left">
          <button onClick={onBack} className="back-button"><ArrowLeft size={16} /></button>
          <span className="file-name">{file} {isDirty && <span className="dirty-indicator">●</span>}</span>
        </div>
        <div className="hunk-nav">
          {diffHunksOnly.length > 0 ? (
            <div className="hunk-status">
              <span className="hunk-info">Change {currentHunkIndex + 1} of {diffHunksOnly.length}</span>
              <span className="hunk-hint">(Alt+↑/↓, Ctrl+←/→)</span>
            </div>
          ) : <span className="hunk-info">No differences</span>}
        </div>
        <div className="actions">
          <button onClick={() => { setRightContent(leftContent); pushHistory(leftContent, leftContent) }}><ArrowLeftRight size={14} /> Copy All</button>
          <div className="divider" />
          <button onClick={undo} disabled={historyIndex <= 0}><RotateCcw size={14} /></button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1}><RotateCw size={14} /></button>
          <button onClick={handleSave} disabled={!isDirty} className="save-btn">Save All</button>
        </div>
      </div>

      <div className="side-by-side-diff">
        <div className="pane left">
          <div className="pane-header">LEFT (SOURCE)</div>
          <div className="pane-content-wrapper">
            <div className="diff-bg" ref={bgRefLeft}>{renderBackground('left')}</div>
            <textarea ref={scrollRefLeft} className="sync-editor" value={leftContent} 
              onChange={e => { setLeftContent(e.target.value); pushHistory(e.target.value, rightContent) }}
              onScroll={e => syncScroll(e, 'left')} spellCheck={false} wrap="off" />
          </div>
        </div>
        <div className="pane right">
          <div className="pane-header">RIGHT (TARGET)</div>
          <div className="pane-content-wrapper">
            <div className="diff-bg" ref={bgRefRight}>{renderBackground('right')}</div>
            <textarea ref={scrollRefRight} className="sync-editor" value={rightContent}
              onChange={e => { setRightContent(e.target.value); pushHistory(leftContent, e.target.value) }}
              onScroll={e => syncScroll(e, 'right')} spellCheck={false} wrap="off" />
          </div>
        </div>
        {renderMinimap()}
      </div>

      <style>{`
        .diff-view-container { display: flex; flex-direction: column; height: 100%; background: #1e1e1e; color: #ccc; }
        .diff-toolbar { display: flex; justify-content: space-between; padding: 8px 16px; background: #252526; border-bottom: 1px solid #333; align-items: center; }
        .toolbar-left { display: flex; align-items: center; gap: 12px; }
        .file-name { font-family: sans-serif; font-size: 0.85rem; font-weight: 600; }
        .dirty-indicator { color: #f1c40f; margin-left: 4px; }
        .hunk-nav { display: flex; flex: 1; justify-content: center; }
        .hunk-status { display: flex; flex-direction: column; align-items: center; background: #333; padding: 2px 16px; border-radius: 20px; }
        .hunk-info { font-size: 0.75rem; color: #646cff; font-weight: 600; }
        .hunk-hint { font-size: 0.6rem; color: #888; }
        
        .side-by-side-diff { flex: 1; display: flex; overflow: hidden; position: relative; }
        .pane { flex: 1; display: flex; flex-direction: column; border-right: 1px solid #333; }
        .pane-header { padding: 4px 12px; background: #333; font-size: 0.65rem; color: #888; border-bottom: 1px solid #444; }
        
        .pane-content-wrapper { flex: 1; position: relative; overflow: hidden; padding: 10px 0; }
        .sync-editor, .diff-bg {
          position: absolute; top: 10px; left: 0; width: 100%; height: calc(100% - 20px);
          margin: 0; border: none; outline: none; padding: 0 12px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: ${LINE_HEIGHT}px;
          white-space: pre; tab-size: 4; box-sizing: border-box;
        }
        .sync-editor { background: transparent; color: #ddd; resize: none; z-index: 2; caret-color: white; overflow: auto; }
        .diff-bg { color: transparent; user-select: none; pointer-events: none; z-index: 1; overflow: hidden; }

        .diff-lines-container { display: flex; flex-direction: column; }
        .diff-line-bg { position: relative; width: 100%; display: block; }
        .diff-line-bg.removed { background: rgba(231, 76, 60, 0.25); }
        .diff-line-bg.added { background: rgba(46, 204, 113, 0.25); }
        .diff-line-bg.hunk-selected { background: rgba(100, 108, 255, 0.2); box-shadow: inset 0 1px 0 rgba(100,108,255,0.5), inset 0 -1px 0 rgba(100,108,255,0.5); }
        
        .hunk-actions-floating { position: absolute; right: 4px; top: 2px; z-index: 10; pointer-events: auto; }
        .hunk-btn-mini { background: #646cff; color: white; border: none; border-radius: 3px; padding: 2px; cursor: pointer; display: flex; opacity: 0.6; }
        .hunk-btn-mini:hover { opacity: 1; }
        
        .diff-minimap { width: 14px; background: #252526; border-left: 1px solid #333; position: relative; cursor: pointer; }
        .minimap-marker { position: absolute; left: 0; width: 100%; opacity: 0.6; }
        .minimap-marker.removed { background: #e74c3c; }
        .minimap-marker.added { background: #2ecc71; }
        .minimap-marker.modified { background: #f1c40f; }
        .minimap-marker.active { opacity: 1; box-shadow: 0 0 0 1px white inset; }

        .actions { display: flex; gap: 8px; align-items: center; padding-right: 10px; }
        .divider { width: 1px; height: 16px; background: #444; }
        .actions button { padding: 4px 8px; border: none; border-radius: 4px; background: #333; color: #ccc; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px; }
        .save-btn { background: #2ecc71 !important; color: white !important; }
        .loading-state { padding: 40px; text-align: center; }
      `}</style>
    </div>
  )
}

export default DiffView
