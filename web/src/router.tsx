import { BarChart3, Building2, ClipboardList, Inbox, SlidersHorizontal, UserCog, Users } from 'lucide-react'
import { createBrowserRouter } from 'react-router'
import { RequireRole } from '@/auth/AuthContext'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { Login } from '@/pages/Login'
import { GetQuote } from '@/pages/public/GetQuote'
import { Home } from '@/pages/public/Home'
import { Portfolio } from '@/pages/public/Portfolio'
import { PortfolioProject } from '@/pages/public/PortfolioProject'
import { PublicLayout } from '@/pages/public/PublicLayout'
import { NotFound, Privacy, ThankYou } from '@/pages/public/SimplePages'

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/portfolio', element: <Portfolio /> },
      { path: '/portfolio/:slug', element: <PortfolioProject /> },
      { path: '/instant-quote', lazy: async () => ({ Component: (await import('@/pages/public/InstantQuote')).InstantQuote }) },
      { path: '/get-quote', element: <GetQuote /> },
      { path: '/thank-you', element: <ThankYou /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/login', element: <Login /> },
  { path: '/contractor/signup', lazy: async () => ({ Component: (await import('@/pages/contractor/ContractorSignup')).ContractorSignup }) },
  {
    path: '/admin',
    element: (
      <RequireRole role="admin">
        <DashboardLayout
          title="Admin"
          nav={[
            { to: '/admin', label: 'Leads', icon: Inbox, end: true },
            { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
            { to: '/admin/contractors', label: 'Contractors', icon: Users },
            { to: '/admin/scoring', label: 'Scoring rules', icon: SlidersHorizontal },
          ]}
        />
      </RequireRole>
    ),
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/pages/admin/AdminLeads')).AdminLeads }) },
      { path: 'leads/:id', lazy: async () => ({ Component: (await import('@/pages/admin/AdminLeadDetail')).AdminLeadDetail }) },
      { path: 'analytics', lazy: async () => ({ Component: (await import('@/pages/admin/AdminAnalytics')).AdminAnalytics }) },
      { path: 'contractors', lazy: async () => ({ Component: (await import('@/pages/admin/AdminContractors')).AdminContractors }) },
      { path: 'scoring', lazy: async () => ({ Component: (await import('@/pages/admin/AdminScoring')).AdminScoring }) },
    ],
  },
  {
    path: '/contractor',
    element: (
      <RequireRole role="contractor">
        <DashboardLayout
          title="Contractor portal"
          nav={[
            { to: '/contractor', label: 'Available leads', icon: ClipboardList, end: true },
            { to: '/contractor/purchased', label: 'My leads', icon: Building2 },
            { to: '/contractor/profile', label: 'Company profile', icon: UserCog },
          ]}
        />
      </RequireRole>
    ),
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/pages/contractor/ContractorLeads')).AvailableLeads }) },
      { path: 'purchased', lazy: async () => ({ Component: (await import('@/pages/contractor/ContractorLeads')).PurchasedLeads }) },
      { path: 'leads/:id', lazy: async () => ({ Component: (await import('@/pages/contractor/ContractorLeadDetail')).ContractorLeadDetail }) },
      { path: 'profile', lazy: async () => ({ Component: (await import('@/pages/contractor/ContractorProfile')).ContractorProfile }) },
    ],
  },
])
