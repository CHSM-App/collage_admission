import { useEffect, useState } from 'react'
import { getCollegeSelfFeatures } from '../../../services/collegeAdminService.js'

const DEFAULT_FEATURES = {
  payment:       { platform_fee: true, college_fee: false },
  admission_form: {},
  documents:     {},
  notifications: {},
}

// Per-college cache keyed by collegeId
const cache = {}

export function useCollegeFeatures(collegeId) {
  const [features, setFeatures] = useState(collegeId ? cache[collegeId] : null)
  const [loading,  setLoading]  = useState(!collegeId || !cache[collegeId])

  useEffect(() => {
    if (!collegeId) return
    if (cache[collegeId]) { setFeatures(cache[collegeId]); setLoading(false); return }
    setLoading(true)
    getCollegeSelfFeatures(collegeId)
      .then(r => {
        const f = r.data.data || DEFAULT_FEATURES
        cache[collegeId] = f
        setFeatures(f)
      })
      .catch(() => { cache[collegeId] = DEFAULT_FEATURES; setFeatures(DEFAULT_FEATURES) })
      .finally(() => setLoading(false))
  }, [collegeId])

  const collegeFeeEnabled = features?.payment?.college_fee !== false
  const collegeType       = features?.college_type || 'general'
  const isAgriculture     = collegeType === 'agriculture'

  return { features, loading, collegeFeeEnabled, collegeType, isAgriculture }
}
