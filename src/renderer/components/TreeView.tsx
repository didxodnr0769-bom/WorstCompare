import React from 'react'
import { ComparisonResult } from '../electron.d'
import { File, FileText, Folder, AlertCircle, Plus, Minus, MoveHorizontal } from 'lucide-react'

interface TreeViewProps {
  results: ComparisonResult[]
  onFileSelect: (path: string) => void
}

const TreeView: React.FC<TreeViewProps> = ({ results, onFileSelect }) => {
  const getIcon = (status: ComparisonResult['status']) => {
    switch (status) {
      case 'same': return <File size={16} className="status-same" />
      case 'modified': return <FileText size={16} className="status-modified" />
      case 'left-only': return <Minus size={16} className="status-left-only" />
      case 'right-only': return <Plus size={16} className="status-right-only" />
      case 'error': return <AlertCircle size={16} className="status-error" />
      default: return <File size={16} />
    }
  }

  const getStatusLabel = (status: ComparisonResult['status']) => {
    switch (status) {
      case 'same': return 'Same'
      case 'modified': return 'Modified'
      case 'left-only': return 'Left Only'
      case 'right-only': return 'Right Only'
      case 'error': return 'Error'
      default: return ''
    }
  }

  return (
    <div className="tree-view-container">
      <div className="tree-header">
        <div className="header-path">Path</div>
        <div className="header-status">Status</div>
      </div>
      <div className="tree-body">
        {results.map((res) => (
          <div 
            key={res.path} 
            className={`tree-item ${res.status}`}
            onDoubleClick={() => res.status !== 'same' && onFileSelect(res.path)}
          >
            <div className="item-path">
              {getIcon(res.status)}
              <span>{res.path}</span>
            </div>
            <div className={`item-status status-${res.status}`}>
              {getStatusLabel(res.status)}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .tree-view-container {
          background: #2a2a2a;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #444;
        }
        .tree-header {
          display: flex;
          background: #1a1a1a;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 0.85rem;
          color: #888;
          border-bottom: 1px solid #444;
        }
        .header-path { flex: 4; }
        .header-status { flex: 1; text-align: right; }
        
        .tree-body {
          max-height: 600px;
          overflow-y: auto;
        }
        .tree-item {
          display: flex;
          padding: 6px 16px;
          font-size: 0.9rem;
          cursor: pointer;
          border-bottom: 1px solid #333;
          align-items: center;
        }
        .tree-item:hover {
          background: #333;
        }
        .item-path {
          flex: 4;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #eee;
        }
        .item-status {
          flex: 1;
          text-align: right;
          font-size: 0.8rem;
          font-weight: 600;
        }
        
        .status-same { color: #888; }
        .status-modified { color: #f1c40f; }
        .status-left-only { color: #e74c3c; }
        .status-right-only { color: #2ecc71; }
        .status-error { color: #e67e22; }

        .tree-item.same { opacity: 0.6; }
      `}</style>
    </div>
  )
}

export default TreeView
