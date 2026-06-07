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
