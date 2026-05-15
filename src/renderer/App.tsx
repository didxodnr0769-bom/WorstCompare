import React, { useState, useEffect, useCallback } from 'react'
import { Sun, Moon } from 'lucide-react'
import FolderSelector from './components/FolderSelector'
import DualTreeView from './components/DualTreeView'
import DiffView from './components/DiffView'
import { ComparisonResult, Action } from './electron.d'
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
  const [excludes, setExcludes] = useState<string>(() => {
    const saved = localStorage.getItem('app-excludes')
    return saved !== null ? saved : 'node_modules, .git, dist, build, .DS_Store'
  })
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']))
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme') as Theme
    return saved || 'dark'
  })

  const [undoStack, setUndoStack] = useState<Action[]>([])
  const [redoStack, setRedoStack] = useState<Action[]>([])

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

  useEffect(() => {
    localStorage.setItem('app-excludes', excludes)
  }, [excludes])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleCompare = useCallback(
    async (lDir?: string, rDir?: string) => {
      const l = lDir || leftDir
      const r = rDir || rightDir
      if (!l || !r) return

      const excludeList = excludes
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      setView('comparing')
      try {
        const res = await window.api.compareFolders(l, r, excludeList)
        setResults(res)

        setHistory(prev => {
          const newHistory = [
            { left: l, right: r, timestamp: Date.now() },
            ...prev.filter(h => h.left !== l || h.right !== r),
          ].slice(0, 10)
          localStorage.setItem('compare-history', JSON.stringify(newHistory))
          return newHistory
        })

        if (l !== leftDir || r !== rightDir) {
          setUndoStack([])
          setRedoStack([])
          setLeftDir(l)
          setRightDir(r)
        }
      } catch (err) {
        console.error('Comparison failed:', err)
      } finally {
        setView('setup')
      }
    },
    [leftDir, rightDir, excludes]
  )

  const executeAction = useCallback(
    async (action: Action, isUndo: boolean) => {
      const targetDir = action.side === 'left' ? leftDir : rightDir
      const sourceDir = action.side === 'left' ? rightDir : leftDir
      const targetPath = `${targetDir}/${action.path}`
      const sourcePath = `${sourceDir}/${action.path}`

      if (action.type === 'batch' && action.subActions) {
        // 배치 작업은 순차적으로 처리 (Undo는 역순으로)
        const subActions = isUndo ? [...action.subActions].reverse() : action.subActions
        for (const sub of subActions) {
          await executeAction(sub, isUndo)
        }
        return
      }

      if (isUndo) {
        if (action.type === 'copy') {
          if (action.previousContent !== undefined && action.previousContent !== null) {
            await window.api.saveFile(targetPath, action.previousContent)
          } else {
            await window.api.deleteItem(targetPath)
          }
        } else if (action.type === 'delete') {
          if (action.previousContent !== undefined && action.previousContent !== null) {
            await window.api.saveFile(targetPath, action.previousContent)
          }
        }
      } else {
        // Redo (또는 일반 실행)
        if (action.type === 'copy') {
          await window.api.copyItem(sourcePath, targetPath)
        } else if (action.type === 'delete') {
          await window.api.deleteItem(targetPath)
        }
      }
    },
    [leftDir, rightDir]
  )

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return

    const action = undoStack[undoStack.length - 1]
    try {
      await executeAction(action, true)
      setUndoStack(prev => prev.slice(0, -1))
      setRedoStack(prev => [...prev, action])
      handleCompare(leftDir, rightDir)
    } catch (err) {
      console.error('Undo failed:', err)
    }
  }, [undoStack, leftDir, rightDir, handleCompare, executeAction])

  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return

    const action = redoStack[redoStack.length - 1]
    try {
      await executeAction(action, false)
      setRedoStack(prev => prev.slice(0, -1))
      setUndoStack(prev => [...prev, action])
      handleCompare(leftDir, rightDir)
    } catch (err) {
      console.error('Redo failed:', err)
    }
  }, [redoStack, leftDir, rightDir, handleCompare, executeAction])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          if (e.shiftKey) handleRedo()
          else handleUndo()
        } else if (e.key === 'y') {
          e.preventDefault()
          handleRedo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  const recordAction = (action: Action) => {
    setUndoStack(prev => [...prev.slice(-49), action])
    setRedoStack([])
  }

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath)
    setView('diff')
  }

  const handleBack = () => {
    setView('setup')
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Worst Compare</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
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
              onCompare={() => handleCompare(leftDir, rightDir)}
              onRefresh={() => handleCompare(leftDir, rightDir)}
              hasResults={results.length > 0}
              history={history}
              onSelectHistory={h => handleCompare(h.left, h.right)}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
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
                onAction={recordAction}
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
