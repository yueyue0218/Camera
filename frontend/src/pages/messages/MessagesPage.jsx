import { useEffect, useState } from 'react'
import { Alert, Box, Stack } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi, orderApi } from '../../api.js'
import { navigateToConversation } from '../../utils/conversationNavigation.js'
import { PortraPageFrame } from '../../components/portra/index.js'
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
import { PORTRA_COLORS, PORTRA_RADII } from './MessageVisualTokens.js'

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
        setNotice({ type: 'warning', text: `${getCWorkbenchErrorText(error, '暂时无法加载最新沟通。')} 已先显示本地沟通记录。` })
        setConversations(getConversationRecordsForUser(currentUser, currentUser.role))
      }
    }
    loadConversations()
    return () => {
      mounted = false
    }
  }, [getCurrentUserId(currentUser), currentUser.role, currentUser.token, location.search, navigate])

  return (
    <PortraPageFrame component={Stack} spacing={2} maxWidth={1120} sx={{ color: PORTRA_COLORS.ink }}>
      <MessagesSectionHeader title="消息" subtitle="管理正在沟通的约拍、报价和作品进展" />
      <Box>
        {location.state?.roleMismatch && <Alert severity="info" sx={noticeSx}>这条沟通属于另一身份视角，请切换身份后查看。</Alert>}
        {notice && <Alert severity={notice.type} sx={noticeSx}>{notice.text}</Alert>}
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
