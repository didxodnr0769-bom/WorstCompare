import React, { useState } from 'react'
import { ComparisonResult } from '../electron.d'
import { File, FileText, ChevronRight, ChevronDown, AlertCircle, Plus, Minus } from 'lucide-react'

interface TreeViewProps {
  results: ComparisonResult[]
  onFileSelect: (path: string) => void
}

interface TreeNode {
  name: string
  fullPath: string
  children: Record<string, TreeNode>
  isFile: boolean
  status?: ComparisonResult['status']
}

const TreeView: React.FC<TreeViewProps> = ({ results, onFileSelect }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['root']))

  const buildTree = (results: ComparisonResult[]): TreeNode => {
    const root: TreeNode = { name: 'root', fullPath: '', children: {}, isFile: false }

    results.forEach((res) => {
      const parts = res.path.split(/[/\\]/)
      let current = root
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            fullPath: parts.slice(0, index + 1).join('/'),
            children: {},
            isFile: isFile,
            status: isFile ? res.status : undefined,
          }
        }
        current = current.children[part]
        
        // Inherit status for folders (simplified: if any child is modified, folder might show something)
        // For now, let's keep status only on files.
      })
    })

    return root
  }

  const toggleExpand = (path: string) => {
    const next = new Set(expandedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setExpandedPaths(next)
  }

  const getIcon = (status: ComparisonResult['status'] | undefined, isFile: boolean, isExpanded: boolean) => {
    if (!isFile) {
      return isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
    }
    switch (status) {
      case 'same': return <File size={16} className="status-same" />
      case 'modified': return <FileText size={16} className="status-modified" />
      case 'left-only': return <Minus size={16} className="status-left-only" />
      case 'right-only': return <Plus size={16} className="status-right-only" />
      case 'error': return <AlertCircle size={16} className="status-error" />
      default: return <File size={16} />
    }
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const isExpanded = expandedPaths.has(node.fullPath)
    const childKeys = Object.keys(node.children).sort((a, b) => {
      // Folders first, then files
      const nodeA = node.children[a]
      const nodeB = node.children[b]
      if (nodeA.isFile !== nodeB.isFile) return nodeA.isFile ? 1 : -1
      return a.localeCompare(b)
    })

    if (node.name === 'root') {
      return (
        <div className="tree-root">
          {childKeys.map(key => renderNode(node.children[key], 0))}
        </div>
      )
    }

    return (
      <div key={node.fullPath} className="tree-node-container">
        <div 
          className={`tree-item ${node.status || ''} ${node.isFile ? 'is-file' : 'is-folder'}`}
          style={{ paddingLeft: `${depth * 20 + 16}px` }}
          onClick={() => !node.isFile && toggleExpand(node.fullPath)}
          onDoubleClick={() => node.isFile && node.status !== 'same' && onFileSelect(node.fullPath)}
        >
          <div className="item-content">
            {getIcon(node.status, node.isFile, isExpanded)}
            <span className="node-name">{node.name}</span>
          </div>
          {node.isFile && (
            <div className={`item-status status-${node.status}`}>
              {node.status}
            </div>
          )}
        </div>
        {!node.isFile && isExpanded && (
          <div className="tree-children">
            {childKeys.map(key => renderNode(node.children[key], depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const tree = buildTree(results)

  return (
    <div className="tree-view-container">
      <div className="tree-header">
        <div className="header-path">File Structure</div>
        <div className="header-status">Status</div>
      </div>
      <div className="tree-body">
        {renderNode(tree, 0)}
      </div>

      <style>{`
        .tree-view-container {
          background: var(--card-bg);
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
        }
        .tree-header {
          display: flex;
          background: var(--header-bg);
          padding: 8px 16px;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--label-color);
          border-bottom: 1px solid var(--border-color);
        }
        .header-path { flex: 4; }
        .header-status { flex: 1; text-align: right; }
        
        .tree-body {
          max-height: 600px;
          overflow-y: auto;
          padding: 8px 0;
        }
        .tree-item {
          display: flex;
          padding: 4px 16px;
          font-size: 0.9rem;
          cursor: pointer;
          align-items: center;
          user-select: none;
        }
        .tree-item:hover {
          background: var(--tree-row-hover);
        }
        .item-content {
          flex: 4;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-color);
        }
        .node-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .item-status {
          flex: 1;
          text-align: right;
          font-size: 0.75rem;
          text-transform: capitalize;
        }
        
        .status-same { color: var(--status-same); }
        .status-modified { color: var(--status-modified); }
        .status-left-only { color: var(--status-left-only); }
        .status-right-only { color: var(--status-right-only); }
        .status-error { color: #e67e22; }

        .tree-item.same { opacity: 0.5; }
        .is-folder { font-weight: 500; color: var(--label-color); }
      `}</style>
    </div>
  )
}

export default TreeView
