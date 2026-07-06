import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, Stack } from '@mui/material'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi, orderApi } from '../../api.js'
import { navigateToConversation, setLastMessageSurface } from '../../utils/conversationNavigation.js'
import { useWorkflowNavigate } from '../../hooks/useWorkflowNavigate.js'
import { PortraPageFrame } from '../../components/portra/index.js'
import { ConversationList } from './components/ConversationList.jsx'
import { MessagesSectionHeader } from './components/MessagesSectionHeader.jsx'
import {
  getConversationRecordsForUser,
  isDisplayableConversationRecord,
  mergeConversationRecords,
  saveConversationRecord
} from './utils/conversationUtils.js'
import { getCWorkbenchErrorText } from './utils/quoteUtils.js'
import {
  filterConversationsByActiveRole,
  filterOrdersByActiveRole,
  getCurrentUserId,
  selectConversationOrder
} from './utils/workbenchState.js'
import { PORTRA_COLORS, PORTRA_RADII } from './MessageVisualTokens.js'

export function MessagesPage() {
  const location = useLocation()
  const navigate = useWorkflowNavigate()
  const { currentUser } = useAuth()
  const currentUserId = getCurrentUserId(currentUser)
  const currentUserRole = currentUser?.role || ''
  const currentUserToken = currentUser?.token || ''
  const requestUser = useMemo(() => currentUser ? {
    userId: currentUserId,
    role: currentUserRole,
    token: currentUserToken
  } : null, [currentUserId, currentUserRole, currentUserToken])
  const [conversations, setConversations] = useState(() => getConversationRecordsForUser(requestUser, currentUserRole))
  const [notice, setNotice] = useState(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const lastKnownConversationsRef = useRef(conversations)
  const loadingRef = useRef(false)
  const requestVersionRef = useRef(0)

  useEffect(() => {
    const value = new URLSearchParams(location.search).get('conversationId')
    if (value) {
      navigate(`/messages/${value}`, { replace: true })
      return
    }
    setLastMessageSurface('list')
  }, [location.search, navigate])

  useEffect(() => {
    const initialConversations = getConversationRecordsForUser(requestUser, currentUserRole)
    lastKnownConversationsRef.current = initialConversations
    setConversations(initialConversations)
    setNotice(null)
  }, [requestUser, currentUserRole])

  const applyNotice = useCallback(nextNotice => {
    setNotice(previous => {
      if (!nextNotice) return previous ? null : previous
      if (previous?.key === nextNotice.key && previous?.text === nextNotice.text) return previous
      return nextNotice
    })
  }, [])

  const loadConversations = useCallback(async () => {
    if (!requestUser || !currentUserId || !currentUserRole || loadingRef.current) return
    loadingRef.current = true
    const requestVersion = requestVersionRef.current + 1
    requestVersionRef.current = requestVersion
    try {
      const [conversationResult, orderResult] = await Promise.allSettled([
        conversationApi.list(requestUser),
        orderApi.list({ role: currentUserRole === 'PROVIDER' ? 'provider' : 'customer' }, requestUser)
      ])

      if (requestVersionRef.current !== requestVersion) return

      if (conversationResult.status === 'fulfilled') {
        const conversationsForRole = filterConversationsByActiveRole(
          mergeConversationRecords(conversationResult.value || [], requestUser, currentUserRole),
          requestUser,
          currentUserRole
        )
        const ordersForRole = orderResult.status === 'fulfilled'
          ? filterOrdersByActiveRole(orderResult.value || [], requestUser, currentUserRole)
          : []
        const baseConversations = conversationsForRole.map(conversation => ({
          ...conversation,
          activeOrder: selectConversationOrder(ordersForRole, conversation, [])
        }))
        const nextConversations = await hydrateConversationPreviews(baseConversations, requestUser)
        if (requestVersionRef.current !== requestVersion) return
        lastKnownConversationsRef.current = nextConversations
        setConversations(nextConversations)
        applyNotice(orderResult.status === 'rejected'
          ? buildMessageListNotice(orderResult.reason, 'orders')
          : null)
        return
      }

      const fallbackConversations = lastKnownConversationsRef.current.length
        ? lastKnownConversationsRef.current
        : getConversationRecordsForUser(requestUser, currentUserRole)
      lastKnownConversationsRef.current = fallbackConversations
      setConversations(previous => previous.length ? previous : fallbackConversations)
      applyNotice(buildMessageListNotice(conversationResult.reason, 'conversations'))
    } finally {
      loadingRef.current = false
    }
  }, [applyNotice, currentUserId, currentUserRole, requestUser])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('conversationId')) return undefined
    let mounted = true
    loadConversations().catch(error => {
      if (mounted) applyNotice(buildMessageListNotice(error, 'conversations'))
    })
    return () => {
      mounted = false
    }
  }, [applyNotice, loadConversations, location.search, retryVersion])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('conversationId')) return undefined
    if (!requestUser || !currentUserId || !currentUserRole) return undefined
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      loadConversations().catch(error => applyNotice(buildMessageListNotice(error, 'conversations')))
    }
    const intervalId = window.setInterval(refresh, 12000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [applyNotice, currentUserId, currentUserRole, loadConversations, location.search, requestUser])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('conversationId')) return undefined
    if (!requestUser || !currentUserId || !currentUserRole) return undefined

    const reportPresence = active => {
      conversationApi.reportPresence(null, active, requestUser, active ? {} : { keepalive: true }).catch(() => {})
    }

    reportPresence(true)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') reportPresence(true)
    }, 8000)
    const handleVisibilityChange = () => {
      reportPresence(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      reportPresence(false)
    }
  }, [currentUserId, currentUserRole, location.search, requestUser])

  const handleRetry = useCallback(() => {
    setRetryVersion(version => version + 1)
  }, [])

  return (
    <PortraPageFrame component={Stack} spacing={2} maxWidth={1120} sx={{ color: PORTRA_COLORS.ink }}>
      <MessagesSectionHeader title="消息" subtitle="管理正在沟通的约拍、报价和作品进展" />
      <Box>
        {location.state?.roleMismatch && <Alert severity="info" sx={noticeSx}>这条沟通属于另一身份视角，请切换身份后查看。</Alert>}
        {notice && (
          <Alert
            severity={notice.type}
            sx={noticeSx}
            action={<Button color="inherit" size="small" onClick={handleRetry}>重试</Button>}
          >
            {notice.text}
          </Alert>
        )}
      </Box>
      <ConversationList
        conversations={conversations}
        currentUser={currentUser}
        onOpenConversation={conversationId => navigateToConversation(navigate, conversationId)}
      />
    </PortraPageFrame>
  )
}

const noticeSx = {
  py: 0.4,
  borderRadius: PORTRA_RADII.control,
  border: `1px solid ${PORTRA_COLORS.borderMuted}`,
  bgcolor: PORTRA_COLORS.paper,
  '& .MuiAlert-message': { py: 0.4 }
}

async function hydrateConversationPreviews(conversations, currentUser) {
  if (!Array.isArray(conversations) || !conversations.length) return []
  const entries = await Promise.allSettled(conversations.map(async conversation => {
    if (conversation.isLocal) return conversation
    const backendConversationId = conversation.backendConversationId || conversation.conversationId
    const [messageResult, quoteResult] = await Promise.allSettled([
      conversationApi.messages(backendConversationId, currentUser),
      conversationApi.quotes(backendConversationId, currentUser)
    ])
    const messages = messageResult.status === 'fulfilled' && Array.isArray(messageResult.value)
      ? messageResult.value
      : []
    const quotes = quoteResult.status === 'fulfilled' && Array.isArray(quoteResult.value)
      ? quoteResult.value
      : []
    const latestMessage = [...messages]
      .filter(Boolean)
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0] || null
    const latestQuote = [...quotes]
      .filter(Boolean)
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0))[0] || null
    const updatedAt = latestMessage?.createdAt
      || latestQuote?.updatedAt
      || latestQuote?.createdAt
      || conversation.activeOrder?.updatedAt
      || conversation.updatedAt
    const nextConversation = {
      ...conversation,
      latestMessage,
      lastMessageObject: latestMessage,
      latestMessageSenderId: latestMessage?.senderId ?? conversation.latestMessageSenderId ?? null,
      latestQuotes: quotes,
      updatedAt
    }
    if (!isDisplayableConversationRecord(nextConversation)) return null
    saveConversationRecord(nextConversation, {
      latestMessage,
      lastMessageObject: latestMessage,
      latestMessageSenderId: latestMessage?.senderId ?? null,
      latestQuotes: quotes,
      updatedAt
    })
    return nextConversation
  }))
  return entries
    .map((entry, index) => entry.status === 'fulfilled' ? entry.value : conversations[index])
    .filter(isDisplayableConversationRecord)
}

function buildMessageListNotice(error, scope) {
  const status = Number(error?.status)
  const code = Number(error?.code)
  const message = error?.message || ''
  const sourceLabel = scope === 'orders' ? '订单关联信息' : '消息列表'

  if (error?.isNetworkError || message.includes('Failed to fetch') || message.includes('Network Error')) {
    return {
      key: `${scope}:network`,
      type: 'warning',
      text: `暂时无法连接服务器，已保留当前${sourceLabel}。`
    }
  }

  if (status === 401 || status === 403 || code === 40101 || code === 40301) {
    return {
      key: `${scope}:auth:${status || code}`,
      type: 'error',
      text: '登录状态已失效或当前身份无权查看消息，请重新登录或切换正确身份后重试。'
    }
  }

  if (code === 50001 || status >= 500) {
    const isSchemaError = message.includes('Unknown column') || message.includes('Table') || message.includes('JDBC exception')
    return {
      key: `${scope}:${isSchemaError ? 'schema' : 'server'}`,
      type: 'error',
      text: isSchemaError
        ? '服务器数据库结构与当前代码不一致，已保留当前消息列表。请先执行仓库里的数据库初始化或迁移脚本后重试。'
        : `服务器暂时无法返回最新${sourceLabel}，已保留当前显示内容。`
    }
  }

  return {
    key: `${scope}:unknown:${status || code || 'unknown'}`,
    type: 'warning',
    text: `${getCWorkbenchErrorText(error, `暂时无法加载最新${sourceLabel}。`)} 已保留当前显示内容。`
  }
}
