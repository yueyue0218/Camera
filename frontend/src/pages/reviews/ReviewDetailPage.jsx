import { useEffect, useState } from 'react'
import { Alert, Stack } from '@mui/material'
import { Navigate, useParams } from 'react-router-dom'
import { reviewApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { buildOrderNavigationTarget } from '../../utils/orderNavigation.js'
import { EmptyState, Feedback } from '../dline/shared.jsx'

export function ReviewDetailPage() {
  const { reviewId } = useParams()
  const { currentUser } = useAuth()
  const [orderId, setOrderId] = useState(null)
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        const review = await reviewApi.detail(reviewId, currentUser)
        if (!alive) return
        setOrderId(review?.orderId || null)
      } catch {
        if (alive) setFeedback({ error: '评价详情已并入订单详情页，当前记录暂时无法定位。' })
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [reviewId, currentUser])

  if (orderId) {
    const target = buildOrderNavigationTarget(orderId, {
      section: 'reviews',
      reviewId
    })
    if (target) {
      return <Navigate to={target.to} replace state={target.state} />
    }
  }

  return (
    <Stack spacing={2}>
      <Feedback {...feedback} />
      {loading ? <EmptyState>正在定位关联订单...</EmptyState> : null}
      {!loading && !orderId ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          独立评价详情页已废弃。请从订单详情页的“评价与申诉”区域查看评价、申诉和追评。
        </Alert>
      ) : null}
    </Stack>
  )
}
