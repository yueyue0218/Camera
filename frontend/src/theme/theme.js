import { createTheme } from '@mui/material/styles'

export const portraTokens = {
  background: '#e6e2e0',
  surface: '#f4efe8',
  surfaceAlt: '#ebe6dd',
  paper: '#f8f3eb',
  primary: '#0d2fb2',
  primaryDark: '#092585',
  secondary: '#f7ce3a',
  accent: '#f85104',
  textPrimary: '#111015',
  textSecondary: '#5d6167',
  border: 'rgba(21, 19, 24, 0.12)',
  borderStrong: 'rgba(21, 19, 24, 0.18)',
  muted: '#777b82'
}

export const theme = createTheme({
  palette: {
    primary: { main: portraTokens.primary, light: '#dbe3ff', dark: portraTokens.primaryDark },
    secondary: { main: portraTokens.secondary, light: '#fff1a8', dark: '#b08b00' },
    background: { default: portraTokens.background, paper: portraTokens.paper },
    text: { primary: portraTokens.textPrimary, secondary: portraTokens.textSecondary },
    divider: portraTokens.border
  },
  shape: { borderRadius: 18 },
  typography: {
    fontFamily: '"Avenir Next", "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", sans-serif',
    h4: { fontWeight: 800, letterSpacing: '0.06em' },
    h5: { fontWeight: 800, letterSpacing: '0.05em' },
    h6: { fontWeight: 800, letterSpacing: '0.04em' },
    button: { fontWeight: 700, letterSpacing: '0.08em' }
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
          backgroundColor: portraTokens.background,
          backgroundImage: 'none'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(248, 243, 235, 0.92)',
          backdropFilter: 'blur(14px)',
          borderColor: portraTokens.border
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(248, 243, 235, 0.94)',
          borderColor: portraTokens.border
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(248, 243, 235, 0.96)',
          borderColor: portraTokens.border,
          transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          minHeight: 42,
          textTransform: 'none'
        },
        containedPrimary: {
          boxShadow: '0 10px 22px rgba(13, 47, 178, 0.18)'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 700 }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(248, 243, 235, 0.86)',
          borderRadius: 18
        }
      }
    }
  }
})
