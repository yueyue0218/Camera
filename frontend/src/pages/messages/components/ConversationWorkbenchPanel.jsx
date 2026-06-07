import { Box, Skeleton, Stack, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { buildOrderAction, buildQuoteAction } from '../../../utils/orderNavigation.js'
import { PortraActionLink, PortraPrimaryAction, PortraSecondaryAction, PortraWorkflowPanel } from '../../../components/portra/index.js'
import { buildQuoteDisplayModel } from '../utils/quoteDisplayModel.js'
import { PORTRA_COLORS, QUOTE_VISUAL } from '../MessageVisualTokens.js'
import { WorkbenchSection } from './WorkbenchSection.jsx'

function getLatestQuote(quotes) {
  return [...quotes].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0] || null
}
export function ConversationWorkbenchPanel({
  quotes,
  order,
  actions,
  panelSummary,
  statusLogs,
  deliveryRecords,
  photoAuthorizations,
  loading = false,
  onOpenOrderArchive,
  onConfirmOrder,
  onOpenAction
}) {
  const latestQuote = getLatestQuote(quotes)
  const latestQuoteModel = latestQuote ? buildQuoteDisplayModel(latestQuote) : null
  const summary = panelSummary || {}
  const uploadLabel = actions.canReuploadDelivery ? '重新上传作品' : '上传作品'
  const orderAction = buildOrderAction(order, { label: '查看订单' })
  const quoteOrderAction = latestQuote ? buildQuoteAction(latestQuote, { label: '查看订单' }) : null
  const hasActionBlock = actions.canConfirmDelivery
    || actions.canUploadDelivery
    || actions.canReuploadDelivery
    || actions.canRequestPhotoAuthorization
    || actions.canViewDispute
  const hasCachedContent = Boolean(order || latestQuote || deliveryRecords.length || photoAuthorizations.length)
  return (
    <PortraWorkflowPanel
      data-message-panel="true"
      sx={{
        display: { xs: 'none', lg: 'block' },
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        alignSelf: 'stretch'
      }}
    >
      {loading && !hasCachedContent ? (
        <PanelSkeleton />
      ) : (
      <Stack spacing={1.35}>
        <Box sx={{ pb: 0.1 }}>
          <Typography variant="overline" sx={{ color: PORTRA_COLORS.faintInk, fontWeight: 850, letterSpacing: 0 }}>当前进展</Typography>
          <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 17, fontWeight: 900 }}>{summary.progressTitle || actions.stage.title}</Typography>
          <Typography variant="body2" sx={{ mt: 0.35, color: PORTRA_COLORS.mutedInk, lineHeight: 1.55 }}>{summary.nextStep || actions.stage.description}</Typography>
        </Box>

        {hasActionBlock && (
        <WorkbenchSection title="下一步">
          <Box sx={{ p: 0, bgcolor: 'transparent', borderRadius: 0, borderLeft: 0, boxShadow: 'none' }}>
            <Stack spacing={0.8}>
            {actions.canConfirmDelivery ? (
              <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
                <PortraPrimaryAction startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder}>确认接收</PortraPrimaryAction>
                <PortraSecondaryAction onClick={() => onOpenAction('REQUEST_REWORK')}>提交返修</PortraSecondaryAction>
              </Stack>
            ) : actions.canUploadDelivery || actions.canReuploadDelivery ? (
              <Stack spacing={0.8}>
                <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk, lineHeight: 1.7 }}>
                  {actions.canReuploadDelivery ? '客户提出返修，请根据要求重新上传作品。' : '请上传本次拍摄作品。'}
                </Typography>
                <PortraPrimaryAction startIcon={<AddPhotoAlternateRoundedIcon />} onClick={() => onOpenAction(actions.canReuploadDelivery ? 'REUPLOAD_DELIVERY' : 'UPLOAD_DELIVERY')} sx={{ alignSelf: 'flex-start' }}>
                  {uploadLabel}
                </PortraPrimaryAction>
              </Stack>
            ) : actions.canRequestPhotoAuthorization ? (
              <Stack spacing={0.8}>
                <Typography variant="body2" color="text.secondary">订单已完成，可以选择作品申请展示授权。</Typography>
                <PortraSecondaryAction startIcon={<ImageRoundedIcon />} onClick={() => onOpenAction('REQUEST_AUTHORIZATION')} sx={{ alignSelf: 'flex-start' }}>
                  申请展示授权
                </PortraSecondaryAction>
              </Stack>
            ) : (
              null
            )}
            {actions.canViewDispute && orderAction && (
              <PortraActionLink onClick={() => onOpenOrderArchive(orderAction.orderId)} sx={{ alignSelf: 'flex-start' }}>
                查看争议进展
              </PortraActionLink>
            )}
            </Stack>
          </Box>
        </WorkbenchSection>
        )}

        {latestQuote && (
          <WorkbenchSection title="当前报价">
            <Box sx={quoteSummaryCardSx}>
              <Typography sx={{ color: QUOTE_VISUAL.ink, fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {latestQuoteModel.amountText}
              </Typography>
              <Typography sx={{ color: QUOTE_VISUAL.muted, fontSize: 14, lineHeight: 1.45 }}>
                {latestQuoteModel.photoUsageLabel}
              </Typography>

              <Box sx={{ borderTop: `1px solid ${QUOTE_VISUAL.divider}`, mt: 1, pt: 0.85 }}>
                <CompactQuoteRow icon={<CalendarMonthRoundedIcon />} label="拍摄时段" value={latestQuoteModel.shootPeriodText} />
                <CompactQuoteRow icon={<PlaceRoundedIcon />} label="拍摄地点" value={latestQuoteModel.shootLocationText} />
              </Box>

              <PanelQuoteStatusPill model={latestQuoteModel} />
              {(orderAction || quoteOrderAction) && (
                <PortraActionLink onClick={() => onOpenOrderArchive((orderAction || quoteOrderAction).orderId)} sx={quoteOrderLinkSx}>
                  查看订单 &gt;
                </PortraActionLink>
              )}
            </Box>
          </WorkbenchSection>
        )}

        <WorkbenchSection title="作品与授权">
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <TaskAltRoundedIcon sx={{ fontSize: 17, color: PORTRA_COLORS.blue }} />
              <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk }}>作品 {summary.deliveryCount ?? deliveryRecords.length}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <ImageRoundedIcon sx={{ fontSize: 17, color: QUOTE_VISUAL.coral }} />
              <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk }}>授权 {summary.authorizationCount ?? photoAuthorizations.length}</Typography>
            </Stack>
          </Stack>
        </WorkbenchSection>
      </Stack>
      )}
    </PortraWorkflowPanel>
  )
}

function CompactQuoteRow({ icon, label, value }) {
  return (
    <Stack direction="row" spacing={0.85} sx={{ alignItems: 'flex-start', py: 0.65, minWidth: 0 }}>
      <Box sx={{ color: QUOTE_VISUAL.muted, pt: 0.12, '& svg': { fontSize: 18 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: QUOTE_VISUAL.muted, fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>
          {label}
        </Typography>
        <Typography sx={{ color: QUOTE_VISUAL.ink, fontSize: 14, fontWeight: 500, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  )
}

function PanelQuoteStatusPill({ model }) {
  const completed = model.statusTone === 'completed'
  const danger = model.statusTone === 'danger'
  const waiting = model.statusTone === 'waiting'
  return (
    <Box
      sx={{
        alignSelf: 'flex-start',
        mt: 0.2,
        px: 1.15,
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        bgcolor: completed ? QUOTE_VISUAL.greenSoft : danger ? QUOTE_VISUAL.coralSoft : waiting ? QUOTE_VISUAL.waitingSoft : 'rgba(160,167,179,.14)',
        color: completed ? QUOTE_VISUAL.green : danger ? QUOTE_VISUAL.coral : waiting ? QUOTE_VISUAL.waiting : QUOTE_VISUAL.muted,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1
      }}
    >
      {model.statusLabel}
    </Box>
  )
}

const quoteSummaryCardSx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  p: 0,
  minWidth: 0,
  bgcolor: 'transparent',
  border: 0,
  borderRadius: 0,
  boxShadow: 'none'
}

const quoteOrderLinkSx = {
  alignSelf: 'center',
  mt: 0.4,
  px: 0.5,
  fontSize: 14,
  fontWeight: 700,
  color: QUOTE_VISUAL.blue
}

function PanelSkeleton() {
  return (
    <Stack spacing={1.35} aria-label="工作台摘要加载中">
      <Box>
        <Skeleton variant="text" width="34%" height={18} />
        <Skeleton variant="text" width="68%" height={28} />
        <Skeleton variant="text" width="88%" height={20} />
      </Box>
      {[0, 1, 2].map(index => (
        <Box key={index} sx={{ py: 0.75 }}>
          <Skeleton variant="text" width={`${42 + index * 12}%`} height={22} />
          <Skeleton variant="rounded" width="100%" height={54} sx={{ mt: 0.6, borderRadius: 2 }} />
        </Box>
      ))}
    </Stack>
  )
}
