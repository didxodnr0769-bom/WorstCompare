import React, { useState, useRef, useMemo, useEffect } from 'react'
import { ComparisonResult, Action } from '../electron.d'
import {
  File,
  FileText,
  ChevronRight,
  ChevronDown,
  Minus,
  Plus,
  ArrowRight,
  Trash2,
} from 'lucide-react'

interface DualTreeViewProps {
  results: ComparisonResult[]
  onFileSelect: (path: string) => void
  leftDir: string
  rightDir: string
  onRefresh: () => void
  selectedFilePath?: string | null
  expandedPaths: Set<string>
  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
  onAction?: (action: Action) => void
  onBusyChange?: (message: string | null) => void
}

interface TreeRow {
  path: string
  name: string
  depth: number
  isFile: boolean
  isExpanded: boolean
  status?: ComparisonResult['status']
  hasLeft: boolean
  hasRight: boolean
  folderStatus?: 'modified' | 'left-only' | 'right-only' | 'same'
}

const DualTreeView: React.FC<DualTreeViewProps> = ({
  results,
  onFileSelect,
  leftDir,
  rightDir,
  onRefresh,
  selectedFilePath,
  expandedPaths,
  setExpandedPaths,
  onAction,
  onBusyChange,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const scrollRefLeft = useRef<HTMLDivElement>(null)
  const scrollRefRight = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const selectedRowRef = useRef<HTMLDivElement>(null)
  // 복사/삭제가 진행되는 동안 중복 실행(더블클릭, 단축키)을 막는 동기 가드
  const busyRef = useRef(false)
  // 키보드 탐색(↑/↓)으로 선택이 바뀔 때만 스크롤하도록 하는 플래그.
  // 폴더 펼침/접힘으로 인한 선택 인덱스 재계산 시에는 스크롤하지 않는다.
  const navScrollRef = useRef(false)

  useEffect(() => {
    if (!navScrollRef.current) return
    navScrollRef.current = false
    selectedRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedIndex])

  useEffect(() => {
    if (results.length > 0 && treeRef.current) {
      treeRef.current.focus()
    }
  }, [results])

  const normalizedResults = useMemo(() => {
    return results.map(r => ({
      ...r,
      normalizedPath: r.path,
    }))
  }, [results])

  const rows = useMemo(() => {
    const rows: TreeRow[] = []
    const allPaths = new Set<string>()

    normalizedResults.forEach(r => {
      const parts = r.normalizedPath.split('/')
      let currentPath = ''
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        allPaths.add(currentPath)
      })
    })

    const sortedPaths = Array.from(allPaths).sort((a, b) => {
      const aParts = a.split('/')
      const bParts = b.split('/')
      for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
        if (aParts[i] !== bParts[i]) {
          const aPathSoFar = aParts.slice(0, i + 1).join('/')
          const bPathSoFar = bParts.slice(0, i + 1).join('/')
          const aIsFolder = !normalizedResults.some(r => r.normalizedPath === aPathSoFar)
          const bIsFolder = !normalizedResults.some(r => r.normalizedPath === bPathSoFar)
          if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1
          return aParts[i].localeCompare(bParts[i])
        }
      }
      return aParts.length - bParts.length
    })

    sortedPaths.forEach(path => {
      const parts = path.split('/')
      const depth = parts.length - 1

      if (depth > 0) {
        let currentAncestor = ''
        for (let i = 0; i < parts.length - 1; i++) {
          currentAncestor = currentAncestor ? `${currentAncestor}/${parts[i]}` : parts[i]
          if (!expandedPaths.has(currentAncestor)) return
        }
      }

      const fileResult = normalizedResults.find(r => r.normalizedPath === path)
      const isFile = !!fileResult

      let hasLeft: boolean
      let hasRight: boolean
      let status: ComparisonResult['status'] | undefined
      let folderStatus: TreeRow['folderStatus'] | undefined

      if (isFile) {
        hasLeft = fileResult.status !== 'right-only'
        hasRight = fileResult.status !== 'left-only'
        status = fileResult.status
      } else {
        const children = normalizedResults.filter(r => r.normalizedPath.startsWith(path + '/'))
        hasLeft = children.some(r => r.status !== 'right-only')
        hasRight = children.some(r => r.status !== 'left-only')

        const childStatuses = children.map(c => c.status)
        if (childStatuses.includes('modified')) folderStatus = 'modified'
        else if (childStatuses.includes('left-only') && childStatuses.includes('right-only'))
          folderStatus = 'modified'
        else if (childStatuses.includes('left-only')) folderStatus = 'left-only'
        else if (childStatuses.includes('right-only')) folderStatus = 'right-only'
        else folderStatus = 'same'
      }

      rows.push({
        path,
        name: parts[parts.length - 1],
        depth,
        isFile,
        isExpanded: expandedPaths.has(path),
        status,
        hasLeft,
        hasRight,
        folderStatus,
      })
    })

    return rows
  }, [normalizedResults, expandedPaths])

  const [prevRows, setPrevRows] = useState(rows)
  // 상세화면(Diff) 복귀 직후 '1회만' 직전에 열었던 파일로 선택을 복원했는지 여부.
  const [restored, setRestored] = useState(false)

  if (!restored && rows.length > 0) {
    // 최초 1회: 직전에 열었던 파일이 있으면 그 위치로, 없으면 첫 행으로 선택을 맞춘다.
    setRestored(true)
    setPrevRows(rows)
    if (selectedFilePath) {
      const index = rows.findIndex(row => row.path === selectedFilePath)
      setSelectedIndex(index !== -1 ? index : 0)
    } else if (selectedIndex === -1) {
      setSelectedIndex(0)
    }
  } else if (rows !== prevRows) {
    // 이후 rows 변경(폴더 펼침/접힘, 새로고침): 이전에 선택돼 있던 '경로'를 추적해 하이라이트만 유지한다.
    // 스크롤/포커스는 하지 않으므로 폴더를 열 때 특정 파일로 점프하지 않는다.
    const prevPath = prevRows[selectedIndex]?.path
    setPrevRows(rows)
    if (prevPath) {
      const nextIndex = rows.findIndex(row => row.path === prevPath)
      if (nextIndex !== selectedIndex) setSelectedIndex(nextIndex)
    }
  }

  // 상세화면 복귀 직후 '1회만' 직전에 열었던 파일을 화면 중앙으로 스크롤하고 트리에 포커스를 준다.
  // (이후 폴더 펼침/접힘에서는 동작하지 않는다.)
  const didRestoreScrollRef = useRef(false)
  useEffect(() => {
    if (didRestoreScrollRef.current || !restored || rows.length === 0) return
    didRestoreScrollRef.current = true
    if (selectedFilePath && rows.some(row => row.path === selectedFilePath)) {
      setTimeout(() => {
        selectedRowRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
        treeRef.current?.focus()
      }, 50)
    }
  }, [restored, rows, selectedFilePath])

  const toggleExpand = (path: string) => {
    const next = new Set(expandedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setExpandedPaths(next)
  }

  const syncScroll = (
    e: React.UIEvent<HTMLDivElement>,
    target: React.RefObject<HTMLDivElement | null>
  ) => {
    if (target.current) {
      target.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  const handleCopy = async (
    e: React.MouseEvent | null,
    row: TreeRow,
    direction: 'to-right' | 'to-left'
  ) => {
    e?.stopPropagation()
    if (busyRef.current) return
    busyRef.current = true
    // 버튼 클릭 즉시 "복사 중…" 오버레이를 띄워 사용자 입력을 막고 진행 상황을 알림
    onBusyChange?.('복사 중…')

    try {
      // 무거운 읽기/복사 작업 전에 오버레이가 먼저 화면에 그려지도록 한 프레임 양보
      await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))

      const src = direction === 'to-right' ? `${leftDir}/${row.path}` : `${rightDir}/${row.path}`
      const dest = direction === 'to-right' ? `${rightDir}/${row.path}` : `${leftDir}/${row.path}`

      let action: Action

      if (row.isFile) {
        const previousContent = await window.api.readFile(dest)
        action = {
          type: 'copy',
          side: direction === 'to-right' ? 'right' : 'left',
          path: row.path,
          previousStatus: row.status,
          previousContent: previousContent,
        }
      } else {
        // 폴더인 경우: 하위 파일들의 상태를 모두 기록
        const children = normalizedResults.filter(
          r => r.normalizedPath.startsWith(row.path + '/') && r.status !== 'same'
        )
        const subActions: Action[] = await Promise.all(
          children.map(async c => {
            const cDest =
              direction === 'to-right' ? `${rightDir}/${c.path}` : `${leftDir}/${c.path}`
            const prevContent = await window.api.readFile(cDest)
            return {
              type: 'copy',
              side: direction === 'to-right' ? 'right' : 'left',
              path: c.path,
              previousStatus: c.status,
              previousContent: prevContent,
            }
          })
        )
        action = {
          type: 'batch',
          side: direction === 'to-right' ? 'right' : 'left',
          path: row.path,
          subActions: subActions,
        }
      }

      const success = await window.api.copyItem(src, dest)
      if (success) {
        if (onAction) onAction(action)
        // 재비교(onRefresh)는 view='comparing' 오버레이로 이어지므로 깜빡임 없이 전환됨
        onRefresh()
      } else alert('복사 실패!')
    } finally {
      busyRef.current = false
      onBusyChange?.(null)
    }
  }

  const handleDelete = async (e: React.MouseEvent | null, row: TreeRow, side: 'left' | 'right') => {
    e?.stopPropagation()
    const confirmMsg = `${row.name}을(를) ${side === 'left' ? '왼쪽' : '오른쪽'}에서 삭제하시겠습니까?`
    // 오버레이는 confirm 이후에만 띄운다 (취소 시 오버레이가 남지 않도록)
    if (!confirm(confirmMsg)) return
    if (busyRef.current) return
    busyRef.current = true
    onBusyChange?.('삭제 중…')

    try {
      await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))

      const targetBase = side === 'left' ? leftDir : rightDir
      const target = `${targetBase}/${row.path}`

      let action: Action

      if (row.isFile) {
        const previousContent = await window.api.readFile(target)
        action = {
          type: 'delete',
          side: side,
          path: row.path,
          previousStatus: row.status,
          previousContent: previousContent,
        }
      } else {
        // 폴더 삭제인 경우
        const children = normalizedResults.filter(r => r.normalizedPath.startsWith(row.path + '/'))
        const subActions: Action[] = await Promise.all(
          children.map(async c => {
            const cTarget = side === 'left' ? `${leftDir}/${c.path}` : `${rightDir}/${c.path}`
            const prevContent = await window.api.readFile(cTarget)
            return {
              type: 'delete',
              side: side,
              path: c.path,
              previousStatus: c.status,
              previousContent: prevContent,
            }
          })
        )
        action = {
          type: 'batch',
          side: side,
          path: row.path,
          subActions: subActions,
        }
      }

      const success = await window.api.deleteItem(target)
      if (success) {
        if (onAction) onAction(action)
        onRefresh()
      } else alert('삭제 실패!')
    } finally {
      busyRef.current = false
      onBusyChange?.(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedIndex === -1 && rows.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        navScrollRef.current = true
        setSelectedIndex(0)
        return
      }
    }

    const row = rows[selectedIndex]
    if (!row) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      navScrollRef.current = true
      setSelectedIndex(prev => Math.min(prev + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      navScrollRef.current = true
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'ArrowRight') {
      if (!row.isFile && !row.isExpanded) {
        toggleExpand(row.path)
      } else if ((e.ctrlKey || e.metaKey) && row.hasLeft) {
        handleCopy(null, row, 'to-right')
      }
    } else if (e.key === 'ArrowLeft') {
      if (!row.isFile && row.isExpanded) {
        toggleExpand(row.path)
      } else if ((e.ctrlKey || e.metaKey) && row.hasRight) {
        handleCopy(null, row, 'to-left')
      }
    } else if (e.key === 'Enter') {
      if (row.isFile) {
        const exists = row.hasLeft || row.hasRight
        if (exists) onFileSelect(row.path)
      } else {
        toggleExpand(row.path)
      }
    }
  }

  const renderRow = (row: TreeRow, side: 'left' | 'right', index: number) => {
    const exists = side === 'left' ? row.hasLeft : row.hasRight
    const isSelected = selectedIndex === index

    return (
      <div
        key={row.path}
        ref={isSelected ? selectedRowRef : null}
        className={`tree-row ${exists ? 'exists' : 'missing'} ${row.status || ''} ${row.folderStatus || ''} ${row.isFile ? 'file' : 'folder'} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${row.depth * 20 + 10}px` }}
        onClick={() => {
          setSelectedIndex(index)
          if (!row.isFile && exists) toggleExpand(row.path)
        }}
        onDoubleClick={() => row.isFile && exists && onFileSelect(row.path)}
      >
        <div className="icon-wrapper">
          {exists ? (
            !row.isFile ? (
              <span className={`folder-icon status-${row.folderStatus}`}>
                {row.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : row.status === 'modified' ? (
              <FileText size={14} className="status-modified" />
            ) : row.status === 'left-only' ? (
              side === 'left' ? (
                <Plus size={14} className="status-left-only" />
              ) : (
                <div style={{ width: 14 }} />
              )
            ) : row.status === 'right-only' ? (
              side === 'right' ? (
                <Plus size={14} className="status-right-only" />
              ) : (
                <div style={{ width: 14 }} />
              )
            ) : (
              <File size={14} className="status-same" />
            )
          ) : (
            !row.isFile &&
            (row.folderStatus === 'modified' ? (
              <Minus size={14} className="status-modified" />
            ) : row.folderStatus === 'left-only' ? (
              side === 'left' ? (
                <Plus size={14} className="status-left-only" />
              ) : (
                <div style={{ width: 14 }} />
              )
            ) : row.folderStatus === 'right-only' ? (
              side === 'right' ? (
                <Plus size={14} className="status-right-only" />
              ) : (
                <div style={{ width: 14 }} />
              )
            ) : null)
          )}
        </div>
        <span className="row-name">
          {exists ? row.name : ''}
          {/* 폴더가 존재하는 쪽에서, 접혀 있을 때 상태를 폴더명 옆에 표시 (좌/우 동일하게 동작) */}
          {!row.isFile &&
            exists &&
            !row.isExpanded &&
            row.folderStatus &&
            row.folderStatus !== 'same' && (
              <span className={`folder-status-hint ${row.folderStatus}`}>
                (
                {row.folderStatus === 'modified'
                  ? '변경됨'
                  : row.folderStatus === 'left-only'
                    ? '왼쪽만'
                    : '오른쪽만'}
                )
              </span>
            )}
        </span>

        <div className="row-actions">
          {side === 'left' && row.hasLeft && row.status !== 'same' && (
            <button
              className="row-btn copy"
              onClick={e => handleCopy(e, row, 'to-right')}
              title="오른쪽으로 복사"
            >
              <ArrowRight size={12} />
            </button>
          )}
          {side === 'right' && row.hasRight && row.status !== 'same' && (
            <button
              className="row-btn copy"
              onClick={e => handleCopy(e, row, 'to-left')}
              title="왼쪽으로 복사"
            >
              <ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}
          {exists && (
            <button
              className="row-btn delete"
              onClick={e => handleDelete(e, row, side)}
              title="삭제"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    )
  }

  const getFolderName = (pathStr: string) => {
    const parts = pathStr.split(/[\\/]/).filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : pathStr
  }

  const leftFolderName = getFolderName(leftDir)
  const rightFolderName = getFolderName(rightDir)

  return (
    <div
      className="dual-tree-container"
      ref={treeRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      <div className="tree-pane-header">
        <div className="header-side" title={leftDir}>
          {leftFolderName} (왼쪽)
        </div>
        <div className="header-side" title={rightDir}>
          {rightFolderName} (오른쪽)
        </div>
      </div>

      <div className="tree-panes">
        <div
          className="pane left-pane"
          ref={scrollRefLeft}
          onScroll={e => syncScroll(e, scrollRefRight)}
        >
          {rows.map((row, i) => renderRow(row, 'left', i))}
        </div>

        <div
          className="pane right-pane"
          ref={scrollRefRight}
          onScroll={e => syncScroll(e, scrollRefLeft)}
        >
          {rows.map((row, i) => renderRow(row, 'right', i))}
        </div>
      </div>

      <style>{`
        .dual-tree-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 160px);
          background: var(--button-bg);
          border: 1px solid var(--border-color);
          border-radius: 4px;
        }
        .dual-tree-container:focus-within {
          border-color: #646cff;
        }
        .tree-pane-header {
          display: flex;
          background: var(--tree-pane-header-bg);
          border-bottom: 1px solid var(--border-color);
        }
        .header-side {
          flex: 1;
          padding: 8px 16px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--label-color);
        }
        .tree-panes {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .pane {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          border-right: 1px solid var(--border-color);
        }
        .pane::-webkit-scrollbar { width: 6px; }
        .pane::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
        
        .tree-row {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 28px;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          border-bottom: 1px solid transparent;
          position: relative;
        }
        .tree-row.exists:hover { background: var(--tree-row-hover); }
        .tree-row.selected { background: var(--tree-row-selected) !important; }
        .tree-row.missing { cursor: default; }
        
        .icon-wrapper { width: 16px; display: flex; align-items: center; justify-content: center; }
        .folder-icon.status-modified { color: var(--status-modified); }
        .folder-icon.status-left-only { color: var(--status-left-only); }
        .folder-icon.status-right-only { color: var(--status-right-only); }
        .row-name { color: var(--tree-row-text); flex: 1; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px; }
        
        .folder-status-hint { font-size: 0.7rem; opacity: 0.6; }
        .folder-status-hint.modified { color: var(--status-modified); }
        .folder-status-hint.left-only { color: var(--status-left-only); }
        .folder-status-hint.right-only { color: var(--status-right-only); }

        .row-actions {
          position: absolute;
          right: 8px;
          display: flex;
          gap: 4px;
          opacity: 0;
        }
        .tree-row:hover .row-actions { opacity: 1; }
        .tree-row.selected .row-actions { opacity: 1; }

        .row-btn {
          padding: 2px 4px;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .row-btn.copy { background: #646cff; }
        .row-btn.delete { background: var(--status-left-only); }
        .row-btn:hover { filter: brightness(1.2); }

        .status-modified { color: var(--status-modified); }
        .status-left-only { color: var(--status-left-only); }
        .status-right-only { color: var(--status-right-only); }
        .status-same { color: var(--status-same); }
        
        .tree-row.modified.exists { background: var(--diff-modified-bg); }
        .tree-row.left-only.exists { background: var(--diff-removed-bg); }
        .tree-row.right-only.exists { background: var(--diff-added-bg); }
      `}</style>
    </div>
  )
}

export default DualTreeView
