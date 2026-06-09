import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'

export function useWorkflowNavigate() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback((to, options = {}) => {
    const nextOptions = buildWorkflowNavigateOptions(options, location)
    if (typeof to === 'number') {
      runTransition(() => navigate(to), options)
      return
    }
    runTransition(() => navigate(to, nextOptions), options)
  }, [location.pathname, location.search, navigate])
}

export function workflowNavigate(navigate, to, options = {}) {
  if (typeof navigate !== 'function') return false
  runTransition(() => navigate(to, options), options)
  return true
}

function buildWorkflowNavigateOptions(options, location) {
  const currentPath = `${location.pathname}${location.search}`
  return {
    ...options,
    state: {
      from: currentPath,
      workflowNavigation: true,
      ...(options.state || {})
    }
  }
}

function runTransition(navigateAction, options = {}) {
  if (typeof document === 'undefined' || options.viewTransition === false || prefersReducedMotion()) {
    navigateAction()
    return
  }

  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => {
      flushSync(navigateAction)
    })
    return
  }

  navigateAction()
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
