import { useEffect, useState } from 'react'
import { Alert, Stack } from '@mui/material'
import { Navigate, useParams } from 'react-router-dom'
import { reviewComplaintApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { buildOrderNavigationTarget } from '../../utils/orderNavigation.js'
import { EmptyState, Feedback } from '../dline/shared.jsx'

export function ReviewComplaintDetailPage() {
  const { complaintId } = useParams()
  const { currentUser } = useAuth()
  const [orderId, setOrderId] = useState(null)
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        const complaint = await reviewComplaintApi.detail(complaintId, currentUser)
        if (!alive) return
        setOrderId(complaint?.orderId || null)
      } catch {
        if (alive) setFeedback({ error: '这条申诉记录暂时打不开，请回到对应订单查看。' })
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [complaintId, currentUser])

  if (orderId) {
    const target = buildOrderNavigationTarget(orderId, {
      section: 'reviews',
      complaintId
    })
    if (target) {
      return <Navigate to={target.to} replace state={target.state} />
    }
  }

  return (
    <Stack spacing={2}>
      <Feedback {...feedback} />
      {loading ? <EmptyState>正在打开申诉记录...</EmptyState> : null}
      {!loading && !orderId ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          请从订单详情页的“评价与申诉”查看这条申诉记录和处理结果。
        </Alert>
      ) : null}
    </Stack>
  )
}
