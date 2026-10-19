import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthContext'
import { initAnalytics } from '@/lib/track'
import { captureUtm } from '@/lib/utm'
import { startWarmup } from '@/lib/warmup'
import { router } from './router'
import './index.css'

captureUtm()
initAnalytics()
startWarmup()

// Public pages arrive as prerendered HTML. Render once the router has loaded the current route's code,
// so that HTML is replaced in a single step instead of flashing blank while a lazy route loads.
if (!router.state.initialized) {
  await new Promise<void>((resolve) => {
    const unsubscribe = router.subscribe((state) => {
      if (state.initialized) {
        unsubscribe()
        resolve()
      }
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
