import React from 'react'
import { FolderOpen, Play, RotateCw } from 'lucide-react'

interface FolderSelectorProps {
  leftDir: string
  rightDir: string
  setLeftDir: (path: string) => void
  setRightDir: (path: string) => void
  onCompare: () => void
  onRefresh: () => void
  hasResults: boolean
}

const FolderSelector: React.FC<FolderSelectorProps> = ({ leftDir, rightDir, setLeftDir, setRightDir, onCompare, onRefresh, hasResults }) => {
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
      </div>

      <style>{`
        .folder-selector-container {
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
        .compare-button, .refresh-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 16px;
          font-weight: 600;
          font-size: 0.9rem;
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
      `}</style>
    </div>
  )
}

export default FolderSelector
