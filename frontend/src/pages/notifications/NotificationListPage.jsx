import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Chip, Collapse, Paper, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material'
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { useNavigate } from 'react-router-dom'
import { notificationApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, Feedback, PageHeader, formatDateTime, portra } from '../dline/shared.jsx'

const TAB_DEFINITIONS = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'order', label: '订单' },
  { key: 'appeal', label: '申诉' },
  { key: 'review', label: '评价' },
  { key: 'dynamic', label: '动态' }
]

const ORDER_EVENTS = ['ORDER_', 'DEMAND_RESPONSE_', 'CONVERSATION_STARTED', 'DELIVERY_UPLOADED']
const REVIEW_EVENTS = ['REVIEW_']
const APPEAL_EVENTS = ['REVIEW_COMPLAINT_', 'DISPUTE']
const DYNAMIC_EVENTS = ['MOMENT_LIKED', 'FOLLOWED']
const PORTRA_STATE_EVENT = 'portra-preview-state'

function notificationErrorText(action) {
  if (action === 'load') return '通知暂时加载失败，请稍后再试。'
  if (action === 'read') return '这条通知暂时处理失败，请稍后再试。'
  if (action === 'read-all') return '全部已读暂时没成功，请稍后再试。'
  return '通知暂时处理失败，请稍后再试。'
}

function countUnreadNotifications(items = []) {
  return items.filter(item => !item?.isRead).length
}

function broadcastNotificationState(unreadCount, ring = false) {
  window.dispatchEvent(new CustomEvent(PORTRA_STATE_EVENT, {
    detail: { unreadCount, ring }
  }))
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase()
}

function parseMetadata(metadataJson) {
  if (!metadataJson) return null
  try {
    return JSON.parse(metadataJson)
  } catch {
    return null
  }
}

function typeTokens(item) {
  return [
    normalizeText(item?.type),
    normalizeText(item?.eventType),
    normalizeText(item?.relatedType),
    normalizeText(item?.targetType),
    normalizeText(item?.sourceType)
  ]
}

function hasToken(item, tokens) {
  const values = typeTokens(item)
  return tokens.some(token => values.some(value => value.includes(token)))
}

function isAppealNotification(item) {
  return hasToken(item, APPEAL_EVENTS)
}

function isOrderNotification(item) {
  return hasToken(item, ORDER_EVENTS)
}

function isReviewNotification(item) {
  return hasToken(item, REVIEW_EVENTS) && !isAppealNotification(item)
}

function isDynamicNotification(item) {
  const values = typeTokens(item)
  return values.some(value => DYNAMIC_EVENTS.includes(value) || value.includes('MOMENT'))
}

function getNotificationCategory(item) {
  if (isAppealNotification(item)) return 'appeal'
  if (isOrderNotification(item)) return 'order'
  if (isReviewNotification(item)) return 'review'
  if (isDynamicNotification(item)) return 'dynamic'
  return 'all'
}

function getMetadata(item) {
  return parseMetadata(item?.metadataJson) || {}
}

function resolveTypeLabel(item) {
  const type = normalizeText(item?.type)
  const eventType = normalizeText(item?.eventType)
  const relatedType = normalizeText(item?.relatedType)

  if (APPEAL_EVENTS.some(token => type.includes(token) || eventType.includes(token) || relatedType.includes(token))) return '申诉'
  if (type.includes('DEMAND_RESPONSE') || eventType.includes('DEMAND_RESPONSE') || type.includes('CONVERSATION_STARTED')) return '约拍'
  if (type.includes('MESSAGE') || eventType.includes('MESSAGE') || type.includes('CONVERSATION') || eventType.includes('CONVERSATION')) return '消息'
  if (ORDER_EVENTS.some(token => type.includes(token) || eventType.includes(token) || relatedType.includes(token))) return '订单'
  if (REVIEW_EVENTS.some(token => type.includes(token) || eventType.includes(token) || relatedType.includes(token))) return '评价'
  if (DYNAMIC_EVENTS.some(token => type.includes(token) || eventType.includes(token) || relatedType.includes(token))) return '动态'
  if (type.includes('CREDIT') || eventType.includes('CREDIT')) return '信用'
  if (type.includes('FOLLOWED') || eventType.includes('FOLLOWED')) return '关注'
  return '通知'
}

function buildDynamicGroups(items) {
  const groups = new Map()
  const looseItems = []

  items.forEach(item => {
    const type = normalizeText(item?.type)
    const eventType = normalizeText(item?.eventType)
    const relatedType = normalizeText(item?.relatedType)
    const isFoldableMomentLike = (type === 'MOMENT_LIKED' || eventType === 'MOMENT_LIKED' || relatedType.includes('MOMENT')) && item?.relatedId != null

    if (!isFoldableMomentLike) {
      looseItems.push(item)
      return
    }

    const key = `moment:${item.relatedId}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        relatedId: item.relatedId,
        title: item.title || '动态互动',
        preview: item.content || '',
        items: []
      })
    }

    const group = groups.get(key)
    group.items.push(item)
    if (!group.preview && item.content) {
      group.preview = item.content
    }
  })

  return {
    groups: [...groups.values()].map(group => ({
      ...group,
      unreadCount: group.items.filter(entry => !entry.isRead).length
    })),
    looseItems
  }
}

function resolveNotificationTarget(item) {
  if (item?.navigationPath?.startsWith('/')) return item.navigationPath

  const metadata = getMetadata(item)
  const type = normalizeText(item?.type)
  const eventType = normalizeText(item?.eventType)
  const relatedId = item?.relatedId ?? item?.targetId ?? item?.sourceId ?? null

  if (isAppealNotification(item)) {
    return relatedId ? `/review-complaints/${relatedId}` : '/reviews'
  }

  if (type.includes('DEMAND_RESPONSE') || eventType.includes('DEMAND_RESPONSE')) {
    if (metadata.conversationId) return `/messages/${metadata.conversationId}`
    if (metadata.demandId) return `/demands/${metadata.demandId}`
    return '/hall?tab=demand'
  }

  if (type.includes('CONVERSATION_STARTED') || eventType.includes('CONVERSATION_STARTED')) {
    if (metadata.conversationId) return `/messages/${metadata.conversationId}`
    if (metadata.demandId) return `/demands/${metadata.demandId}`
    return '/messages'
  }

  if (isOrderNotification(item)) {
    const orderId = metadata.orderId ?? item?.targetId ?? item?.relatedId ?? item?.sourceId
    return orderId ? `/orders?orderId=${orderId}` : '/orders'
  }

  if (isReviewNotification(item)) {
    const orderId = metadata.orderId
    return orderId ? `/orders/${orderId}/reviews` : '/reviews'
  }

  if (type.includes('CREDIT') || eventType.includes('CREDIT')) {
    return '/profile/credit'
  }

  if (type.includes('FOLLOWED') || eventType.includes('FOLLOWED')) {
    const userId = item?.sourceId ?? item?.actorUserId ?? item?.relatedId ?? null
    return userId ? `/users/${userId}` : ''
  }

  if (type.includes('MOMENT') || eventType.includes('MOMENT')) {
    return relatedId ? `/moments/${relatedId}` : ''
  }

  if (type.includes('USER') || eventType.includes('USER')) {
    return relatedId ? `/users/${relatedId}` : ''
  }

  return ''
}

function NotificationCard({ item, compact = false, onClick }) {
  const typeLabel = resolveTypeLabel(item)

  return (
    <Paper
      variant="outlined"
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        p: compact ? 1.5 : 2,
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        cursor: 'pointer',
        bgcolor: item.isRead ? portra.surface : '#F0F4FF',
        borderLeft: `5px solid ${item.isRead ? portra.muted : portra.primary}`,
        transition: 'transform 180ms ease-out, box-shadow 180ms ease-out, border-color 180ms ease-out, background-color 180ms ease-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: 'rgba(13,47,178,.18)',
          boxShadow: '0 18px 32px rgba(13,47,178,.09)'
        },
        '&:active': {
          transform: 'scale(.988)'
        }
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Box sx={{ minWidth: 0, pr: 1, width: '100%' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Badge color="primary" variant="dot" invisible={item.isRead} />
            <Typography fontWeight={900}>{item.title}</Typography>
            {compact ? <Chip size="small" label={typeLabel} sx={{ height: 22 }} /> : null}
          </Stack>
          <Typography mt={0.5} sx={{ lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
            {item.content}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            {typeLabel} · {formatDateTime(item.createdAt)}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', alignSelf: { xs: 'flex-start', sm: 'center' } }}>
          {item.isRead ? '已读' : '点击即读'}
        </Typography>
      </Stack>
    </Paper>
  )
}

function NotificationLoadingState() {
  return (
    <Stack gap={1.5}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Paper
          key={index}
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 2.25 },
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            bgcolor: 'rgba(255,255,255,.88)',
            borderLeft: '5px solid rgba(13,47,178,.18)'
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box sx={{ minWidth: 0, width: '100%' }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Skeleton variant="circular" width={10} height={10} />
                <Skeleton variant="rounded" width={96} height={22} />
              </Stack>
              <Skeleton variant="text" width="58%" height={34} />
              <Skeleton variant="text" width="92%" height={24} />
              <Skeleton variant="text" width="76%" height={24} />
              <Skeleton variant="text" width={160} height={20} sx={{ mt: 1 }} />
            </Box>
            <Skeleton variant="rounded" width={74} height={20} sx={{ flexShrink: 0 }} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

export function NotificationListPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        const data = await notificationApi.listMine(currentUser)
        if (!alive) return
        setItems(data)
        setFeedback({})
      } catch {
        if (alive) setFeedback({ error: notificationErrorText('load') })
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [currentUser])

  const counts = useMemo(() => {
    const summary = { all: items.length, unread: items.filter(item => !item.isRead).length, order: 0, appeal: 0, review: 0, dynamic: 0 }
    items.forEach(item => {
      const category = getNotificationCategory(item)
      if (category in summary) {
        summary[category] += 1
      }
    })
    return summary
  }, [items])

  const visibleItems = useMemo(() => {
    return items.filter(item => {
      if (activeTab === 'all') return true
      if (activeTab === 'unread') return !item.isRead
      return getNotificationCategory(item) === activeTab
    })
  }, [items, activeTab])

  const dynamicView = useMemo(() => buildDynamicGroups(visibleItems), [visibleItems])

  async function markRead(notificationId) {
    try {
      const updated = await notificationApi.markRead(notificationId, currentUser)
      const nextItems = items.map(item => (item.notificationId === notificationId ? updated : item))
      setItems(nextItems)
      setFeedback({ success: '通知已读' })
      broadcastNotificationState(countUnreadNotifications(nextItems))
      return updated
    } catch {
      setFeedback({ error: notificationErrorText('read') })
      return null
    }
  }

  async function markAllRead() {
    try {
      const updated = await notificationApi.markAllRead(currentUser)
      setItems(updated)
      setFeedback({ success: '全部通知已读' })
      broadcastNotificationState(countUnreadNotifications(updated))
    } catch {
      setFeedback({ error: notificationErrorText('read-all') })
    }
  }

  async function openNotification(item) {
    if (!item) return
    if (!item.isRead) {
      const updated = await markRead(item.notificationId)
      if (!updated) return
    }
    const target = resolveNotificationTarget(item)
    if (target) {
      navigate(target)
    }
  }

  function toggleGroup(key) {
    setExpandedGroups(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const emptyText = activeTab === 'all'
    ? (loading ? '正在加载通知...' : '暂无通知')
    : activeTab === 'unread'
      ? (loading ? '正在加载未读通知...' : '暂无未读通知')
      : loading
        ? '正在加载通知...'
        : `暂无${TAB_DEFINITIONS.find(tab => tab.key === activeTab)?.label || '通知'}`

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="消息中心"
        title="通知"
        description={counts.unread ? `${counts.unread} 条未读通知` : '当前没有未读通知'}
        action={<Button startIcon={<DoneAllRoundedIcon />} onClick={markAllRead} disabled={!counts.unread}>全部已读</Button>}
      />
      <Feedback {...feedback} />

      <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden', bgcolor: 'rgba(248,243,235,.9)' }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            pt: 1,
            '& .MuiTab-root': {
              minHeight: 60,
              textTransform: 'none',
              fontWeight: 800,
              letterSpacing: '.04em'
            }
          }}
        >
          {TAB_DEFINITIONS.map(tab => (
            <Tab
              key={tab.key}
              value={tab.key}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{tab.label}</span>
                  <Chip size="small" label={counts[tab.key] || 0} sx={{ height: 20 }} />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {loading ? (
        <NotificationLoadingState />
      ) : visibleItems.length ? (
        activeTab === 'dynamic' ? (
          <Stack gap={1.5}>
            {dynamicView.groups.map(group => {
              const open = expandedGroups.has(group.key)
              return (
                <Paper
                  key={group.key}
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    bgcolor: portra.surface,
                    borderColor: group.unreadCount ? 'rgba(13,47,178,.2)' : 'rgba(21,19,24,.12)'
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    sx={{
                      width: '100%',
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                      bgcolor: 'transparent',
                      border: 0,
                      p: 2,
                      cursor: 'pointer'
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography fontWeight={900}>{group.title}</Typography>
                          <Chip size="small" color={group.unreadCount ? 'primary' : 'default'} label={`${group.items.length} 条`} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" mt={0.75} sx={{ lineHeight: 1.75 }}>
                          {group.preview || '动态互动通知'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {group.unreadCount ? `${group.unreadCount} 条未读` : '全部已读'}
                        </Typography>
                        <ExpandMoreRoundedIcon
                          sx={{
                            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 160ms ease'
                          }}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                  <Collapse in={open} timeout="auto" unmountOnExit>
                    <Stack gap={1} sx={{ px: 2, pb: 2, pt: 0 }}>
                      {group.items.map(item => (
                        <NotificationCard
                          key={item.notificationId}
                          item={item}
                          compact
                          onClick={() => openNotification(item)}
                        />
                      ))}
                    </Stack>
                  </Collapse>
                </Paper>
              )
            })}

            {dynamicView.looseItems.map(item => (
              <NotificationCard
                key={item.notificationId}
                item={item}
                onClick={() => openNotification(item)}
              />
            ))}
          </Stack>
        ) : (
          <Stack gap={1.5}>
            {visibleItems.map(item => (
              <NotificationCard
                key={item.notificationId}
                item={item}
                onClick={() => openNotification(item)}
              />
            ))}
          </Stack>
        )
      ) : (
        <EmptyState text={emptyText} />
      )}
    </Stack>
  )
}
