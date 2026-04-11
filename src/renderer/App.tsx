import React, { useState, useEffect, useCallback } from 'react'
import FolderSelector from './components/FolderSelector'
import DualTreeView from './components/DualTreeView'
import DiffView from './components/DiffView'
import { ComparisonResult } from './electron.d'
import './App.css'

export type AppState = 'setup' | 'comparing' | 'diff'

interface HistoryItem {
  left: string
  right: string
  timestamp: number
}

const App: React.FC = () => {
  const [leftDir, setLeftDir] = useState<string>('')
  const [rightDir, setRightDir] = useState<string>('')
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [view, setView] = useState<AppState>('setup')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [excludes] = useState<string[]>(['node_modules', '.git', 'dist', 'build', '.DS_Store'])

  useEffect(() => {
    const savedHistory = localStorage.getItem('compare-history')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  const handleCompare = useCallback(async (lDir?: string, rDir?: string) => {
    const l = lDir || leftDir
    const r = rDir || rightDir
    if (!l || !r) return

    setView('comparing')
    const res = await window.api.compareFolders(l, r, excludes)
    setResults(res)
    setView('setup')

    // Update History
    const newHistory = [
      { left: l, right: r, timestamp: Date.now() },
      ...history.filter(h => h.left !== l || h.right !== r)
    ].slice(0, 10)
    setHistory(newHistory)
    localStorage.setItem('compare-history', JSON.stringify(newHistory))
  }, [leftDir, rightDir, excludes, history])

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath)
    setView('diff')
  }

  const handleBack = () => {
    setView('setup')
    // Keep selectedFile to maintain focus in the tree view
  }

  return (
    <div className="app-container">
      <main className="app-main">
        {view !== 'diff' ? (
          <div className="workspace">
            <FolderSelector
              leftDir={leftDir}
              rightDir={rightDir}
              setLeftDir={setLeftDir}
              setRightDir={setRightDir}
              onCompare={() => handleCompare()}
              onRefresh={() => handleCompare()}
              hasResults={results.length > 0}
              history={history}
              onSelectHistory={(h) => {
                setLeftDir(h.left)
                setRightDir(h.right)
                handleCompare(h.left, h.right)
              }}
            />
            {results.length > 0 && (
              <DualTreeView 
                results={results} 
                onFileSelect={handleFileSelect}
                leftDir={leftDir}
                rightDir={rightDir}
                onRefresh={() => handleCompare()}
                selectedFilePath={selectedFile}
              />
            )}
            {view === 'comparing' && <div className="loading-overlay">Comparing...</div>}
          </div>
        ) : (
          <DiffView 
            file={selectedFile!} 
            leftDir={leftDir} 
            rightDir={rightDir}
            onBack={handleBack}
            onRefresh={() => handleCompare()}
          />
        )}
      </main>
    </div>
  )
}

export default App
