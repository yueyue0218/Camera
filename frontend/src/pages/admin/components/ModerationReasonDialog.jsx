export function ModerationReasonDialog({
  open,
  title,
  description,
  value = '',
  onChange,
  onCancel,
  onConfirm,
  submitting = false,
  required = false
}) {
  if (!open) return null

  const confirmationDisabled = submitting || (required && !value.trim())
  return (
    <div className="admin-dialog-backdrop" data-confirm-disabled={confirmationDisabled}>
      <section
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        aria-describedby={description ? 'admin-dialog-description' : undefined}
        onKeyDown={event => {
          if (event.key === 'Escape' && !submitting) onCancel?.()
        }}
      >
        <header>
          <p className="admin-eyebrow">MODERATION ACTION</p>
          <h2 id="admin-dialog-title">{title}</h2>
          {description ? <p id="admin-dialog-description">{description}</p> : null}
        </header>
        <label className="admin-dialog-field">
          <span>处理原因{required ? '（必填）' : '（选填）'}</span>
          <textarea
            name="moderation-reason"
            value={value}
            maxLength={255}
            rows={5}
            autoComplete="off"
            aria-required={required}
            disabled={submitting}
            onChange={event => onChange?.(event.target.value)}
          />
          <small>{value.length}/255</small>
        </label>
        <div className="admin-dialog-actions">
          <button className="admin-button admin-button--quiet" type="button" disabled={submitting} onClick={onCancel}>
            取消
          </button>
          <button className="admin-button admin-button--danger" type="button" disabled={confirmationDisabled} onClick={onConfirm}>
            {submitting ? '提交中…' : '确认提交'}
          </button>
        </div>
      </section>
    </div>
  )
}
