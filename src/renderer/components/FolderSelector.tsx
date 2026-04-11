import React from 'react'
import { FolderOpen, Play } from 'lucide-react'

interface FolderSelectorProps {
  leftDir: string
  rightDir: string
  setLeftDir: (path: string) => void
  setRightDir: (path: string) => void
  onCompare: () => void
}

const FolderSelector: React.FC<FolderSelectorProps> = ({ leftDir, rightDir, setLeftDir, setRightDir, onCompare }) => {
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

      <button className="compare-button" onClick={onCompare} disabled={!leftDir || !rightDir}>
        <Play size={18} /> Compare
      </button>

      <style>{`
        .folder-selector-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: #2a2a2a;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
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
          font-size: 0.9rem;
          color: #aaa;
        }
        .input-with-button {
          display: flex;
          gap: 8px;
        }
        .input-with-button input {
          flex: 1;
          background: #1a1a1a;
          border: 1px solid #444;
          padding: 8px 12px;
          border-radius: 4px;
          color: #eee;
          font-size: 0.9rem;
        }
        .compare-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #646cff;
          color: white;
          font-weight: 600;
        }
        .compare-button:hover {
          background: #535bf2;
        }
        .compare-button:disabled {
          background: #444;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

export default FolderSelector
