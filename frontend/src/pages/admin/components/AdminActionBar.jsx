export function AdminActionBar({ actions = [] }) {
  return (
    <div className="admin-action-bar">
      {actions.map(action => {
        const disabled = Boolean(action.disabled)
        return (
          <div className="admin-action" key={action.key}>
            <button
              className={action.danger ? 'admin-button admin-button--danger' : 'admin-button'}
              type="button"
              disabled={disabled}
              onClick={disabled ? undefined : action.onClick}
            >
              {action.label}
            </button>
            {action.hint ? <span className="admin-action-hint">{action.hint}</span> : null}
          </div>
        )
      })}
    </div>
  )
}
