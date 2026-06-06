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
        ':root': {
          '--bg-page': '#e6e2e0',
          '--bg-card': '#f8f3eb',
          '--bg-panel': '#ebe6dd',
          '--bg-inset': '#f0ece5',
          '--blue': '#0d2fb2',
          '--blue-light': 'rgba(13,47,178,0.08)',
          '--yellow': '#f7ce3a',
          '--orange': '#f85104',
          '--text-primary': '#111015',
          '--text-secondary': '#5d6167',
          '--text-muted': '#9a9da3',
          '--border': 'rgba(21,19,24,0.10)',
          '--border-dashed': 'rgba(13,47,178,0.15)',
          '--shadow-card': '0 2px 12px rgba(21,19,24,0.07)',
          '--shadow-hover': '0 6px 20px rgba(13,47,178,0.10)'
        },
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
