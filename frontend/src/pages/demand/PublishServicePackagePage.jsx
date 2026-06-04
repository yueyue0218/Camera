import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { ServicePackageForm } from './components/ServicePackageForm.jsx'
import {
  buildServicePackagePayload,
  createDefaultServicePackageForm,
  validateServicePackageForm
} from './utils/servicePackageFormUtils.js'
import '../portraHall.css'

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

  function saveDraft() {
    window.localStorage.setItem('portra-service-package-draft', JSON.stringify(form))
    setNotice({ type: 'success', text: '草稿已保存到本地' })
  }

  if (currentUser.role !== 'PROVIDER') {
    return (
      <main className="portra-page">
        <Alert severity="info">请切换为摄影师身份后发布橱窗。</Alert>
      </main>
    )
  }

  return (
    <main className="portra-page">
      <div className="crumb">
        <button className="back" type="button" onClick={() => navigate('/hall')}>← 返回约拍大厅</button>
        <span>把作品、价格和档期整理成可预约的服务橱窗</span>
      </div>
      {notice && <Alert severity={notice.type} className="form-alert">{notice.text}</Alert>}
      <ServicePackageForm form={form} errors={errors} onChange={updateFormField} onSubmit={submit} onSaveDraft={saveDraft} />
    </main>
  )
}
