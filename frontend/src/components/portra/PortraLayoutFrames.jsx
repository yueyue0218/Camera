import { Box, Stack } from '@mui/material'
import { PORTRA_LAYOUT } from '../../theme/portraSurfaceTokens.js'

function resolveMaxWidth(maxWidth) {
  if (typeof maxWidth === 'number') return `${maxWidth}px`
  if (maxWidth === 'wide') return `${PORTRA_LAYOUT.wideWorkflowMaxWidth}px`
  if (maxWidth === 'gallery') return `${PORTRA_LAYOUT.galleryMaxWidth}px`
  if (maxWidth === 'workflow') return `${PORTRA_LAYOUT.workflowMaxWidth}px`
  return `${PORTRA_LAYOUT.pageMaxWidth}px`
}

export function PortraPageFrame({ children, maxWidth = 'page', topGap = true, sx, ...props }) {
  return (
    <Box
      {...props}
      sx={{
        '--portra-page-max-width': resolveMaxWidth(maxWidth),
        '--portra-page-gutter': PORTRA_LAYOUT.pageGutter,
        '--portra-page-gutter-total': PORTRA_LAYOUT.pageGutterTotal,
        width: {
          xs: 'calc(100% - var(--portra-mobile-gutter-total, 24px))',
          sm: 'min(calc(100% - var(--portra-page-gutter-total)), var(--portra-page-max-width))'
        },
        mx: 'auto',
        mt: topGap ? `${PORTRA_LAYOUT.contentTopGap}px` : 0,
        boxSizing: 'border-box',
        minWidth: 0,
        maxWidth: 'var(--portra-page-max-width)',
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

export function PortraWorkflowFrame({ children, maxWidth = 'workflow', height, spacing = 2.5, sx, ...props }) {
  return (
    <PortraPageFrame
      component={Stack}
      maxWidth={maxWidth}
      spacing={spacing}
      {...props}
      sx={{
        color: 'inherit',
        minWidth: 0,
        ...(height ? { height, maxHeight: height, minHeight: 0, overflow: 'hidden' } : {}),
        ...sx
      }}
    >
      {children}
    </PortraPageFrame>
  )
}

export function PortraWorkbenchFrame({
  children,
  rightPanelWidth = PORTRA_LAYOUT.rightPanelWidth,
  gap = { xs: 1.5, lg: 2.5 },
  sx,
  ...props
}) {
  return (
    <Box
      {...props}
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: `minmax(0, 1fr) ${rightPanelWidth.lg || rightPanelWidth}`,
          xl: `minmax(0, 1fr) ${rightPanelWidth.xl || rightPanelWidth.lg || rightPanelWidth}`
        },
        gap,
        alignItems: 'stretch',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...sx
      }}
    >
      {children}
    </Box>
  )
}
