import { Component } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'

export class MessageWorkbenchErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Message workbench render error', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack
    })
    this.setState({ errorInfo: info })
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    const { error, errorInfo } = this.state
    const showDebugDetails = import.meta.env.DEV
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ bgcolor: PORTRA_COLORS.paper, borderRadius: PORTRA_RADII.control }}>
          <Stack spacing={1}>
            <Typography fontWeight={900}>会话工作台暂时无法打开</Typography>
            <Typography variant="body2">请返回消息列表，或刷新后重试。错误详情已保留在控制台，方便定位。</Typography>
            {showDebugDetails && (
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  maxHeight: 360,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  bgcolor: PORTRA_COLORS.paper,
                  border: `1px solid ${PORTRA_COLORS.borderMuted}`,
                  borderRadius: PORTRA_RADII.control,
                  color: PORTRA_COLORS.ink,
                  fontSize: 12,
                  lineHeight: 1.55
                }}
              >{[
                `error.name: ${error?.name || ''}`,
                `error.message: ${error?.message || ''}`,
                '',
                'error.stack:',
                error?.stack || '',
                '',
                'componentStack:',
                errorInfo?.componentStack || ''
              ].join('\n')}</Box>
            )}
            <Button size="small" variant="outlined" color="inherit" onClick={() => this.setState({ error: null })} sx={{ alignSelf: 'flex-start' }}>
              重试打开
            </Button>
          </Stack>
        </Alert>
      </Box>
    )
  }
}
