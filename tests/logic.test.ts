import { describe, it, expect } from 'vitest'

// 1. 폴더 상태 계산 로직 (기존 유지 및 보강)
interface ComparisonResult {
  path: string
  status: 'same' | 'modified' | 'left-only' | 'right-only' | 'error'
}

function calculateFolderStatus(
  children: ComparisonResult[]
): 'modified' | 'left-only' | 'right-only' | 'same' {
  const childStatuses = children.map(c => c.status)
  if (childStatuses.includes('modified')) return 'modified'
  if (childStatuses.includes('left-only') && childStatuses.includes('right-only')) return 'modified'
  if (childStatuses.includes('left-only')) return 'left-only'
  if (childStatuses.includes('right-only')) return 'right-only'
  return 'same'
}

// 2. 히스토리 스택 관리 로직 (Undo/Redo)
interface HistoryState {
  left: string
  right: string
}

function pushHistory(
  history: HistoryState[],
  index: number,
  newState: HistoryState
): { history: HistoryState[]; index: number } {
  const nextHistory = history.slice(0, index + 1)
  // 동일한 상태면 무시
  if (nextHistory.length > 0) {
    const last = nextHistory[nextHistory.length - 1]
    if (last.left === newState.left && last.right === newState.right) {
      return { history, index }
    }
  }
  const updatedHistory = [...nextHistory, newState].slice(-50)
  return { history: updatedHistory, index: updatedHistory.length - 1 }
}

// 3. 줄바꿈 정규화 로직 (PRD 4.4.1 준수)
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

describe('핵심 로직 테스트', () => {
  describe('폴더 상태 계산 (TC-04)', () => {
    it('자식 요소 중 하나라도 수정되었다면 "modified"를 반환해야 함', () => {
      const children: ComparisonResult[] = [
        { path: 'a.txt', status: 'same' },
        { path: 'b.txt', status: 'modified' },
      ]
      expect(calculateFolderStatus(children)).toBe('modified')
    })

    it('좌측과 우측 모두에 고유한 파일이 있다면 "modified"를 반환해야 함', () => {
      const children: ComparisonResult[] = [
        { path: 'only-a.txt', status: 'left-only' },
        { path: 'only-b.txt', status: 'right-only' },
      ]
      expect(calculateFolderStatus(children)).toBe('modified')
    })
  })

  describe('Undo/Redo 스택 관리 (TC-03)', () => {
    it('새로운 상태를 추가하면 인덱스가 증가해야 함', () => {
      let history: HistoryState[] = [{ left: '1', right: '1' }]
      let index = 0

      const result = pushHistory(history, index, { left: '2', right: '1' })
      expect(result.history.length).toBe(2)
      expect(result.index).toBe(1)
      expect(result.history[1].left).toBe('2')
    })

    it('Undo 수행 후 새로운 상태를 추가하면 이후의 히스토리가 삭제되어야 함', () => {
      let history: HistoryState[] = [
        { left: '1', right: '1' },
        { left: '2', right: '1' },
        { left: '3', right: '1' },
      ]
      let index = 1 // Undo 한 번 수행한 상태 (index: 1)

      const result = pushHistory(history, index, { left: '2-new', right: '1' })
      expect(result.history.length).toBe(3)
      expect(result.index).toBe(2)
      expect(result.history[2].left).toBe('2-new')
      expect(result.history.map(h => h.left)).not.toContain('3')
    })

    it('스택 크기는 최대 50개로 제한되어야 함', () => {
      let history: HistoryState[] = []
      let index = -1
      for (let i = 0; i < 60; i++) {
        const res = pushHistory(history, index, { left: `${i}`, right: '1' })
        history = res.history
        index = res.index
      }
      expect(history.length).toBe(50)
      expect(history[0].left).toBe('10') // 0~9는 잘려나감
    })
  })

  describe('줄바꿈 정규화 (PRD 4.4.1)', () => {
    it('정규화 후에는 CRLF와 LF를 동일하게 취급해야 함', () => {
      const crlf = 'line1\r\nline2'
      const lf = 'line1\nline2'
      expect(normalizeLineEndings(crlf)).toBe(normalizeLineEndings(lf))
    })

    it('정규화 후에는 CR과 LF를 동일하게 취급해야 함', () => {
      const cr = 'line1\rline2'
      const lf = 'line1\nline2'
      expect(normalizeLineEndings(cr)).toBe(normalizeLineEndings(lf))
    })
  })
})
