import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#0d2fb2', light: '#3857c8', dark: '#092585' },
    secondary: { main: '#f85104', light: '#ff8d47', dark: '#c53b05' },
    warning: { main: '#f7ce3a' },
    background: { default: '#e6e2e0', paper: '#f8f3eb' },
    text: { primary: '#151318', secondary: '#686b70' },
    divider: 'rgba(21,19,24,.12)'
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Avenir Next", "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", sans-serif',
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#e6e2e0',
          backgroundImage: 'none'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#f2ede6',
          backdropFilter: 'none'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(248,243,235,.9)',
          borderColor: 'rgba(21,19,24,.12)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(248,243,235,.9)',
          borderColor: 'rgba(21,19,24,.12)'
        }
      }
    }
  }
})
