import React, { useState, useEffect, useRef } from 'react'
import { ComparisonResult } from '../electron.d'
import { File, FileText, ChevronRight, ChevronDown, Minus, Plus, AlertCircle } from 'lucide-react'

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
  leftStatus?: ComparisonResult['status']
  rightStatus?: ComparisonResult['status']
  hasLeft: boolean
  hasRight: boolean
}

const DualTreeView: React.FC<DualTreeViewProps> = ({ results, onFileSelect }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']))
  const scrollRefLeft = useRef<HTMLDivElement>(null)
  const scrollRefRight = useRef<HTMLDivElement>(null)

  // Generate rows for the dual tree
  const generateRows = () => {
    const rows: TreeRow[] = []
    const allPaths = new Set<string>()
    results.forEach(r => {
      const parts = r.path.split(/[/\\]/)
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

      const result = results.find(r => r.path.replace(/[\\ ]/g, '/') === path)
      const isFile = !!result
      
      const hasLeft = result ? (result.status !== 'right-only') : true // Simplified for folders
      const hasRight = result ? (result.status !== 'left-only') : true

      rows.push({
        path,
        name: parts[parts.length - 1],
        depth,
        isFile,
        isExpanded: expandedPaths.has(path),
        leftStatus: result?.status,
        rightStatus: result?.status,
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

  const renderIcon = (row: TreeRow, side: 'left' | 'right') => {
    const exists = side === 'left' ? row.hasLeft : row.hasRight
    if (!exists) return <div style={{ width: 16 }} />
    
    if (!row.isFile) {
      return row.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
    }

    const status = side === 'left' ? row.leftStatus : row.rightStatus
    switch (status) {
      case 'modified': return <FileText size={14} className="status-modified" />
      case 'left-only': return side === 'left' ? <Plus size={14} className="status-left-only" /> : <div style={{ width: 16 }} />
      case 'right-only': return side === 'right' ? <Plus size={14} className="status-right-only" /> : <div style={{ width: 16 }} />
      default: return <File size={14} className="status-same" />
    }
  }

  return (
    <div className="dual-tree-container">
      <div className="tree-pane-header">
        <div className="header-side">Left Side</div>
        <div className="header-side">Right Side</div>
      </div>
      
      <div className="tree-panes">
        <div className="pane left-pane" ref={scrollRefLeft} onScroll={(e) => syncScroll(e, scrollRefRight)}>
          {rows.map(row => (
            <div 
              key={row.path} 
              className={`tree-row ${row.hasLeft ? '' : 'missing'} ${row.leftStatus || ''}`}
              style={{ paddingLeft: `${row.depth * 20 + 10}px` }}
              onClick={() => !row.isFile && toggleExpand(row.path)}
              onDoubleClick={() => row.isFile && row.hasLeft && row.hasRight && onFileSelect(row.path)}
            >
              {renderIcon(row, 'left')}
              <span className="row-name">{row.hasLeft ? row.name : ''}</span>
            </div>
          ))}
        </div>

        <div className="pane right-pane" ref={scrollRefRight} onScroll={(e) => syncScroll(e, scrollRefLeft)}>
          {rows.map(row => (
            <div 
              key={row.path} 
              className={`tree-row ${row.hasRight ? '' : 'missing'} ${row.rightStatus || ''}`}
              style={{ paddingLeft: `${row.depth * 20 + 10}px` }}
              onClick={() => !row.isFile && toggleExpand(row.path)}
              onDoubleClick={() => row.isFile && row.hasLeft && row.hasRight && onFileSelect(row.path)}
            >
              {renderIcon(row, 'right')}
              <span className="row-name">{row.hasRight ? row.name : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .dual-tree-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 180px);
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
          text-transform: uppercase;
        }
        .tree-panes {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .pane {
          flex: 1;
          overflow-y: auto;
          border-right: 1px solid #333;
        }
        .pane::-webkit-scrollbar { width: 8px; }
        .pane::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        
        .tree-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          border-bottom: 1px solid transparent;
        }
        .tree-row:hover { background: #2a2d2e; }
        .tree-row.missing { opacity: 0; pointer-events: none; }
        
        .row-name { color: #ccc; }
        .status-modified { color: #f1c40f; }
        .status-left-only { color: #e74c3c; }
        .status-right-only { color: #2ecc71; }
        .status-same { color: #666; }
        
        .tree-row.modified { background: rgba(241, 196, 15, 0.05); }
        .tree-row.left-only { background: rgba(231, 76, 60, 0.05); }
        .tree-row.right-only { background: rgba(46, 204, 113, 0.05); }
      `}</style>
    </div>
  )
}

export default DualTreeView
