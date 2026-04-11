import React, { useState, useEffect, useCallback } from 'react'
import { Sun, Moon } from 'lucide-react'
import FolderSelector from './components/FolderSelector'
import DualTreeView from './components/DualTreeView'
import DiffView from './components/DiffView'
import { ComparisonResult } from './electron.d'
import './App.css'

export type AppState = 'setup' | 'comparing' | 'diff'
export type Theme = 'dark' | 'light'

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
  const [excludes, setExcludes] = useState<string>('node_modules, .git, dist, build, .DS_Store')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']))
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme') as Theme
    return saved || 'dark'
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem('compare-history')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  useEffect(() => {
    document.documentElement.className = `${theme}-theme`
    localStorage.setItem('app-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const handleCompare = useCallback(async (lDir?: string, rDir?: string) => {
    const l = lDir || leftDir
    const r = rDir || rightDir
    if (!l || !r) return

    const excludeList = excludes.split(',').map(s => s.trim()).filter(Boolean)

    setView('comparing')
    const res = await window.api.compareFolders(l, r, excludeList)
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
      <header className="app-header">
        <h1>Worst Compare</h1>
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>
      <main className="app-main">
        {view !== 'diff' ? (
          <div className="workspace">
            <FolderSelector
              leftDir={leftDir}
              rightDir={rightDir}
              setLeftDir={setLeftDir}
              setRightDir={setRightDir}
              excludes={excludes}
              setExcludes={setExcludes}
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
                expandedPaths={expandedPaths}
                setExpandedPaths={setExpandedPaths}
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
