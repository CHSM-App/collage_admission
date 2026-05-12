/**
 * useSortableTable — client-side sort + optional search filter for table rows.
 *
 * @param {Array} rows - the raw data array
 * @param {string} defaultSortCol - initial sort column key
 * @param {string} [defaultSortDir='asc'] - 'asc' | 'desc'
 * @param {{ searchFields?: string[], numericCols?: string[] }} [options]
 *   searchFields: row keys to include in search matching (if omitted, search is skipped)
 *   numericCols:  column keys that should sort numerically
 *
 * @returns {{ sorted, query, setQuery, sortCol, sortDir, toggleSort }}
 */
import { useMemo, useState } from 'react'

export function useSortableTable(rows, defaultSortCol, defaultSortDir = 'asc', options = {}) {
  const { searchFields = [], numericCols = [] } = options

  const [sortCol, setSortCol] = useState(defaultSortCol)
  const [sortDir, setSortDir] = useState(defaultSortDir)
  const [query, setQuery]     = useState('')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    let data = rows

    // Optional client-side search
    if (searchFields.length > 0 && query.trim()) {
      const q = query.trim().toLowerCase()
      data = data.filter(row =>
        searchFields.some(field => String(row[field] || '').toLowerCase().includes(q))
      )
    }

    return [...data].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av == null) av = ''
      if (bv == null) bv = ''

      // Numeric sort for specified columns
      if (numericCols.includes(sortCol)) {
        av = Number(av); bv = Number(bv)
      }

      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))

      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir, query])

  return { sorted, query, setQuery, sortCol, sortDir, toggleSort }
}
