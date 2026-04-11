import React, { useState, useEffect, useMemo, useRef } from 'react'
import * as Diff from 'diff'
import { ArrowLeftRight, Save, ArrowLeft } from 'lucide-react'

interface DiffViewProps {
  file: string
  leftDir: string
  rightDir: string
  onBack: () => void
}

const DiffView: React.FC<DiffViewProps> = ({ file, leftDir, rightDir, onBack }) => {
  const [leftContent, setLeftContent] = useState<string>('')
  const [rightContent, setRightContent] = useState<string>('')
  const [bufferContent, setBufferContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const scrollRefLeft = useRef<HTMLDivElement>(null)
  const scrollRefRight = useRef<HTMLDivElement>(null)

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
    } else {
      alert('Failed to save file!')
    }
  }

  useEffect(() => {
    const listener = () => handleSave()
    window.addEventListener('save-current-file', listener)
    return () => window.removeEventListener('save-current-file', listener)
  }, [isDirty, bufferContent, rightDir, file])

  const syncScroll = (e: React.UIEvent<HTMLDivElement>, target: React.RefObject<HTMLDivElement>) => {
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
      if (part.added) {
        rightRes.push({ type: 'added', value: part.value })
        const lineCount = part.value.split('\n').length - 1 || 1
        leftRes.push({ type: 'padding', value: '\n'.repeat(lineCount) })
      } else if (part.removed) {
        leftRes.push({ type: 'removed', value: part.value })
        const lineCount = part.value.split('\n').length - 1 || 1
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
          <button onClick={handleCopyLeftToRight} title="Copy Left to Right">
            <ArrowLeftRight size={16} /> Overwrite Right
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
              </div>
            ))}
          </div>
        </div>
        <div className="pane right" ref={scrollRefRight} onScroll={(e) => syncScroll(e, scrollRefLeft)}>
          <div className="pane-header">RIGHT (DESTINATION)</div>
          <div className="code-content">
            {diffLines.rightRes.map((part, i) => (
              <div key={i} className={`diff-part ${part.type}`}>
                {part.value.split('\n').map((line, li) => (
                  <div key={li} className="diff-line">{line}</div>
                ))}
              </div>
            ))}
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
        .back-button { 
          background: transparent; 
          border: none; 
          color: #888; 
          cursor: pointer; 
          padding: 4px; 
          display: flex; 
          align-items: center; 
          border-radius: 4px;
        }
        .back-button:hover { background: #333; color: white; }
        .file-name { font-weight: 600; color: #ccc; }
        .dirty-indicator { margin-left: 10px; color: #f1c40f; }
        
        .side-by-side-diff { flex: 1; display: flex; overflow: hidden; }
        .pane { flex: 1; display: flex; flex-direction: column; overflow: auto; border-right: 1px solid #333; }
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
        .code-content { font-family: 'Consolas', monospace; font-size: 13px; white-space: pre; line-height: 1.6; padding-bottom: 50px; }
        
        .diff-part.added { background: rgba(46, 204, 113, 0.15); }
        .diff-part.removed { background: rgba(231, 76, 60, 0.15); }
        .diff-part.padding { background: rgba(0, 0, 0, 0.05); color: transparent; user-select: none; }
        .diff-line { padding: 0 12px; min-height: 1.6em; }

        .save-button { background: #2ecc71; color: white; border: none; }
        .save-button:disabled { background: #444; opacity: 0.5; cursor: not-allowed; }
        .actions button { padding: 4px 12px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; border-radius: 4px; }
        .loading-state { padding: 40px; text-align: center; color: #888; }
      `}</style>
    </div>
  )
}

export default DiffView
