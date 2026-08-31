export function AdminModeBanner({
  eyebrow = 'PORTRA PLATFORM',
  title = '管理员模式',
  description = '你正在浏览平台公开内容与管理队列。'
}) {
  return (
    <section className="admin-mode-banner" aria-labelledby="admin-mode-title">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1 id="admin-mode-title">{title}</h1>
        <p>{description}</p>
      </div>
      <span className="admin-mode-badge">管理员模式</span>
    </section>
  )
}
