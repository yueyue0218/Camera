import { useEffect, useState } from 'react'
import { Alert, Stack } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi } from '../../api.js'
import { ConversationList } from './components/ConversationList.jsx'
import { MessagesSectionHeader } from './components/MessagesSectionHeader.jsx'
import {
  getConversationRecordsForUser,
  mergeConversationRecords
} from './utils/conversationUtils.js'

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
        const remoteConversations = await conversationApi.list(currentUser)
        if (mounted) setConversations(mergeConversationRecords(remoteConversations || [], currentUser))
      } catch (error) {
        if (!mounted) return
        setNotice({ type: 'warning', text: `${error.message} 已先显示本地会话记录。` })
        setConversations(getConversationRecordsForUser(currentUser))
      }
    }
    loadConversations()
    return () => {
      mounted = false
    }
  }, [currentUser.userId, currentUser.role, currentUser.token, location.search, navigate])

  return (
    <Stack spacing={2.5}>
      <MessagesSectionHeader title="会话" subtitle="消息列表页只展示对话入口，点击后进入具体聊天框。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <ConversationList
        conversations={conversations}
        currentUser={currentUser}
        onOpenConversation={conversationId => navigate(`/messages/${conversationId}`)}
      />
    </Stack>
  )
}
