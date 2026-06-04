import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Stack } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { PublishHeader } from './components/PublishHeader.jsx'
import { ServicePackageForm } from './components/ServicePackageForm.jsx'
import {
  buildServicePackagePayload,
  createDefaultServicePackageForm,
  validateServicePackageForm
} from './utils/servicePackageFormUtils.js'

export function PublishServicePackagePage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [notice, setNotice] = useState(null)
  const [errors, setErrors] = useState([])
  const [form, setForm] = useState(createDefaultServicePackageForm)

  function updateFormField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setNotice(null)
    const nextErrors = validateServicePackageForm(form)
    setErrors(nextErrors)
    if (nextErrors.length) return

    try {
      await servicePackageApi.create(buildServicePackagePayload(form), currentUser)
      setNotice({ type: 'success', text: '橱窗已发布' })
      navigate('/hall?tab=showcase')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  if (currentUser.role !== 'PROVIDER') {
    return (
      <Stack spacing={2}>
        <PublishHeader title="发布橱窗" subtitle="发布服务橱窗需要使用服务方身份。" />
        <Alert severity="info">请到个人页切换为服务方。</Alert>
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5}>
      <PublishHeader title="发布橱窗" subtitle="填写服务橱窗信息，需求方可以在橱窗大厅查看并发起沟通。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <ServicePackageForm form={form} errors={errors} onChange={updateFormField} onSubmit={submit} />
    </Stack>
  )
}
