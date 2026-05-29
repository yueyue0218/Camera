import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import AppShell from './layout/AppShell.jsx'
import { theme } from './theme/theme.js'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell />
    </ThemeProvider>
  )
}

export default App
