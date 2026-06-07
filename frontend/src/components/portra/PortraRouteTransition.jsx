import { Box } from '@mui/material'
import { useLocation } from 'react-router-dom'

export function PortraRouteTransition({ children }) {
  const location = useLocation()
  const transitionKey = `${location.pathname}${location.search}`
  return (
    <Box
      key={transitionKey}
      data-portra-route-transition="true"
      sx={{
        minWidth: 0,
        '@media (prefers-reduced-motion: no-preference)': {
          animation: 'portraWorkflowRouteIn 180ms ease-out both'
        },
        '@keyframes portraWorkflowRouteIn': {
          from: { opacity: 0.96, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        }
      }}
    >
      {children}
    </Box>
  )
}
