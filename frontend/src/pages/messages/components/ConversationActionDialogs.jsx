import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'

export function ConversationActionDialogs({
  activeAction,
  loading,
  deliveryRecords,
  deliveryForm,
  reworkRequirement,
  photoAuthorizationForm,
  onClose,
  onDeliveryFileChange,
  onDeliveryRemarkChange,
  onReworkRequirementChange,
  onPhotoAuthorizationFileIdsChange,
  onPhotoAuthorizationRemarkChange,
  onSubmitDelivery,
  onSubmitRework,
  onSubmitPhotoAuthorization
}) {
  const deliveryFiles = deliveryRecords
    .filter(record => record.fileId)
    .map(record => ({
      fileId: Number(record.fileId),
      fileName: record.fileName || '作品文件'
    }))

  async function submitAndClose(handler, event) {
    event.preventDefault()
    const succeeded = await handler(event)
    if (succeeded) onClose()
  }

  return (
    <>
      <Dialog open={activeAction === 'UPLOAD_DELIVERY' || activeAction === 'REUPLOAD_DELIVERY'} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{activeAction === 'REUPLOAD_DELIVERY' ? '重新上传作品' : '上传作品'}</DialogTitle>
        <DialogContent>
          <Stack component="form" id="delivery-dialog-form" spacing={2} sx={{ pt: 1 }} onSubmit={event => submitAndClose(onSubmitDelivery, event)}>
            <DialogContentText>
              {activeAction === 'REUPLOAD_DELIVERY' ? '请根据客户的返修要求上传调整后的作品。' : '选择本次交付文件，并补充必要的交付说明。'}
            </DialogContentText>
            <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
              选择作品文件
              <input hidden type="file" onChange={event => onDeliveryFileChange(event.target.files?.[0] || null)} />
            </Button>
            <Typography color="text.secondary" variant="body2">{deliveryForm.file ? deliveryForm.file.name : '尚未选择文件'}</Typography>
            <TextField
              label="交付说明"
              value={deliveryForm.remark}
              onChange={event => onDeliveryRemarkChange(event.target.value)}
              multiline
              minRows={3}
              placeholder="说明本次交付内容、返修修改点或注意事项"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>取消</Button>
          <Button type="submit" form="delivery-dialog-form" variant="contained" disabled={loading || !deliveryForm.file}>
            {activeAction === 'REUPLOAD_DELIVERY' ? '上传返修作品' : '上传作品'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeAction === 'REQUEST_REWORK'} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>提交返修要求</DialogTitle>
        <DialogContent>
          <Stack component="form" id="rework-dialog-form" spacing={2} sx={{ pt: 1 }} onSubmit={event => submitAndClose(onSubmitRework, event)}>
            <DialogContentText>请说明需要调整的照片和修改方向，摄影师会根据要求重新交付。</DialogContentText>
            <TextField
              autoFocus
              label="返修要求"
              value={reworkRequirement}
              onChange={event => onReworkRequirementChange(event.target.value)}
              multiline
              minRows={4}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>取消</Button>
          <Button type="submit" form="rework-dialog-form" variant="contained" disabled={loading || !reworkRequirement.trim()}>提交返修</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeAction === 'REQUEST_AUTHORIZATION'} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>申请照片展示授权</DialogTitle>
        <DialogContent>
          <Stack component="form" id="authorization-dialog-form" spacing={2} sx={{ pt: 1 }} onSubmit={event => submitAndClose(onSubmitPhotoAuthorization, event)}>
            <DialogContentText>请选择已经交付的作品，并说明希望展示这些照片的用途。</DialogContentText>
            <FormControl>
              <InputLabel>选择已交付作品</InputLabel>
              <Select
                multiple
                label="选择已交付作品"
                value={photoAuthorizationForm.fileIds}
                onChange={event => {
                  const value = event.target.value
                  onPhotoAuthorizationFileIdsChange((typeof value === 'string' ? value.split(',') : value).map(Number))
                }}
                renderValue={selected => selected.map(fileId => deliveryFiles.find(file => file.fileId === Number(fileId))?.fileName || '作品文件').join('、')}
              >
                {deliveryFiles.map(file => <MenuItem key={file.fileId} value={file.fileId}>{file.fileName}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="申请说明"
              value={photoAuthorizationForm.remark}
              onChange={event => onPhotoAuthorizationRemarkChange(event.target.value)}
              multiline
              minRows={3}
              placeholder="例如：用于个人作品集客片展示"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>取消</Button>
          <Button type="submit" form="authorization-dialog-form" variant="contained" disabled={loading || !photoAuthorizationForm.fileIds.length}>提交申请</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
