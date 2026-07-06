import { PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export const ORDER_WORKFLOW_COLORS = {
  paper: '#fffcf6',
  paperMuted: '#fff8ee',
  border: 'rgba(79, 70, 60, .10)',
  borderSubtle: 'rgba(79, 70, 60, .09)',
  ink: PORTRA_SURFACE.ink,
  muted: PORTRA_SURFACE.muted,
  faint: PORTRA_SURFACE.faint,
  primary: PORTRA_SURFACE.portraBlue,
  primarySoft: PORTRA_SURFACE.portraBlueSoft,
  primaryWash: 'rgba(13, 47, 178, .08)',
  warning: PORTRA_SURFACE.warmOrange,
  warningSoft: '#fff4e5',
  warningWash: '#fff0e8',
  warningText: '#9a4b00',
  success: '#4fbd78',
  successSoft: '#ecfdf3',
  disabled: '#c4cedd',
  upcoming: '#d8d2c8',
  timelineComplete: PORTRA_SURFACE.portraBlue,
  timelineCompleteLine: 'rgba(154, 148, 138, .18)',
  timelineUpcomingLine: 'rgba(154, 148, 138, .22)'
}

export function getOrderWorkflowTone(tone = 'primary') {
  if (tone === 'warning' || tone === 'danger') {
    return {
      bg: ORDER_WORKFLOW_COLORS.warningSoft,
      wash: ORDER_WORKFLOW_COLORS.warningWash,
      color: ORDER_WORKFLOW_COLORS.warning,
      text: ORDER_WORKFLOW_COLORS.warningText
    }
  }
  if (tone === 'success') {
    return {
      bg: ORDER_WORKFLOW_COLORS.successSoft,
      wash: ORDER_WORKFLOW_COLORS.successSoft,
      color: ORDER_WORKFLOW_COLORS.success,
      text: ORDER_WORKFLOW_COLORS.success
    }
  }
  return {
    bg: ORDER_WORKFLOW_COLORS.primarySoft,
    wash: ORDER_WORKFLOW_COLORS.primaryWash,
    color: ORDER_WORKFLOW_COLORS.primary,
    text: ORDER_WORKFLOW_COLORS.primary
  }
}

export function getWorkflowStatusDotColor(status) {
  if (status === 'COMPLETED') return ORDER_WORKFLOW_COLORS.success
  if (status === 'CANCELLED' || status === 'REFUNDED') return ORDER_WORKFLOW_COLORS.disabled
  if (['PENDING_DELIVERY', 'DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'APPEALING'].includes(status)) {
    return ORDER_WORKFLOW_COLORS.warning
  }
  return ORDER_WORKFLOW_COLORS.primary
}
