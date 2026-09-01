import { Link } from 'react-router-dom'

export function AdminStatCard({ stat, to }) {
  return (
    <article className={`admin-stat-card${stat.available ? '' : ' admin-stat-card--pending'}`}>
      <Link to={to} aria-label={`${stat.label}：${stat.displayValue}`}>
        <span className="admin-stat-label">{stat.label}</span>
        <strong>{stat.displayValue}</strong>
        <span className="admin-stat-helper">{stat.helper}</span>
      </Link>
    </article>
  )
}
