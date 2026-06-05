import { Component } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'

export class MessageWorkbenchErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Message workbench render error', error, info)
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ bgcolor: PORTRA_COLORS.paper, borderRadius: PORTRA_RADII.control }}>
          <Stack spacing={1}>
            <Typography fontWeight={900}>会话工作台暂时无法打开</Typography>
            <Typography variant="body2">请返回消息列表，或刷新后重试。错误详情已保留在控制台，方便定位。</Typography>
            <Button size="small" variant="outlined" color="inherit" onClick={() => this.setState({ error: null })} sx={{ alignSelf: 'flex-start' }}>
              重试打开
            </Button>
          </Stack>
        </Alert>
      </Box>
    )
  }
}
