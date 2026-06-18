import { useRef, useState } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { FileDropzone } from './FileDropzone.jsx'
import { UploadQueue } from './UploadQueue.jsx'
import {
  createUploadItems,
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

  function updateFiles(nextFiles) {
    const normalized = dedupeFiles(nextFiles).slice(0, 20)
    const nextErrors = validateDeliveryUploadFiles(normalized)
    setErrors(nextErrors)
    setSubmitFailed(false)
    onChange?.({ files: normalized, remark })
  }

  function appendFiles(fileList) {
    updateFiles([...files, ...Array.from(fileList || [])])
  }

  function removeItem(itemId) {
    const nextFiles = items.filter(item => item.id !== itemId).map(item => item.file)
    updateFiles(nextFiles)
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
          <Typography sx={{ fontSize: 13.5, fontWeight: 850 }}>交付文件将以 DELIVERY / PRIVATE 保存，仅订单双方可访问。</Typography>
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
    const key = `${file.name}-${file.size}-${file.lastModified}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
