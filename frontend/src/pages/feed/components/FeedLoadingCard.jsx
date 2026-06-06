export function FeedLoadingCard({ compact = false }) {
  return (
    <div className={`feed-developing${compact ? ' feed-developing--compact' : ''}`} role="status" aria-live="polite">
      <div className="feed-developing__copy">
        <span>PORTRA CONTACT SHEET</span>
        <strong>正在显影动态广场</strong>
        <p>整理照片、作者与新鲜片段</p>
      </div>
      <div className="feed-developing__film" aria-hidden="true">
        <div className="feed-developing__perforations feed-developing__perforations--top" />
        <div className="feed-developing__frames">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="feed-developing__perforations feed-developing__perforations--bottom" />
        <div className="feed-developing__scan" />
      </div>
      <div className="feed-developing__progress" aria-hidden="true"><span /></div>
    </div>
  )
}
