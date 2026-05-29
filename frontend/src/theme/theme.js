import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#7651d4', light: '#a894ef', dark: '#4c2f9e' },
    secondary: { main: '#c05f9c', light: '#e4a6ca', dark: '#8f3d72' },
    background: { default: '#f5efff', paper: '#fffaff' },
    text: { primary: '#241a3d', secondary: '#655873' },
    divider: '#e2d4fa'
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, "Microsoft YaHei", "PingFang SC", Arial, sans-serif',
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f5efff',
          backgroundImage: 'linear-gradient(135deg, #fbf7ff 0%, #f1e8ff 46%, #f7f0ff 100%)'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 250, 255, 0.92)',
          backdropFilter: 'blur(14px)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 250, 255, 0.9)',
          borderColor: '#e2d4fa'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 250, 255, 0.9)',
          borderColor: '#e2d4fa'
        }
      }
    }
  }
})
