import { describe, it, expect } from 'vitest'

// Note: In a real Electron app, IPC handlers are tested differently, 
// but we can test the core logic of comparison here.

interface ComparisonResult {
  path: string
  status: 'same' | 'modified' | 'left-only' | 'right-only' | 'error'
}

function calculateFolderStatus(children: ComparisonResult[]): 'modified' | 'left-only' | 'right-only' | 'same' {
  const childStatuses = children.map(c => c.status)
  if (childStatuses.includes('modified')) return 'modified'
  if (childStatuses.includes('left-only') && childStatuses.includes('right-only')) return 'modified'
  if (childStatuses.includes('left-only')) return 'left-only'
  if (childStatuses.includes('right-only')) return 'right-only'
  return 'same'
}

describe('Folder Status Calculation (TC-04)', () => {
  it('should return "modified" if any child is modified', () => {
    const children: ComparisonResult[] = [
      { path: 'a.txt', status: 'same' },
      { path: 'b.txt', status: 'modified' }
    ]
    expect(calculateFolderStatus(children)).toBe('modified')
  })

  it('should return "modified" if both sides have unique files', () => {
    const children: ComparisonResult[] = [
      { path: 'only-a.txt', status: 'left-only' },
      { path: 'only-b.txt', status: 'right-only' }
    ]
    expect(calculateFolderStatus(children)).toBe('modified')
  })

  it('should return "left-only" if children only exist on the left', () => {
    const children: ComparisonResult[] = [
      { path: 'only-a.txt', status: 'left-only' }
    ]
    expect(calculateFolderStatus(children)).toBe('left-only')
  })

  it('should return "same" if all children are same', () => {
    const children: ComparisonResult[] = [
      { path: 'a.txt', status: 'same' }
    ]
    expect(calculateFolderStatus(children)).toBe('same')
  })
})
