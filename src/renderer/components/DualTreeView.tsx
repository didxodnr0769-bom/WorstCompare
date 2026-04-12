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
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const scrollRefLeft = useRef<HTMLDivElement>(null)
  const scrollRefRight = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const selectedRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  useEffect(() => {
    if (results.length > 0 && treeRef.current) {
      treeRef.current.focus()
    }
  }, [results])

  const normalizedResults = useMemo(() => {
    return results.map(r => ({
      ...r,
      normalizedPath: r.path.replace(/\\/g, '/'),
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
  const [prevSelectedFilePath, setPrevSelectedFilePath] = useState(selectedFilePath)

  if (rows !== prevRows || selectedFilePath !== prevSelectedFilePath) {
    setPrevRows(rows)
    setPrevSelectedFilePath(selectedFilePath)
    if (rows.length > 0) {
      if (selectedFilePath) {
        const index = rows.findIndex(row => row.path === selectedFilePath)
        if (index !== -1 && index !== selectedIndex) {
          setSelectedIndex(index)
        }
      } else if (selectedIndex === -1) {
        setSelectedIndex(0)
      }
    }
  }

  useEffect(() => {
    if (rows.length > 0 && selectedFilePath) {
      const index = rows.findIndex(row => row.path === selectedFilePath)
      if (index !== -1) {
        setTimeout(() => {
          if (selectedRowRef.current) {
            selectedRowRef.current.scrollIntoView({ block: 'center', behavior: 'auto' })
          }
          if (treeRef.current) treeRef.current.focus()
        }, 50)
      }
    }
  }, [rows, selectedFilePath])

  const toggleExpand = (path: string) => {
    const next = new Set(expandedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setExpandedPaths(next)
  }

  const syncScroll = (
    e: React.UIEvent<HTMLDivElement>,
    target: React.RefObject<HTMLDivElement>
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
      const subActions = await Promise.all(
        children.map(async c => {
          const cDest = direction === 'to-right' ? `${rightDir}/${c.path}` : `${leftDir}/${c.path}`
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
      onRefresh()
    } else alert('Copy failed!')
  }

  const handleDelete = async (e: React.MouseEvent | null, row: TreeRow, side: 'left' | 'right') => {
    e?.stopPropagation()
    const confirmMsg = `Are you sure you want to delete ${row.name} from the ${side} side?`
    if (!confirm(confirmMsg)) return

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
      const subActions = await Promise.all(
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
    } else alert('Delete failed!')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedIndex === -1 && rows.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setSelectedIndex(0)
        return
      }
    }

    const row = rows[selectedIndex]
    if (!row) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
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
          {!row.isFile && row.folderStatus !== 'same' && (!row.isExpanded || !exists) && (
            <span className={`folder-status-hint ${row.folderStatus}`}>
              (
              {row.folderStatus === 'modified'
                ? 'diff'
                : row.folderStatus === 'left-only'
                  ? 'only left'
                  : 'only right'}
              )
            </span>
          )}
        </span>

        <div className="row-actions">
          {side === 'left' && row.hasLeft && row.status !== 'same' && (
            <button
              className="row-btn copy"
              onClick={e => handleCopy(e, row, 'to-right')}
              title="Copy to Right"
            >
              <ArrowRight size={12} />
            </button>
          )}
          {side === 'right' && row.hasRight && row.status !== 'same' && (
            <button
              className="row-btn copy"
              onClick={e => handleCopy(e, row, 'to-left')}
              title="Copy to Left"
            >
              <ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}
          {exists && (
            <button
              className="row-btn delete"
              onClick={e => handleDelete(e, row, side)}
              title="Delete"
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
          {leftFolderName} (Left)
        </div>
        <div className="header-side" title={rightDir}>
          {rightFolderName} (Right)
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
