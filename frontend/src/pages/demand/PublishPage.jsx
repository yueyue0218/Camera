import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Stack } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { demandApi } from '../../api.js'
import { DemandForm } from './components/DemandForm.jsx'
import { PublishHeader } from './components/PublishHeader.jsx'
import { buildDemandPayload, createDefaultDemandForm } from './utils/publishFormUtils.js'

export function PublishPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState(createDefaultDemandForm)

  function updateFormField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setNotice(null)
    try {
      await demandApi.create(buildDemandPayload(form), currentUser)
      setNotice({ type: 'success', text: '需求已发布' })
      navigate('/hall')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  if (currentUser.role !== 'CUSTOMER') {
    return (
      <Stack spacing={2}>
        <PublishHeader title="发布" subtitle="发布约拍需求需要使用需求方身份。" />
        <Alert severity="info">请到个人页切换为需求方。</Alert>
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5}>
      <PublishHeader title="发布" subtitle="填写约拍需求，服务方会在大厅中响应。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <DemandForm form={form} onChange={updateFormField} onSubmit={submit} />
    </Stack>
  )
}
