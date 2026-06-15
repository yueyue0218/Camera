import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { usePortraFeedback } from '../../components/portra/index.js'
import { demandApi } from '../../api.js'
import { fileApi } from '../../api/fileApi.js'
import { prepareImageFilesForUpload } from '../../utils/imageUploadValidation.js'
import { DemandForm } from './components/DemandForm.jsx'
import { buildDemandPayload, createDefaultDemandForm, demandDetailToForm, validateDemandForm } from './utils/publishFormUtils.js'
import '../portraHall.css'

function sameId(a, b) {
  return a !== undefined && a !== null && b !== undefined && b !== null && Number(a) === Number(b)
}

export function PublishPage() {
  const navigate = useNavigate()
  const { demandId } = useParams()
  const { currentUser } = useAuth()
  const feedback = usePortraFeedback()
  const editMode = Boolean(demandId)
  const [notice, setNotice] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(editMode)
  const [blocked, setBlocked] = useState(false)
  const [form, setForm] = useState(createDefaultDemandForm)

  useEffect(() => {
    if (!editMode) return
    let ignored = false
    async function loadDemand() {
      setLoading(true)
      setNotice(null)
      setBlocked(false)
      try {
        const detail = await demandApi.detail(demandId, currentUser)
        if (!ignored) {
          if (!sameId(detail?.customerId, currentUser.userId)) {
            setNotice({ type: 'error', text: '只有需求发布者本人可以编辑需求' })
            setBlocked(true)
          } else {
            setForm(demandDetailToForm(detail))
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
    loadDemand()
    return () => { ignored = true }
  }, [currentUser, demandId, editMode])

  function updateFormField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setNotice(null)
    const errors = validateDemandForm(form)
    if (errors.length) {
      setNotice({ type: 'warning', text: errors.join('; ') })
      return
    }
    try {
      const payload = buildDemandPayload(form)
      const result = editMode
        ? await demandApi.update(demandId, payload, currentUser)
        : await demandApi.create(payload, currentUser)
      setNotice({ type: 'success', text: editMode ? '需求已保存' : '需求已发布' })
      navigate(editMode ? `/demands/${result?.demandId || demandId}` : '/hall?tab=demand')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function uploadReferenceFiles(files) {
    const currentCount = Array.isArray(form.referenceFileIds) ? form.referenceFileIds.length : 0
    const { filesToUpload, error, warning } = prepareImageFilesForUpload(files, currentCount)
    if (error) {
      feedback.error(error)
      setNotice({ type: 'error', text: error })
      return
    }
    if (!filesToUpload.length) return
    if (warning) feedback.warning(warning)
    setUploading(true)
    setNotice(null)
    try {
      const previewUrls = filesToUpload.map(file => URL.createObjectURL(file))
      const uploaded = await fileApi.uploadImagesBatch(filesToUpload, {
        bizType: 'DEMAND_REFERENCE',
        visibility: 'PUBLIC'
      }, currentUser)
      setForm(current => ({
        ...current,
        referenceFileIds: [
          ...(Array.isArray(current.referenceFileIds) ? current.referenceFileIds : []),
          ...uploaded.map(item => item.fileId).filter(Boolean)
        ],
        referenceFileNames: [
          ...(Array.isArray(current.referenceFileNames) ? current.referenceFileNames : []),
          ...uploaded.map(item => item.originalName).filter(Boolean)
        ],
        referencePreviewUrls: [
          ...(Array.isArray(current.referencePreviewUrls) ? current.referencePreviewUrls : []),
          ...previewUrls
        ]
      }))
      const successText = warning || '参考图已上传'
      feedback.success(successText)
      setNotice({ type: 'success', text: successText })
    } catch (error) {
      console.error('demand reference image upload failed', { error })
      const message = error.message || '上传失败，请稍后重试'
      feedback.error(message)
      setNotice({ type: 'error', text: message })
    } finally {
      setUploading(false)
    }
  }

  function removeReferenceFile(index) {
    setForm(current => ({
      ...current,
      referenceFileIds: (current.referenceFileIds || []).filter((_, itemIndex) => itemIndex !== index),
      referenceFileNames: (current.referenceFileNames || []).filter((_, itemIndex) => itemIndex !== index),
      referencePreviewUrls: (current.referencePreviewUrls || []).filter((_, itemIndex) => itemIndex !== index)
    }))
  }

  function saveDraft() {
    window.localStorage.setItem('portra-demand-draft', JSON.stringify(form))
    setNotice({ type: 'success', text: '草稿已保存到本地' })
  }

  if (currentUser.role !== 'CUSTOMER') {
    return (
      <main className="portra-page">
        <Alert severity="info">请切换为单主身份后{editMode ? '编辑' : '发布'}需求。</Alert>
      </main>
    )
  }

  return (
    <main className="portra-page">
      <div className="crumb">
        <button className="back" type="button" onClick={() => navigate('/hall')}>← 返回大厅</button>
        <span>{editMode ? '编辑后会调用后端需求更新接口并刷新详情时间' : '把你想拍的内容写成清楚的约拍票据'}</span>
      </div>
      {notice && <Alert severity={notice.type} className="form-alert">{notice.text}</Alert>}
      {loading ? <Alert severity="info">正在加载需求详情...</Alert> : !blocked && <DemandForm
        form={form}
        uploading={uploading}
        onChange={updateFormField}
        onSubmit={submit}
        onSaveDraft={saveDraft}
        onFilesSelected={uploadReferenceFiles}
        onRemoveFile={removeReferenceFile}
        mode={editMode ? 'edit' : 'create'}
      />}
    </main>
  )
}
