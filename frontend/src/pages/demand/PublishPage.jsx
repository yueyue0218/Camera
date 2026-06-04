import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { demandApi } from '../../api.js'
import { DemandForm } from './components/DemandForm.jsx'
import { buildDemandPayload, createDefaultDemandForm } from './utils/publishFormUtils.js'
import '../portraHall.css'

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
      navigate('/hall?tab=demand')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  function saveDraft() {
    window.localStorage.setItem('portra-demand-draft', JSON.stringify(form))
    setNotice({ type: 'success', text: '草稿已保存到本地' })
  }

  if (currentUser.role !== 'CUSTOMER') {
    return (
      <main className="portra-page">
        <Alert severity="info">请切换为单主身份后发布需求。</Alert>
      </main>
    )
  }

  return (
    <main className="portra-page">
      <div className="crumb">
        <button className="back" type="button" onClick={() => navigate('/hall')}>← 返回约拍大厅</button>
        <span>把你想拍的内容写成清楚的约拍票据</span>
      </div>
      {notice && <Alert severity={notice.type} className="form-alert">{notice.text}</Alert>}
      <DemandForm form={form} onChange={updateFormField} onSubmit={submit} onSaveDraft={saveDraft} />
    </main>
  )
}
