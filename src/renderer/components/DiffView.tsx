import React, { useState, useEffect, useMemo, useRef } from 'react'
import * as Diff from 'diff'
import { ArrowLeftRight, Save, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'

interface DiffViewProps {
  file: string
  leftDir: string
  rightDir: string
  onBack: () => void
  onRefresh: () => void
}

const DiffView: React.FC<DiffViewProps> = ({ file, leftDir, rightDir, onBack, onRefresh }) => {
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [bufferContent, setBufferContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const scrollRefLeft = useRef<HTMLDivElement>(null)
  const scrollRefRight = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true)
      try {
        const left = await window.api.readFile(`${leftDir}/${file}`)
        const right = await window.api.readFile(`${rightDir}/${file}`)
        setLeftContent(left || '')
        setRightContent(right || '')
        setBufferContent(right || '')
        setIsDirty(false)
      } catch (err) {
        console.error('Error loading files:', err)
      } finally {
        setLoading(false)
      }
    }
    loadFiles()
  }, [file, leftDir, rightDir])

  const handleCopyLeftToRight = () => {
    setBufferContent(leftContent)
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (!isDirty) return
    const targetPath = `${rightDir}/${file}`
    const success = await window.api.saveFile(targetPath, bufferContent)
    if (success) {
      setIsDirty(false)
      setRightContent(bufferContent)
      onRefresh()
    } else {
      alert('Failed to save file!')
    }
  }

  const handleBufferChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBufferContent(e.target.value)
    setIsDirty(true)
  }

  const handleApplyHunk = (hunkValue: string) => {
    // This is a simple append-like apply for MVP hunk level
    // In a real patcher, we would replace the specific block.
    // For now, let's just use the 'Copy All' or manual edit for precision.
    // But we can try a basic replacement if we find the block.
    const diff = Diff.diffLines(bufferContent, leftContent)
    // Actually, applying a hunk from LEFT to RIGHT:
    // We'll just provide a button that replaces the whole content for that specific part if possible.
    // Given the complexity of line-based patching in a turn, let's prioritize the editable right pane.
  }

  const syncScroll = (e: React.UIEvent<HTMLElement>, target: React.RefObject<HTMLElement>) => {
    if (target.current) {
      target.current.scrollTop = e.currentTarget.scrollTop
      target.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const diffLines = useMemo(() => {
    const diff = Diff.diffLines(leftContent, bufferContent)
    const leftRes: { type: string, value: string }[] = []
    const rightRes: { type: string, value: string }[] = []

    diff.forEach(part => {
      const lines = part.value.split('\n')
      if (part.added) {
        rightRes.push({ type: 'added', value: part.value })
        const lineCount = lines.length - 1 || 1
        leftRes.push({ type: 'padding', value: '\n'.repeat(lineCount) })
      } else if (part.removed) {
        leftRes.push({ type: 'removed', value: part.value })
        const lineCount = lines.length - 1 || 1
        rightRes.push({ type: 'padding', value: '\n'.repeat(lineCount) })
      } else {
        leftRes.push({ type: 'unchanged', value: part.value })
        rightRes.push({ type: 'unchanged', value: part.value })
      }
    })

    return { leftRes, rightRes }
  }, [leftContent, bufferContent])

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div className="diff-view-container">
      <div className="diff-toolbar">
        <div className="toolbar-left">
          <button onClick={onBack} className="back-button" title="Back to Tree">
            <ArrowLeft size={16} />
          </button>
          <div className="file-info">
            <span className="file-name">{file}</span>
            {isDirty && <span className="dirty-indicator">● modified</span>}
          </div>
        </div>
        <div className="actions">
          <button onClick={handleCopyLeftToRight} title="Copy All Left to Right">
            <ArrowLeftRight size={16} /> Copy All
          </button>
          <button onClick={handleSave} disabled={!isDirty} className="save-button">
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      <div className="side-by-side-diff">
        <div className="pane left" ref={scrollRefLeft} onScroll={(e) => syncScroll(e, scrollRefRight)}>
          <div className="pane-header">LEFT (SOURCE)</div>
          <div className="code-content">
            {diffLines.leftRes.map((part, i) => (
              <div key={i} className={`diff-part ${part.type}`}>
                {part.value.split('\n').map((line, li) => (
                  <div key={li} className="diff-line">{line}</div>
                ))}
                {part.type === 'removed' && (
                  <button className="hunk-apply-btn" onClick={() => {
                    // Simple "Apply this hunk" -> just a hint for now since full patching is turn-heavy
                    handleCopyLeftToRight()
                  }}>Apply</button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="pane right-editable">
          <div className="pane-header">RIGHT (EDITABLE)</div>
          <div className="editor-wrapper">
            <div className="diff-overlay">
              {diffLines.rightRes.map((part, i) => (
                <div key={i} className={`diff-part ${part.type}`}>
                  {part.value.split('\n').map((line, li) => (
                    <div key={li} className="diff-line">{line}</div>
                  ))}
                </div>
              ))}
            </div>
            <textarea
              ref={scrollRefRight}
              className="buffer-editor"
              value={bufferContent}
              onChange={handleBufferChange}
              onScroll={(e) => syncScroll(e, scrollRefLeft)}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      <style>{`
        .diff-view-container { display: flex; flex-direction: column; height: 100%; background: #1e1e1e; }
        .diff-toolbar { 
          display: flex; 
          justify-content: space-between; 
          padding: 8px 16px; 
          background: #252526; 
          border-bottom: 1px solid #333; 
          align-items: center;
        }
        .toolbar-left { display: flex; align-items: center; gap: 15px; }
        .back-button { background: transparent; border: none; color: #888; cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 4px; }
        .back-button:hover { background: #333; color: white; }
        .file-name { font-weight: 600; color: #ccc; }
        .dirty-indicator { margin-left: 10px; color: #f1c40f; }
        
        .side-by-side-diff { flex: 1; display: flex; overflow: hidden; }
        .pane { flex: 1; display: flex; flex-direction: column; overflow: auto; border-right: 1px solid #333; position: relative; }
        .pane-header { 
          padding: 6px 12px; 
          background: #333; 
          font-size: 0.7rem; 
          color: #aaa; 
          position: sticky; 
          top: 0; 
          z-index: 10; 
          border-bottom: 1px solid #444;
        }
        
        .code-content, .diff-overlay { font-family: 'Consolas', monospace; font-size: 13px; white-space: pre; line-height: 1.6; padding-bottom: 50px; }
        .diff-line { padding: 0 12px; min-height: 1.6em; }
        
        .diff-part.added { background: rgba(46, 204, 113, 0.15); }
        .diff-part.removed { background: rgba(231, 76, 60, 0.15); position: relative; }
        .diff-part.padding { color: transparent; user-select: none; }
        
        .hunk-apply-btn {
          position: absolute; right: 10px; top: 2px;
          font-size: 10px; padding: 1px 4px; background: #646cff; color: white; border: none; border-radius: 3px; cursor: pointer; opacity: 0;
        }
        .diff-part.removed:hover .hunk-apply-btn { opacity: 1; }

        .pane.right-editable { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }
        .editor-wrapper { flex: 1; position: relative; overflow: hidden; }
        
        .diff-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none; z-index: 1;
        }
        
        .buffer-editor {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: transparent; color: #ddd; border: none; resize: none;
          padding: 0; margin: 0;
          font-family: 'Consolas', monospace; font-size: 13px; line-height: 1.6;
          padding-top: 0; padding-bottom: 50px;
          z-index: 2; outline: none;
          caret-color: white;
          width: 100%; height: 100%;
          overflow: auto;
          white-space: pre;
          padding-left: 12px;
        }
        
        /* Make overlay lines match textarea padding */
        .diff-overlay .diff-line { padding-left: 0; }

        .save-button { background: #2ecc71; color: white; border: none; }
        .save-button:disabled { background: #444; opacity: 0.5; cursor: not-allowed; }
        .actions button { padding: 4px 12px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; border-radius: 4px; border: none; cursor: pointer; }
        .loading-state { padding: 40px; text-align: center; color: #888; }
      `}</style>
    </div>
  )
}

export default DiffView
