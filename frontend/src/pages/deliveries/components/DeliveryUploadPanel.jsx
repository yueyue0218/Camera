import { useRef, useState } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { FileDropzone } from './FileDropzone.jsx'
import { UploadQueue } from './UploadQueue.jsx'
import {
  createUploadItems,
  DELIVERY_UPLOAD_LIMITS,
  getDeliveryUploadFileType,
  validateDeliveryUploadFiles
} from './deliveryUploadModel.js'

export function DeliveryUploadPanel({
  mode = 'upload',
  value,
  loading = false,
  compact = false,
  onChange,
  onSubmit
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [errors, setErrors] = useState([])
  const [submitFailed, setSubmitFailed] = useState(false)
  const files = Array.isArray(value?.files) ? value.files : value?.file ? [value.file] : []
  const remark = value?.remark || ''
  const items = createUploadItems(files)
  const validFiles = items.filter(item => item.fileType !== 'UNSUPPORTED').map(item => item.file)
  const title = mode === 'rework' ? '重新上传返修作品' : '上传交付作品'
  const description = mode === 'rework'
    ? '请根据客户返修要求重新整理作品，本批文件会发送给客户再次验收。'
    : '这是给客户验收的本单成片，交付文件仅你和客户可见。'

  function updateFiles(nextFiles, nextErrors = []) {
    const normalized = dedupeFiles(nextFiles)
    const overflowCount = Math.max(0, normalized.length - DELIVERY_UPLOAD_LIMITS.maxFiles)
    const limited = normalized.slice(0, DELIVERY_UPLOAD_LIMITS.maxFiles)
    const combinedErrors = [
      ...nextErrors,
      ...(overflowCount ? [`一次最多上传 ${DELIVERY_UPLOAD_LIMITS.maxFiles} 个文件，已保留前 ${DELIVERY_UPLOAD_LIMITS.maxFiles} 个。`] : []),
      ...validateDeliveryUploadFiles(limited)
    ]
    setErrors(combinedErrors)
    setSubmitFailed(false)
    onChange?.({ files: limited, remark })
  }

  function appendFiles(fileList) {
    const incoming = Array.from(fileList || [])
    const existingKeys = new Set(files.map(getFileKey))
    const accepted = []
    const rejected = []
    incoming.forEach(file => {
      const fileType = getDeliveryUploadFileType(file)
      if (existingKeys.has(getFileKey(file)) || accepted.some(item => getFileKey(item) === getFileKey(file))) {
        rejected.push(`${file.name || '这个文件'} 已在队列中，已跳过重复文件。`)
        return
      }
      const error = getFileError(file, fileType)
      if (error) {
        rejected.push(error)
        return
      }
      accepted.push(file)
    })
    updateFiles([...files, ...accepted], rejected)
  }

  function removeItem(itemId) {
    const nextFiles = items.filter(item => item.id !== itemId).map(item => item.file)
    const nextErrors = validateDeliveryUploadFiles(nextFiles)
    setErrors(nextErrors)
    setSubmitFailed(false)
    onChange?.({ files: nextFiles, remark })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateDeliveryUploadFiles(files)
    setErrors(nextErrors)
    if (nextErrors.length || !validFiles.length) return
    setSubmitFailed(false)
    const succeeded = await onSubmit?.()
    if (!succeeded) setSubmitFailed(true)
  }

  function handleDrag(event) {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    if (event.type === 'dragenter' || event.type === 'dragover') setDragging(true)
    if (event.type === 'dragleave') setDragging(false)
  }

  function handleDrop(event) {
    handleDrag(event)
    setDragging(false)
    appendFiles(event.dataTransfer?.files)
  }

  return (
    <Stack component="form" spacing={compact ? 1.25 : 1.6} onSubmit={handleSubmit}>
      <Stack spacing={0.65}>
        <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: compact ? 18 : 22, fontWeight: 950 }}>
          {title}
        </Typography>
          <Typography sx={{ color: PORTRA_SURFACE.muted, lineHeight: 1.7 }}>
          {description}
        </Typography>
        <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center', color: PORTRA_SURFACE.portraBlue }}>
          <LockRoundedIcon sx={{ fontSize: 17 }} />
          <Typography sx={{ fontSize: 13.5, fontWeight: 850 }}>这些文件只会发送给本单客户验收，不会公开展示。</Typography>
        </Stack>
      </Stack>

      <FileDropzone
        dragging={dragging}
        disabled={loading}
        onBrowse={() => inputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      />
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.zip,image/jpeg,image/png,image/webp,application/zip,application/x-zip-compressed"
        onChange={event => {
          appendFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <UploadQueue
        items={items}
        errors={errors}
        loading={loading}
        failed={submitFailed}
        onRemove={removeItem}
      />

      <TextField
        label="交付说明"
        value={remark}
        onChange={event => {
          setSubmitFailed(false)
          onChange?.({ files, remark: event.target.value })
        }}
        multiline
        minRows={compact ? 2 : 3}
        placeholder="说明本次交付内容、精选范围或返修修改点"
        inputProps={{ maxLength: 500 }}
        helperText={`${remark.length}/500 · 客户确认后，托管资金将进入结算流程。`}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: PORTRA_SURFACE.paperSoft,
            borderRadius: PORTRA_RADIUS.control
          }
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          startIcon={<TaskAltRoundedIcon />}
          disabled={loading || !validFiles.length || errors.length > 0}
        >
          {loading ? '正在上传…' : '提交交付'}
        </Button>
      </Box>
    </Stack>
  )
}

function dedupeFiles(files) {
  const seen = new Set()
  return Array.from(files || []).filter(file => {
    const key = getFileKey(file)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getFileKey(file) {
  return `${file?.name || ''}-${file?.size || 0}-${file?.lastModified || 0}`
}

function getFileError(file, fileType) {
  const name = file?.name || '未知文件'
  if (fileType === 'UNSUPPORTED') {
    const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '该'
    return `不支持 ${extension} 文件，请上传 JPG、PNG、WEBP 图片或 ZIP 压缩包。`
  }
  if (fileType === 'IMAGE' && file.size > DELIVERY_UPLOAD_LIMITS.imageMaxBytes) {
    return `这张图片超过 20MB，请压缩后重新上传：${name}`
  }
  if (fileType === 'ZIP' && file.size > DELIVERY_UPLOAD_LIMITS.zipMaxBytes) {
    return `这个 ZIP 超过 200MB，请拆分或压缩后重新上传：${name}`
  }
  return ''
}
