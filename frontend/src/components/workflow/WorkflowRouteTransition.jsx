import { Box, GlobalStyles } from '@mui/material'
import { useLocation } from 'react-router-dom'

export function WorkflowRouteTransition({ children }) {
  const location = useLocation()
  const transitionKey = `${location.pathname}${location.search}`

  return (
    <>
      <GlobalStyles styles={{
        '@media (prefers-reduced-motion: no-preference)': {
          '::view-transition-old(root), ::view-transition-new(root)': {
            animationDuration: '190ms',
            animationTimingFunction: 'cubic-bezier(.2,.8,.2,1)'
          },
          '::view-transition-old(root)': {
            animationName: 'workflowViewOut'
          },
          '::view-transition-new(root)': {
            animationName: 'workflowViewIn'
          }
        },
        '@keyframes workflowViewIn': {
          from: { opacity: 0.96, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        '@keyframes workflowViewOut': {
          from: { opacity: 1, transform: 'translateY(0)' },
          to: { opacity: 0.98, transform: 'translateY(0)' }
        }
      }} />
      <Box
        key={transitionKey}
        data-workflow-route-transition="true"
        sx={{
          minWidth: 0,
          contain: 'layout paint',
          '@media (prefers-reduced-motion: no-preference)': {
            animation: 'workflowFallbackIn 170ms cubic-bezier(.2,.8,.2,1) both'
          },
          '@keyframes workflowFallbackIn': {
            from: { opacity: 0.96, transform: 'translateY(5px)' },
            to: { opacity: 1, transform: 'translateY(0)' }
          }
        }}
      >
        {children}
      </Box>
    </>
  )
}
