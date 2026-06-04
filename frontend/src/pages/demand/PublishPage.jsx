import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { demandApi } from '../../api.js'
import { fileApi } from '../../api/fileApi.js'
import { DemandForm } from './components/DemandForm.jsx'
import { buildDemandPayload, createDefaultDemandForm } from './utils/publishFormUtils.js'
import '../portraHall.css'

export function PublishPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [notice, setNotice] = useState(null)
  const [uploading, setUploading] = useState(false)
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

  async function uploadReferenceFiles(files) {
    const selectedFiles = Array.from(files || []).filter(Boolean)
    if (!selectedFiles.length) return
    setUploading(true)
    setNotice(null)
    try {
      const uploaded = await Promise.all(selectedFiles.map(file => fileApi.upload(file, {
        bizType: 'DEMAND_REFERENCE',
        visibility: 'PUBLIC'
      }, currentUser)))
      setForm(current => ({
        ...current,
        referenceFileIds: [
          ...(Array.isArray(current.referenceFileIds) ? current.referenceFileIds : []),
          ...uploaded.map(item => item.fileId).filter(Boolean)
        ],
        referenceFileNames: [
          ...(Array.isArray(current.referenceFileNames) ? current.referenceFileNames : []),
          ...uploaded.map(item => item.originalName).filter(Boolean)
        ]
      }))
      setNotice({ type: 'success', text: '参考图已上传' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setUploading(false)
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
      <DemandForm
        form={form}
        uploading={uploading}
        onChange={updateFormField}
        onSubmit={submit}
        onSaveDraft={saveDraft}
        onFilesSelected={uploadReferenceFiles}
      />
    </main>
  )
}
