import { Box, Divider, Paper, Stack, Typography } from '@mui/material'
import { InfoRows } from './InfoRows.jsx'
import {
  PortraInfoBanner,
  PortraStatusBadge,
  PortraStatusPill,
  PortraTicketSection
} from '../../../components/portra/index.js'
import { PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function OrderStatusHero({
  loading,
  returnActions,
  title,
  subtitle,
  amountText,
  perspectiveLabel,
  workflow,
  statusLabel,
  escrowLabel,
  overviewRows = [],
  scheduleRows = [],
  quoteRows = [],
  fulfillmentNotice,
  primaryAction,
  idleLabel = '暂无需要你操作的事项',
  cancelNotice,
  shootStartedNotice
}) {
  return (
    <Paper variant="outlined" sx={heroSx}>
      <Stack spacing={2}>
        {loading && (
          <Typography variant="caption" sx={{ alignSelf: 'flex-start', color: PORTRA_SURFACE.muted, fontWeight: 850 }}>
            正在更新订单信息
          </Typography>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: 0 }}>
            {returnActions}
            <Typography variant="h5" sx={{ fontSize: { xs: 20, md: 24 }, color: PORTRA_SURFACE.ink, fontWeight: 950 }}>
              {title}
            </Typography>
            <Typography sx={{ color: PORTRA_SURFACE.muted, mt: 0.4 }}>{subtitle}</Typography>
            <Typography sx={{ mt: 1.2, color: PORTRA_SURFACE.ink, fontSize: { xs: 28, md: 32 }, fontWeight: 950, lineHeight: 1 }}>
              {amountText}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, alignContent: 'flex-start' }}>
            <PortraStatusPill label={perspectiveLabel || '身份待确认'} tone="neutral" />
            <PortraStatusPill label={workflow?.title || statusLabel} tone={workflow?.tone} />
            <PortraStatusPill label={escrowLabel} />
          </Stack>
        </Stack>

        <Box sx={nextStepPanelSx}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={overlineSx}>当前状态</Typography>
              <Typography sx={{ mt: 0.25, color: PORTRA_SURFACE.ink, fontWeight: 950, fontSize: { xs: 18, md: 20 } }}>
                {workflow?.title || statusLabel}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.45, color: PORTRA_SURFACE.muted, lineHeight: 1.65 }}>
                {workflow?.description}
              </Typography>
              {workflow?.nextStep && (
                <Typography variant="body2" sx={{ mt: 0.7, color: PORTRA_SURFACE.ink, fontWeight: 850 }}>
                  下一步：{workflow.nextStep}
                </Typography>
              )}
            </Box>
            <Box sx={{ flexShrink: 0, minWidth: { md: 190 } }}>
              <Typography variant="overline" sx={overlineSx}>主要操作</Typography>
              <Stack spacing={0.8} sx={{ mt: 0.6, alignItems: { xs: 'stretch', md: 'flex-start' } }}>
                {primaryAction || <PortraStatusBadge label={idleLabel} tone="neutral" />}
              </Stack>
            </Box>
          </Stack>
          {fulfillmentNotice?.rows?.length ? (
            <Box sx={{ mt: 1.35 }}>
              <InfoRows rows={fulfillmentNotice.rows} />
            </Box>
          ) : null}
          {fulfillmentNotice?.note ? (
            <Box sx={{ mt: 1.2 }}>
              <PortraInfoBanner tone={fulfillmentNotice.severity === 'warning' ? 'warning' : 'info'}>
                {fulfillmentNotice.note}
              </PortraInfoBanner>
            </Box>
          ) : null}
        </Box>

        <Divider sx={{ borderColor: PORTRA_SURFACE.borderSoft }} />

        <Box sx={summaryGridSx}>
          <PortraTicketSection title="资金托管">
            <InfoRows rows={overviewRows} />
          </PortraTicketSection>
          <PortraTicketSection title="履约安排">
            <InfoRows rows={scheduleRows} />
          </PortraTicketSection>
          {quoteRows.length ? (
            <PortraTicketSection title="报价快照">
              <InfoRows rows={quoteRows} />
            </PortraTicketSection>
          ) : null}
        </Box>

        {cancelNotice}
        {shootStartedNotice ? (
          <PortraInfoBanner tone="warning">拍摄开始后不可直接取消，如有争议请走申诉或联系平台处理。</PortraInfoBanner>
        ) : null}
      </Stack>
    </Paper>
  )
}

const heroSx = {
  p: { xs: 2, md: 2.6 },
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSubtle,
  borderRadius: PORTRA_RADIUS.panel,
  boxShadow: PORTRA_SHADOW.soft,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 24,
    top: 0,
    width: 66,
    height: 4,
    borderRadius: 999,
    bgcolor: PORTRA_SURFACE.portraBlue
  }
}

const nextStepPanelSx = {
  p: { xs: 1.35, md: 1.55 },
  bgcolor: PORTRA_SURFACE.paperSoft,
  border: `1px solid ${PORTRA_SURFACE.borderSoft}`,
  borderRadius: PORTRA_RADIUS.card
}

const summaryGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
  gap: 1.35,
  alignItems: 'start'
}

const overlineSx = {
  color: PORTRA_SURFACE.faint,
  fontWeight: 950,
  letterSpacing: 0
}
