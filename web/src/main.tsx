import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthContext'
import { captureUtm } from '@/lib/utm'
import { startWarmup } from '@/lib/warmup'
import { router } from './router'
import './index.css'

captureUtm()
startWarmup()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
