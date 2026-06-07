import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import AppShell from './layout/AppShell.jsx'
import { theme } from './theme/theme.js'
import { PortraFeedbackProvider } from './components/portra/index.js'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PortraFeedbackProvider>
        <AppShell />
      </PortraFeedbackProvider>
    </ThemeProvider>
  )
}

export default App
