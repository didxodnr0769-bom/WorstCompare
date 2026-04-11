import React, { useState } from 'react'
import { FolderOpen, Play, RotateCw, History } from 'lucide-react'

interface HistoryItem {
  left: string
  right: string
  timestamp: number
}

interface FolderSelectorProps {
  leftDir: string
  rightDir: string
  setLeftDir: (path: string) => void
  setRightDir: (path: string) => void
  onCompare: () => void
  onRefresh: () => void
  hasResults: boolean
  history: HistoryItem[]
  onSelectHistory: (h: HistoryItem) => void
}

const FolderSelector: React.FC<FolderSelectorProps> = ({ 
  leftDir, rightDir, setLeftDir, setRightDir, onCompare, onRefresh, hasResults, history, onSelectHistory 
}) => {
  const [showHistory, setShowHistory] = useState(false)

  const handleSelect = async (side: 'left' | 'right') => {
    const path = await window.api.selectFolder()
    if (path) {
      if (side === 'left') setLeftDir(path)
      else setRightDir(path)
    }
  }

  return (
    <div className="folder-selector-container">
      <div className="folder-inputs">
        <div className="folder-input-group">
          <label>Left Folder</label>
          <div className="input-with-button">
            <input type="text" value={leftDir} readOnly placeholder="Select folder..." />
            <button onClick={() => handleSelect('left')} title="Select Folder">
              <FolderOpen size={18} />
            </button>
          </div>
        </div>

        <div className="folder-input-group">
          <label>Right Folder</label>
          <div className="input-with-button">
            <input type="text" value={rightDir} readOnly placeholder="Select folder..." />
            <button onClick={() => handleSelect('right')} title="Select Folder">
              <FolderOpen size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button className="compare-button" onClick={onCompare} disabled={!leftDir || !rightDir}>
          <Play size={18} /> Compare
        </button>
        {hasResults && (
          <button className="refresh-button" onClick={onRefresh} title="Refresh Comparison">
            <RotateCw size={18} /> Refresh
          </button>
        )}
        <button 
          className={`history-toggle ${showHistory ? 'active' : ''}`} 
          onClick={() => setShowHistory(!showHistory)}
          title="Comparison History"
        >
          <History size={18} />
        </button>
      </div>

      {showHistory && (
        <div className="history-dropdown">
          {history.length === 0 && <div className="no-history">No history yet.</div>}
          {history.map((h, i) => (
            <div key={i} className="history-item" onClick={() => { onSelectHistory(h); setShowHistory(false); }}>
              <div className="h-path">L: {h.left}</div>
              <div className="h-path">R: {h.right}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .folder-selector-container {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 15px;
          background: #2a2a2a;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
        }
        .folder-inputs {
          display: flex;
          gap: 20px;
        }
        .folder-input-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .folder-input-group label {
          font-size: 0.8rem;
          color: #aaa;
          text-transform: uppercase;
        }
        .input-with-button {
          display: flex;
          gap: 8px;
        }
        .input-with-button input {
          flex: 1;
          background: #1a1a1a;
          border: 1px solid #444;
          padding: 6px 10px;
          border-radius: 4px;
          color: #eee;
          font-size: 0.85rem;
        }
        .action-buttons {
          display: flex;
          gap: 10px;
        }
        .compare-button, .refresh-button, .history-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 16px;
          font-weight: 600;
          font-size: 0.9rem;
          border-radius: 4px;
        }
        .compare-button {
          background: #646cff;
          color: white;
          flex: 1;
        }
        .compare-button:hover { background: #535bf2; }
        .compare-button:disabled { background: #444; cursor: not-allowed; }
        
        .refresh-button {
          background: #333;
          color: #ccc;
          border: 1px solid #444;
        }
        .refresh-button:hover { background: #444; color: white; }
        
        .history-toggle { background: #333; color: #ccc; padding: 6px; }
        .history-toggle.active { background: #646cff; color: white; }

        .history-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #2a2a2a;
          border: 1px solid #444;
          border-top: none;
          z-index: 100;
          max-height: 250px;
          overflow-y: auto;
          box-shadow: 0 10px 15px rgba(0,0,0,0.3);
          border-radius: 0 0 8px 8px;
        }
        .history-item {
          padding: 10px 15px;
          border-bottom: 1px solid #333;
          cursor: pointer;
        }
        .history-item:hover { background: #333; }
        .h-path { font-size: 0.75rem; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .no-history { padding: 20px; text-align: center; color: #666; font-size: 0.9rem; }
      `}</style>
    </div>
  )
}

export default FolderSelector
