import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { fileApi } from '../../api/fileApi.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { ServicePackageForm } from './components/ServicePackageForm.jsx'
import {
  buildServicePackagePayload,
  createDefaultServicePackageForm,
  servicePackageDetailToForm,
  validateServicePackageForm
} from './utils/servicePackageFormUtils.js'
import '../portraHall.css'

const MAX_UPLOAD_IMAGES = 9

function sameId(a, b) {
  return a !== undefined && a !== null && b !== undefined && b !== null && Number(a) === Number(b)
}

export function PublishServicePackagePage() {
  const navigate = useNavigate()
  const { serviceId } = useParams()
  const { currentUser } = useAuth()
  const editMode = Boolean(serviceId)
  const [notice, setNotice] = useState(null)
  const [errors, setErrors] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(editMode)
  const [blocked, setBlocked] = useState(false)
  const [form, setForm] = useState(createDefaultServicePackageForm)

  useEffect(() => {
    if (!editMode) return
    let ignored = false
    async function loadService() {
      setLoading(true)
      setNotice(null)
      setBlocked(false)
      try {
        const detail = await servicePackageApi.detail(serviceId, currentUser)
        if (!ignored) {
          if (!sameId(detail?.providerId, currentUser.userId) && !sameId(detail?.photographerId, currentUser.userId)) {
            setNotice({ type: 'error', text: '只有橱窗发布者本人可以编辑橱窗' })
            setBlocked(true)
          } else {
            setForm(servicePackageDetailToForm(detail))
          }
          setLoading(false)
        }
      } catch (error) {
        if (!ignored) {
          setNotice({ type: 'error', text: error.message })
          setLoading(false)
        }
      }
    }
    loadService()
    return () => { ignored = true }
  }, [currentUser, editMode, serviceId])

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
      const payload = buildServicePackagePayload(form)
      const result = editMode
        ? await servicePackageApi.update(serviceId, payload, currentUser)
        : await servicePackageApi.create(payload, currentUser)
      setNotice({ type: 'success', text: editMode ? '橱窗已保存' : '橱窗已发布' })
      navigate(editMode ? `/service-packages/${result?.serviceId || serviceId}` : '/hall?tab=showcase')
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
        <Alert severity="info">请切换为摄影师身份后{editMode ? '编辑' : '发布'}橱窗。</Alert>
      </main>
    )
  }

  return (
    <main className="portra-page">
      <div className="crumb">
        <button className="back" type="button" onClick={() => navigate('/hall')}>← 返回大厅</button>
        <span>{editMode ? '编辑后会调用后端橱窗更新接口并刷新详情时间' : '把作品、价格和档期整理成可预约的服务橱窗'}</span>
      </div>
      {notice && <Alert severity={notice.type} className="form-alert">{notice.text}</Alert>}
      {loading ? <Alert severity="info">正在加载橱窗详情...</Alert> : !blocked && <ServicePackageForm
        form={form}
        errors={errors}
        uploading={uploading}
        onChange={updateFormField}
        onSubmit={submit}
        onSaveDraft={saveDraft}
        onFilesSelected={uploadPortfolioFiles}
        onRemoveFile={removePortfolioFile}
        mode={editMode ? 'edit' : 'create'}
      />}
    </main>
  )
}
