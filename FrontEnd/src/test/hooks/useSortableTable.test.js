import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSortableTable } from '../../shared/hooks/useSortableTable.js'

const sampleRows = [
  { id: 3, name: 'Charlie', score: 80 },
  { id: 1, name: 'Alice',   score: 95 },
  { id: 2, name: 'Bob',     score: 72 },
]

describe('useSortableTable', () => {
  it('returns initial sort by defaultSortCol ascending', () => {
    const { result } = renderHook(() =>
      useSortableTable(sampleRows, 'name')
    )
    expect(result.current.sortCol).toBe('name')
    expect(result.current.sortDir).toBe('asc')
    expect(result.current.sorted[0].name).toBe('Alice')
    expect(result.current.sorted[2].name).toBe('Charlie')
  })

  it('respects defaultSortDir desc', () => {
    const { result } = renderHook(() =>
      useSortableTable(sampleRows, 'name', 'desc')
    )
    expect(result.current.sorted[0].name).toBe('Charlie')
  })

  it('toggleSort flips direction on same column', () => {
    const { result } = renderHook(() =>
      useSortableTable(sampleRows, 'name')
    )
    act(() => result.current.toggleSort('name'))
    expect(result.current.sortDir).toBe('desc')
    expect(result.current.sorted[0].name).toBe('Charlie')
  })

  it('toggleSort changes column and resets to asc', () => {
    const { result } = renderHook(() =>
      useSortableTable(sampleRows, 'name')
    )
    act(() => result.current.toggleSort('id'))
    expect(result.current.sortCol).toBe('id')
    expect(result.current.sortDir).toBe('asc')
    expect(result.current.sorted[0].id).toBe(1)
  })

  it('numeric sort works for numericCols', () => {
    const { result } = renderHook(() =>
      useSortableTable(sampleRows, 'score', 'asc', { numericCols: ['score'] })
    )
    expect(result.current.sorted[0].score).toBe(72)
    expect(result.current.sorted[2].score).toBe(95)
  })

  it('setQuery filters rows by searchFields', () => {
    const { result } = renderHook(() =>
      useSortableTable(sampleRows, 'name', 'asc', { searchFields: ['name'] })
    )
    act(() => result.current.setQuery('ali'))
    expect(result.current.sorted).toHaveLength(1)
    expect(result.current.sorted[0].name).toBe('Alice')
  })

  it('setQuery empty string shows all rows', () => {
    const { result } = renderHook(() =>
      useSortableTable(sampleRows, 'name', 'asc', { searchFields: ['name'] })
    )
    act(() => result.current.setQuery('ali'))
    act(() => result.current.setQuery(''))
    expect(result.current.sorted).toHaveLength(3)
  })

  it('handles null/undefined values in sort', () => {
    const rows = [
      { id: 1, name: null },
      { id: 2, name: 'Alice' },
    ]
    const { result } = renderHook(() => useSortableTable(rows, 'name'))
    expect(result.current.sorted[0].id).toBe(1) // null sorts before Alice
  })

  it('returns query and setQuery', () => {
    const { result } = renderHook(() => useSortableTable(sampleRows, 'name'))
    expect(result.current.query).toBe('')
    act(() => result.current.setQuery('test'))
    expect(result.current.query).toBe('test')
  })
})
