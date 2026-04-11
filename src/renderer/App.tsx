import React, { useState, useEffect } from 'react'
import FolderSelector from './components/FolderSelector'
import DualTreeView from './components/DualTreeView'
import DiffView from './components/DiffView'
import { ComparisonResult } from './electron.d'
import './App.css'

export type AppState = 'setup' | 'comparing' | 'diff'

const App: React.FC = () => {
  const [leftDir, setLeftDir] = useState<string>('')
  const [rightDir, setRightDir] = useState<string>('')
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [view, setView] = useState<AppState>('setup')
  const [excludes] = useState<string[]>(['node_modules', '.git', 'dist', 'build', '.DS_Store'])

  const handleCompare = async () => {
    if (!leftDir || !rightDir) return
    setView('comparing')
    const res = await window.api.compareFolders(leftDir, rightDir, excludes)
    setResults(res)
    setView('setup')
  }

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath)
    setView('diff')
  }

  const handleBack = () => {
    setView('setup')
    setSelectedFile(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('save-current-file'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>WorstCompare</h1>
        {view === 'diff' && (
          <button onClick={handleBack} className="back-button">Back to Tree</button>
        )}
      </header>

      <main className="app-main">
        {view !== 'diff' ? (
          <div className="workspace">
            <FolderSelector
              leftDir={leftDir}
              rightDir={rightDir}
              setLeftDir={setLeftDir}
              setRightDir={setRightDir}
              onCompare={handleCompare}
            />
            {results.length > 0 && (
              <DualTreeView 
                results={results} 
                onFileSelect={handleFileSelect} 
              />
            )}
            {view === 'comparing' && <div className="loading-overlay">Comparing...</div>}
          </div>
        ) : (
          <DiffView 
            file={selectedFile!} 
            leftDir={leftDir} 
            rightDir={rightDir} 
          />
        )}
      </main>
    </div>
  )
}

export default App
