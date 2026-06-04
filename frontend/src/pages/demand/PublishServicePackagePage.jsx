import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { fileApi } from '../../api/fileApi.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { ServicePackageForm } from './components/ServicePackageForm.jsx'
import {
  buildServicePackagePayload,
  createDefaultServicePackageForm,
  validateServicePackageForm
} from './utils/servicePackageFormUtils.js'
import '../portraHall.css'

const MAX_UPLOAD_IMAGES = 9

export function PublishServicePackagePage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [notice, setNotice] = useState(null)
  const [errors, setErrors] = useState([])
  const [uploading, setUploading] = useState(false)
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

  async function uploadPortfolioFiles(files) {
    const selectedFiles = Array.from(files || []).filter(Boolean)
    if (!selectedFiles.length) return
    const currentCount = Array.isArray(form.portfolioIds) ? form.portfolioIds.length : 0
    const remaining = MAX_UPLOAD_IMAGES - currentCount
    if (remaining <= 0) {
      setNotice({ type: 'error', text: `最多上传 ${MAX_UPLOAD_IMAGES} 张照片` })
      return
    }
    const filesToUpload = selectedFiles.slice(0, remaining)
    setUploading(true)
    setNotice(null)
    try {
      const previewUrls = filesToUpload.map(file => URL.createObjectURL(file))
      const uploaded = await Promise.all(filesToUpload.map(file => fileApi.upload(file, {
        bizType: 'SERVICE_PORTFOLIO',
        visibility: 'PUBLIC'
      }, currentUser)))
      setForm(current => ({
        ...current,
        portfolioIds: [
          ...(Array.isArray(current.portfolioIds) ? current.portfolioIds : []),
          ...uploaded.map(item => item.fileId).filter(Boolean)
        ],
        portfolioFileNames: [
          ...(Array.isArray(current.portfolioFileNames) ? current.portfolioFileNames : []),
          ...uploaded.map(item => item.originalName).filter(Boolean)
        ],
        portfolioPreviewUrls: [
          ...(Array.isArray(current.portfolioPreviewUrls) ? current.portfolioPreviewUrls : []),
          ...previewUrls
        ]
      }))
      setNotice({ type: 'success', text: selectedFiles.length > remaining ? `已上传前 ${remaining} 张，最多支持 ${MAX_UPLOAD_IMAGES} 张` : '作品图已上传' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setUploading(false)
    }
  }

  function removePortfolioFile(index) {
    setForm(current => ({
      ...current,
      portfolioIds: (current.portfolioIds || []).filter((_, itemIndex) => itemIndex !== index),
      portfolioFileNames: (current.portfolioFileNames || []).filter((_, itemIndex) => itemIndex !== index),
      portfolioPreviewUrls: (current.portfolioPreviewUrls || []).filter((_, itemIndex) => itemIndex !== index)
    }))
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
      <ServicePackageForm
        form={form}
        errors={errors}
        uploading={uploading}
        onChange={updateFormField}
        onSubmit={submit}
        onSaveDraft={saveDraft}
        onFilesSelected={uploadPortfolioFiles}
        onRemoveFile={removePortfolioFile}
      />
    </main>
  )
}
