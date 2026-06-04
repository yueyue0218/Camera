import { useEffect, useState } from 'react'
import { Alert, Stack } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi, orderApi } from '../../api.js'
import { ConversationList } from './components/ConversationList.jsx'
import { MessagesSectionHeader } from './components/MessagesSectionHeader.jsx'
import {
  getConversationRecordsForUser,
  mergeConversationRecords
} from './utils/conversationUtils.js'
import { getCWorkbenchErrorText } from './utils/quoteUtils.js'
import {
  filterConversationsByActiveRole,
  filterOrdersByActiveRole,
  getCurrentUserId,
  selectConversationOrder
} from './utils/workbenchState.js'

export function MessagesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [conversations, setConversations] = useState([])
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const value = new URLSearchParams(location.search).get('conversationId')
    if (value) {
      navigate(`/messages/${value}`, { replace: true })
      return
    }
    let mounted = true
    async function loadConversations() {
      setNotice(null)
      try {
        const [remoteConversations, remoteOrders] = await Promise.all([
          conversationApi.list(currentUser),
          orderApi.list({ role: currentUser.role === 'PROVIDER' ? 'provider' : 'customer' }, currentUser)
        ])
        if (mounted) {
          const conversationsForRole = filterConversationsByActiveRole(
            mergeConversationRecords(remoteConversations || [], currentUser, currentUser.role),
            currentUser,
            currentUser.role
          )
          const ordersForRole = filterOrdersByActiveRole(remoteOrders || [], currentUser, currentUser.role)
          setConversations(conversationsForRole.map(conversation => ({
            ...conversation,
            activeOrder: selectConversationOrder(ordersForRole, conversation, [])
          })))
        }
      } catch (error) {
        if (!mounted) return
        setNotice({ type: 'warning', text: `${getCWorkbenchErrorText(error, '暂时无法加载最新会话。')} 已先显示本地会话记录。` })
        setConversations(getConversationRecordsForUser(currentUser, currentUser.role))
      }
    }
    loadConversations()
    return () => {
      mounted = false
    }
  }, [getCurrentUserId(currentUser), currentUser.role, currentUser.token, location.search, navigate])

  return (
    <Stack spacing={2.5}>
      <MessagesSectionHeader title="会话" subtitle="查看正在沟通的拍摄邀约、报价和订单进展。" />
      {location.state?.roleMismatch && <Alert severity="info">这条会话属于另一身份视角，请切换身份后查看。</Alert>}
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <ConversationList
        conversations={conversations}
        currentUser={currentUser}
        onOpenConversation={conversationId => navigate(`/messages/${conversationId}`)}
      />
    </Stack>
  )
}
