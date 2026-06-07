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
        willChange: 'opacity, transform',
        '@media (prefers-reduced-motion: no-preference)': {
          animation: 'portraWorkflowRouteIn 150ms ease-out both'
        },
        '@keyframes portraWorkflowRouteIn': {
          from: { opacity: 0.92, transform: 'translateY(4px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        }
      }}
    >
      {children}
    </Box>
  )
}
