export function LoadingState({ text = '正在从后端加载真实数据' }) {
  return (
    <div className="panel-card hall-state-card is-loading">
      <div className="hall-state-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>{text}</p>
    </div>
  )
}

export function EmptyState({ text }) {
  return (
    <div className="panel-card hall-state-card">
      <p>{text}</p>
    </div>
  )
}

export function ErrorState({ message }) {
  return (
    <div className="panel-card hall-state-card hall-error-card">
      <strong>后端暂未连接</strong>
      <p>{message || '启动后端服务后，这里会显示真实接口数据。'}</p>
    </div>
  )
}
