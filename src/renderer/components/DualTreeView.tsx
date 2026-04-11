import React, { useState, useRef, useMemo } from 'react'
import { ComparisonResult } from '../electron.d'
import { File, FileText, ChevronRight, ChevronDown, Minus, Plus } from 'lucide-react'

interface DualTreeViewProps {
  results: ComparisonResult[]
  onFileSelect: (path: string) => void
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
}

const DualTreeView: React.FC<DualTreeViewProps> = ({ results, onFileSelect }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']))
  const scrollRefLeft = useRef<HTMLDivElement>(null)
  const scrollRefRight = useRef<HTMLDivElement>(null)

  const normalizedResults = useMemo(() => {
    return results.map(r => ({
      ...r,
      normalizedPath: r.path.replace(/\\/g, '/')
    }))
  }, [results])

  const generateRows = () => {
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
        if (aParts[i] !== bParts[i]) return aParts[i].localeCompare(bParts[i])
      }
      return aParts.length - bParts.length
    })

    sortedPaths.forEach(path => {
      const parts = path.split('/')
      const depth = parts.length - 1
      const parentPath = parts.slice(0, -1).join('/')
      
      if (depth > 0 && !expandedPaths.has(parentPath)) return

      const fileResult = normalizedResults.find(r => r.normalizedPath === path)
      const isFile = !!fileResult

      let hasLeft = false
      let hasRight = false
      let status: ComparisonResult['status'] | undefined

      if (isFile) {
        hasLeft = fileResult.status !== 'right-only'
        hasRight = fileResult.status !== 'left-only'
        status = fileResult.status
      } else {
        const children = normalizedResults.filter(r => r.normalizedPath.startsWith(path + '/'))
        hasLeft = children.some(r => r.status !== 'right-only')
        hasRight = children.some(r => r.status !== 'left-only')
      }

      rows.push({
        path,
        name: parts[parts.length - 1],
        depth,
        isFile,
        isExpanded: expandedPaths.has(path),
        status,
        hasLeft,
        hasRight
      })
    })

    return rows
  }

  const toggleExpand = (path: string) => {
    const next = new Set(expandedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setExpandedPaths(next)
  }

  const syncScroll = (e: React.UIEvent<HTMLDivElement>, target: React.RefObject<HTMLDivElement>) => {
    if (target.current) {
      target.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  const rows = generateRows()

  const renderRow = (row: TreeRow, side: 'left' | 'right') => {
    const exists = side === 'left' ? row.hasLeft : row.hasRight
    
    return (
      <div 
        key={row.path} 
        className={`tree-row ${exists ? 'exists' : 'missing'} ${row.status || ''} ${row.isFile ? 'file' : 'folder'}`}
        style={{ paddingLeft: `${row.depth * 20 + 10}px` }}
        onClick={() => !row.isFile && exists && toggleExpand(row.path)}
        onDoubleClick={() => row.isFile && exists && onFileSelect(row.path)}
      >
        <div className="icon-wrapper">
          {exists ? (
            !row.isFile ? (
              row.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              row.status === 'modified' ? <FileText size={14} className="status-modified" /> :
              row.status === 'left-only' ? (side === 'left' ? <Plus size={14} className="status-left-only" /> : <div style={{width:14}}/>) :
              row.status === 'right-only' ? (side === 'right' ? <Plus size={14} className="status-right-only" /> : <div style={{width:14}}/>) :
              <File size={14} className="status-same" />
            )
          ) : null}
        </div>
        <span className="row-name">{exists ? row.name : ''}</span>
      </div>
    )
  }

  return (
    <div className="dual-tree-container">
      <div className="tree-pane-header">
        <div className="header-side">Left Side</div>
        <div className="header-side">Right Side</div>
      </div>
      
      <div className="tree-panes">
        <div className="pane left-pane" ref={scrollRefLeft} onScroll={(e) => syncScroll(e, scrollRefRight)}>
          {rows.map(row => renderRow(row, 'left'))}
        </div>

        <div className="pane right-pane" ref={scrollRefRight} onScroll={(e) => syncScroll(e, scrollRefLeft)}>
          {rows.map(row => renderRow(row, 'right'))}
        </div>
      </div>

      <style>{`
        .dual-tree-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 150px);
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 4px;
        }
        .tree-pane-header {
          display: flex;
          background: #252526;
          border-bottom: 1px solid #333;
        }
        .header-side {
          flex: 1;
          padding: 8px 16px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #888;
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
          border-right: 1px solid #333;
        }
        .pane::-webkit-scrollbar { width: 6px; }
        .pane::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        
        .tree-row {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 28px;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          border-bottom: 1px solid transparent;
        }
        .tree-row.exists:hover { background: #2a2d2e; }
        .tree-row.missing { cursor: default; }
        
        .icon-wrapper { width: 16px; display: flex; align-items: center; justify-content: center; }
        .row-name { color: #ccc; }
        .status-modified { color: #f1c40f; }
        .status-left-only { color: #e74c3c; }
        .status-right-only { color: #2ecc71; }
        .status-same { color: #666; }
        
        .tree-row.modified.exists { background: rgba(241, 196, 15, 0.05); }
        .tree-row.left-only.exists { background: rgba(231, 76, 60, 0.05); }
        .tree-row.right-only.exists { background: rgba(46, 204, 113, 0.05); }
      `}</style>
    </div>
  )
}

export default DualTreeView
