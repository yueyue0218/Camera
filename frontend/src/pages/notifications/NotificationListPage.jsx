import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Paper, Stack, Typography } from '@mui/material'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import { notificationApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, Feedback, PageHeader, formatDateTime, portra } from '../dline/shared.jsx'

export function NotificationListPage() {
  const { currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(false)

  const unreadCount = useMemo(() => items.filter(item => !item.isRead).length, [items])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        const data = await notificationApi.listMine(currentUser)
        if (!alive) return
        setItems(Array.isArray(data) ? data : [])
        setFeedback({})
      } catch (error) {
        if (alive) setFeedback({ error: error.message })
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [currentUser])

  async function markRead(notificationId) {
    try {
      const updated = await notificationApi.markRead(notificationId, currentUser)
      setItems(current => current.map(item => (item.notificationId === notificationId ? updated : item)))
      setFeedback({ success: '通知已读' })
    } catch (error) {
      setFeedback({ error: error.message })
    }
  }

  async function markAllRead() {
    try {
      const updated = await notificationApi.markAllRead(currentUser)
      setItems(Array.isArray(updated) ? updated : [])
      setFeedback({ success: '全部通知已读' })
    } catch (error) {
      setFeedback({ error: error.message })
    }
  }

  async function openNotification(item) {
    if (!item || item.isRead) return
    await markRead(item.notificationId)
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="PORTRA NOTICE"
        title="通知"
        description={unreadCount ? `${unreadCount} 条未读通知` : '当前没有未读通知'}
        action={<Button startIcon={<DoneAllRoundedIcon />} onClick={markAllRead} disabled={!unreadCount}>全部已读</Button>}
      />
      <Feedback {...feedback} />
      {items.length ? (
        <Stack gap={1.5}>
          {items.map(item => (
            <Paper
              key={item.notificationId}
              variant="outlined"
              component="button"
              type="button"
              onClick={() => openNotification(item)}
              disabled={item.isRead}
              sx={{
                p: 2,
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                cursor: item.isRead ? 'default' : 'pointer',
                bgcolor: item.isRead ? portra.surface : '#F0F4FF',
                borderLeft: `5px solid ${item.isRead ? portra.muted : portra.primary}`,
                transition: 'transform 180ms ease-out, box-shadow 180ms ease-out, border-color 180ms ease-out, background-color 180ms ease-out',
                '&:hover': item.isRead
                  ? {}
                  : {
                      transform: 'translateY(-2px)',
                      borderColor: 'rgba(13,47,178,.18)',
                      boxShadow: '0 18px 32px rgba(13,47,178,.09)'
                    },
                '&:active': item.isRead
                  ? {}
                  : {
                      transform: 'scale(.988)'
                    },
                '&:disabled': {
                  opacity: 0.98
                }
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Box sx={{ minWidth: 0, pr: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Badge color="primary" variant="dot" invisible={item.isRead} />
                    <Typography fontWeight={900}>{item.title}</Typography>
                  </Stack>
                  <Typography mt={0.5} sx={{ lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                    {item.content}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {item.type} · {formatDateTime(item.createdAt)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                  {item.isRead ? '已读' : '点按即已读'}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <EmptyState text={loading ? '正在加载通知...' : '暂无通知'} />
      )}
    </Stack>
  )
}
