import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import * as Diff from 'diff'
import {
  ArrowLeft,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react'

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

  // 정렬된 행을 그리는 스크롤 컨테이너 (좌/우)
  const scrollRefLeft = useRef<HTMLDivElement>(null)
  const scrollRefRight = useRef<HTMLDivElement>(null)
  // hunk 적용 버튼 오버레이 (세로 스크롤에만 따라 움직이고 가로 스크롤과 무관하게 패널 우측 고정)
  const overlayInnerRefLeft = useRef<HTMLDivElement>(null)
  const overlayInnerRefRight = useRef<HTMLDivElement>(null)

  const isDirtyLeft = leftContent !== originalLeft
  const isDirtyRight = rightContent !== originalRight
  const isDirty = isDirtyLeft || isDirtyRight

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true)
      try {
        const left = (await window.api.readFile(`${leftDir}/${file}`)) || ''
        const right = (await window.api.readFile(`${rightDir}/${file}`)) || ''
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
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadFiles()
  }, [file, leftDir, rightDir])

  const pushHistory = useCallback(
    (left: string, right: string) => {
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1)
        if (
          next.length > 0 &&
          next[next.length - 1].left === left &&
          next[next.length - 1].right === right
        )
          return prev
        const newH = [...next, { left, right }].slice(-50)
        setHistoryIndex(newH.length - 1)
        return newH
      })
    },
    [historyIndex]
  )

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const p = history[historyIndex - 1]
      setLeftContent(p.left)
      setRightContent(p.right)
      setHistoryIndex(historyIndex - 1)
    }
  }, [historyIndex, history])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const n = history[historyIndex + 1]
      setLeftContent(n.left)
      setRightContent(n.right)
      setHistoryIndex(historyIndex + 1)
    }
  }, [historyIndex, history])

  const handleSave = useCallback(async () => {
    if (!isDirty) return
    let s = true
    if (isDirtyLeft) s = (await window.api.saveFile(`${leftDir}/${file}`, leftContent)) && s
    if (isDirtyRight) s = (await window.api.saveFile(`${rightDir}/${file}`, rightContent)) && s
    if (s) {
      setOriginalLeft(leftContent)
      setOriginalRight(rightContent)
      onRefresh()
    } else alert('저장 실패')
  }, [
    isDirty,
    isDirtyLeft,
    isDirtyRight,
    leftDir,
    rightDir,
    file,
    leftContent,
    rightContent,
    onRefresh,
  ])

  const hunks = useMemo(() => {
    const diff = Diff.diffLines(leftContent, rightContent)
    const result: Hunk[] = []
    let leftLine = 0
    let rightLine = 0

    for (let i = 0; i < diff.length; i++) {
      const p = diff[i]
      const next = diff[i + 1]
      const split = (v: string) => {
        const lines = v.split('\n')
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop()
        return lines
      }

      if (p.removed && next && next.added) {
        const lL = split(p.value)
        const rL = split(next.value)
        const max = Math.max(lL.length, rL.length)
        result.push({
          id: result.length,
          type: 'modified',
          leftValue: p.value,
          rightValue: next.value,
          leftLineStart: leftLine,
          rightLineStart: rightLine,
          lineCount: max,
        })
        leftLine += lL.length
        rightLine += rL.length
        i++
      } else if (p.removed) {
        const lL = split(p.value)
        result.push({
          id: result.length,
          type: 'removed',
          leftValue: p.value,
          rightValue: '',
          leftLineStart: leftLine,
          rightLineStart: rightLine,
          lineCount: lL.length,
        })
        leftLine += lL.length
      } else if (p.added) {
        const rL = split(p.value)
        result.push({
          id: result.length,
          type: 'added',
          leftValue: '',
          rightValue: p.value,
          leftLineStart: leftLine,
          rightLineStart: rightLine,
          lineCount: rL.length,
        })
        rightLine += rL.length
      } else {
        const lL = split(p.value)
        result.push({
          id: result.length,
          type: 'unchanged',
          leftValue: p.value,
          rightValue: p.value,
          leftLineStart: leftLine,
          rightLineStart: rightLine,
          lineCount: lL.length,
        })
        leftLine += lL.length
        rightLine += lL.length
      }
    }
    return result
  }, [leftContent, rightContent])

  const diffHunksOnly = useMemo(() => hunks.filter(h => h.type !== 'unchanged'), [hunks])

  // 각 hunk가 시작하는 시각적 행 인덱스(정렬된 행 좌표계). LINE_HEIGHT를 곱하면 픽셀 오프셋이 된다.
  const hunkOffsets = useMemo(() => {
    const map = new Map<number, number>()
    let visualRow = 0
    for (const h of hunks) {
      map.set(h.id, visualRow)
      visualRow += h.lineCount
    }
    return map
  }, [hunks])

  const visualLines = useMemo(() => {
    const left: VisualLine[] = []
    const right: VisualLine[] = []
    hunks.forEach(h => {
      const split = (v: string) => {
        const lines = v.split('\n')
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop()
        return lines
      }
      const lL = h.leftValue ? split(h.leftValue) : []
      const rL = h.rightValue ? split(h.rightValue) : []

      for (let i = 0; i < h.lineCount; i++) {
        left.push({
          text: lL[i] || '',
          type: i < lL.length ? (h.type === 'unchanged' ? 'unchanged' : 'removed') : 'padding',
          hunkId: h.id,
        })
        right.push({
          text: rL[i] || '',
          type: i < rL.length ? (h.type === 'unchanged' ? 'unchanged' : 'added') : 'padding',
          hunkId: h.id,
        })
      }
    })
    return { left, right }
  }, [hunks])

  const applyHunk = useCallback(
    (hunk: Hunk, dir: 'to-right' | 'to-left') => {
      const split = (v: string) => {
        const lines = v.split('\n')
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop()
        return lines
      }
      if (dir === 'to-right') {
        const lines = rightContent.split('\n')
        const val = hunk.leftValue.endsWith('\n') ? hunk.leftValue.slice(0, -1) : hunk.leftValue
        const rCount = split(hunk.rightValue).length || (hunk.rightValue === '' ? 0 : 1)
        const next = [...lines]
        next.splice(hunk.rightLineStart, rCount, val)
        const nR = next.join('\n')
        setRightContent(nR)
        pushHistory(leftContent, nR)
      } else {
        const lines = leftContent.split('\n')
        const val = hunk.rightValue.endsWith('\n') ? hunk.rightValue.slice(0, -1) : hunk.rightValue
        const lCount = split(hunk.leftValue).length || (hunk.leftValue === '' ? 0 : 1)
        const next = [...lines]
        next.splice(hunk.leftLineStart, lCount, val)
        const nL = next.join('\n')
        setLeftContent(nL)
        pushHistory(nL, rightContent)
      }
    },
    [leftContent, rightContent, pushHistory]
  )

  // hunk 버튼 오버레이를 현재 세로 스크롤 위치에 맞춰 이동시킨다.
  const syncOverlay = (scrollTop: number) => {
    const transform = `translateY(${-scrollTop}px)`
    if (overlayInnerRefLeft.current) overlayInnerRefLeft.current.style.transform = transform
    if (overlayInnerRefRight.current) overlayInnerRefRight.current.style.transform = transform
  }

  const syncScroll = (e: React.UIEvent<HTMLDivElement>, side: 'left' | 'right') => {
    const { scrollTop, scrollLeft } = e.currentTarget
    const other = side === 'left' ? scrollRefRight : scrollRefLeft
    if (other.current) {
      // 동일한 값으로 다시 쓰면 불필요한 scroll 이벤트가 재귀적으로 발생하므로 변경 시에만 반영
      if (other.current.scrollTop !== scrollTop) other.current.scrollTop = scrollTop
      if (other.current.scrollLeft !== scrollLeft) other.current.scrollLeft = scrollLeft
    }
    syncOverlay(scrollTop)
  }

  const scrollToHunk = useCallback(
    (index: number) => {
      if (index < 0 || index >= diffHunksOnly.length) return
      const h = diffHunksOnly[index]
      const top = (hunkOffsets.get(h.id) ?? 0) * LINE_HEIGHT
      if (scrollRefLeft.current) scrollRefLeft.current.scrollTop = top
      if (scrollRefRight.current) scrollRefRight.current.scrollTop = top
      syncOverlay(top)
    },
    [diffHunksOnly, hunkOffsets]
  )

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
      else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        if (diffHunksOnly.length === 0) return
        let n = e.key === 'ArrowDown' ? currentHunkIndex + 1 : currentHunkIndex - 1
        if (n >= diffHunksOnly.length) n = 0
        if (n < 0) n = diffHunksOnly.length - 1
        setCurrentHunkIndex(n)
        scrollToHunk(n)
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (e.key === 'y') {
          e.preventDefault()
          redo()
        } else if (e.key === 's') {
          e.preventDefault()
          handleSave()
        } else if (e.key === 'ArrowRight' && currentHunkIndex !== -1) {
          e.preventDefault()
          applyHunk(diffHunksOnly[currentHunkIndex], 'to-right')
        } else if (e.key === 'ArrowLeft' && currentHunkIndex !== -1) {
          e.preventDefault()
          applyHunk(diffHunksOnly[currentHunkIndex], 'to-left')
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onBack, handleSave, redo, undo, diffHunksOnly, currentHunkIndex, scrollToHunk, applyHunk])

  // 정렬된 행을 직접 렌더링한다. padding 행은 빈 gap 행으로 그려져 양쪽 동일 라인이 같은 높이에 위치한다.
  const renderRows = (side: 'left' | 'right') => {
    const lines = side === 'left' ? visualLines.left : visualLines.right
    const selectedHunkId = diffHunksOnly[currentHunkIndex]?.id
    return lines.map((l, i) => (
      <div
        key={i}
        className={`diff-row ${l.type} ${l.hunkId === selectedHunkId ? 'hunk-selected' : ''}`}
        onClick={() => {
          if (l.type === 'padding' || l.type === 'unchanged') return
          const idx = diffHunksOnly.findIndex(h => h.id === l.hunkId)
          if (idx !== -1) setCurrentHunkIndex(idx)
        }}
      >
        {l.type === 'padding' ? '' : l.text === '' ? '\u00A0' : l.text}
      </div>
    ))
  }

  // 가로 스크롤과 무관하게 패널 우측에 고정되는 hunk 적용 버튼들 (세로 위치는 hunk 시작 행에 맞춤)
  const renderHunkButtons = (side: 'left' | 'right') =>
    diffHunksOnly.map(h => {
      const visible =
        side === 'left'
          ? h.type === 'removed' || h.type === 'modified'
          : h.type === 'added' || h.type === 'modified'
      if (!visible) return null
      const top = (hunkOffsets.get(h.id) ?? 0) * LINE_HEIGHT
      return (
        <button
          key={h.id}
          className="hunk-btn-mini"
          style={{ top: top + 2 }}
          title={side === 'left' ? '오른쪽으로 적용' : '왼쪽으로 적용'}
          onClick={() => applyHunk(h, side === 'left' ? 'to-right' : 'to-left')}
        >
          {side === 'left' ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )
    })

  const totalVisualLines = visualLines.left.length
  const renderMinimap = () => (
    <div className="diff-minimap">
      {diffHunksOnly.map((h, i) => {
        const vIdx = hunkOffsets.get(h.id) ?? 0
        const top = (vIdx / totalVisualLines) * 100
        const height = (h.lineCount / totalVisualLines) * 100
        return (
          <div
            key={i}
            className={`minimap-marker ${h.type} ${i === currentHunkIndex ? 'active' : ''}`}
            style={{ top: `${top}%`, height: `${Math.max(height, 0.5)}%` }}
            onClick={() => {
              setCurrentHunkIndex(i)
              scrollToHunk(i)
            }}
          />
        )
      })}
    </div>
  )

  const getFolderName = (pathStr: string) => {
    const parts = pathStr.split(/[\\/]/).filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : pathStr
  }

  const leftFolderName = getFolderName(leftDir)
  const rightFolderName = getFolderName(rightDir)

  if (loading) return <div className="loading-state">불러오는 중…</div>

  return (
    <div className="diff-view-container">
      <div className="diff-toolbar">
        <div className="toolbar-left">
          <button onClick={onBack} className="back-button">
            <ArrowLeft size={16} />
          </button>
          <span className="file-name">
            {file} {isDirty && <span className="dirty-indicator">●</span>}
          </span>
        </div>
        <div className="hunk-nav">
          {diffHunksOnly.length > 0 ? (
            <div className="hunk-status">
              <span className="hunk-info">
                변경 {currentHunkIndex + 1} / {diffHunksOnly.length}
              </span>
              <span className="hunk-hint">(Alt+↑/↓, Ctrl+←/→)</span>
            </div>
          ) : (
            <span className="hunk-info">변경 사항 없음</span>
          )}
        </div>
        <div className="actions">
          <button
            onClick={() => {
              setRightContent(leftContent)
              pushHistory(leftContent, leftContent)
            }}
          >
            <ArrowLeftRight size={14} /> 전체 복사
          </button>
          <div className="divider" />
          <button onClick={undo} disabled={historyIndex <= 0}>
            <RotateCcw size={14} />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1}>
            <RotateCw size={14} />
          </button>
          <button onClick={handleSave} disabled={!isDirty} className="save-btn">
            전체 저장
          </button>
        </div>
      </div>

      <div className="side-by-side-diff">
        <div className="pane left">
          <div className="pane-header" title={leftDir}>
            {leftFolderName} (LEFT)
          </div>
          <div className="pane-body">
            <div className="pane-scroll" ref={scrollRefLeft} onScroll={e => syncScroll(e, 'left')}>
              <div className="diff-rows">{renderRows('left')}</div>
            </div>
            <div className="hunk-overlay">
              <div className="hunk-overlay-inner" ref={overlayInnerRefLeft}>
                {renderHunkButtons('left')}
              </div>
            </div>
          </div>
        </div>
        <div className="pane right">
          <div className="pane-header" title={rightDir}>
            {rightFolderName} (RIGHT)
          </div>
          <div className="pane-body">
            <div
              className="pane-scroll"
              ref={scrollRefRight}
              onScroll={e => syncScroll(e, 'right')}
            >
              <div className="diff-rows">{renderRows('right')}</div>
            </div>
            <div className="hunk-overlay">
              <div className="hunk-overlay-inner" ref={overlayInnerRefRight}>
                {renderHunkButtons('right')}
              </div>
            </div>
          </div>
        </div>
        {renderMinimap()}
      </div>

      <style>{`
        .diff-view-container { display: flex; flex-direction: column; height: 100%; background: var(--bg-color); color: var(--text-color); }
        .diff-toolbar { display: flex; justify-content: space-between; padding: 8px 16px; background: var(--header-bg); border-bottom: 1px solid var(--border-color); align-items: center; }
        .toolbar-left { display: flex; align-items: center; gap: 12px; }
        .file-name { font-family: sans-serif; font-size: 0.85rem; font-weight: 600; color: var(--text-color); }
        .dirty-indicator { color: var(--status-modified); margin-left: 4px; }
        .hunk-nav { display: flex; flex: 1; justify-content: center; }
        .hunk-status { display: flex; flex-direction: column; align-items: center; background: var(--secondary-button-bg); padding: 2px 16px; border-radius: 20px; border: 1px solid var(--border-color); }
        .hunk-info { font-size: 0.75rem; color: #646cff; font-weight: 600; }
        .hunk-hint { font-size: 0.6rem; color: var(--label-color); }
        
        .side-by-side-diff { flex: 1; display: flex; overflow: hidden; position: relative; }
        .pane { flex: 1; display: flex; flex-direction: column; border-right: 1px solid var(--border-color); min-width: 0; }
        .pane-header { padding: 4px 12px; background: var(--tree-pane-header-bg); font-size: 0.65rem; color: var(--label-color); border-bottom: 1px solid var(--border-color); }

        /* 정렬된 행을 그리는 단일 레이어. padding(gap) 행이 실제 높이를 차지하여 좌/우 동일 라인이 같은 높이에 온다. */
        .pane-body { flex: 1; position: relative; overflow: hidden; }
        .pane-scroll { position: absolute; inset: 0; overflow: auto; }
        .pane-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .pane-scroll::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 5px; }
        .diff-rows {
          display: inline-block; min-width: 100%;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: ${LINE_HEIGHT}px;
        }
        .diff-row {
          height: ${LINE_HEIGHT}px; padding: 0 12px; white-space: pre; tab-size: 4;
          box-sizing: border-box; color: var(--text-color); cursor: default;
        }
        .diff-row.removed { background: var(--diff-removed-bg); }
        .diff-row.added { background: var(--diff-added-bg); }
        .diff-row.padding {
          background-image: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(128,128,128,0.07) 5px, rgba(128,128,128,0.07) 10px);
          user-select: none;
        }
        .diff-row.hunk-selected {
          background-color: rgba(100, 108, 255, 0.18);
          box-shadow: inset 0 1px 0 rgba(100,108,255,0.45), inset 0 -1px 0 rgba(100,108,255,0.45);
        }

        /* hunk 적용 버튼 오버레이: 가로 스크롤과 무관하게 패널 우측 고정, 세로로만 스크롤 추종 */
        .hunk-overlay { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .hunk-overlay-inner { position: absolute; top: 0; left: 0; right: 0; will-change: transform; }
        .hunk-btn-mini {
          position: absolute; right: 8px;
          background: #646cff; color: white; border: none; border-radius: 3px; padding: 2px;
          cursor: pointer; display: flex; opacity: 0.7; pointer-events: auto; z-index: 10;
        }
        .hunk-btn-mini:hover { opacity: 1; }
        
        .diff-minimap { width: 14px; background: var(--header-bg); border-left: 1px solid var(--border-color); position: relative; cursor: pointer; }
        .minimap-marker { position: absolute; left: 0; width: 100%; opacity: 0.6; }
        .minimap-marker.removed { background: var(--status-left-only); }
        .minimap-marker.added { background: var(--status-right-only); }
        .minimap-marker.modified { background: var(--status-modified); }
        .minimap-marker.active { opacity: 1; box-shadow: 0 0 0 1px var(--text-color) inset; }

        .actions { display: flex; gap: 8px; align-items: center; padding-right: 10px; }
        .divider { width: 1px; height: 16px; background: var(--border-color); }
        .actions button { padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--secondary-button-bg); color: var(--secondary-button-text); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px; }
        .actions button:disabled { opacity: 0.5; cursor: not-allowed; }
        .save-btn { background: var(--status-right-only) !important; color: white !important; border: none !important; }
        .loading-state { padding: 40px; text-align: center; color: var(--text-color); }
      `}</style>
    </div>
  )
}

export default DiffView
