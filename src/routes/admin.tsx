// @ts-nocheck
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { ShieldCheck, Users, FileText, AlertTriangle, Activity, LogOut, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { AdminStats } from '@/components/admin/AdminStats'
import { AdminVerifications } from '@/components/admin/AdminVerifications'
import { AdminDisputes } from '@/components/admin/AdminDisputes'
import { AdminUsers } from '@/components/admin/AdminUsers'
import { AdminEmailTemplates } from '@/components/admin/AdminEmailTemplates'

export const Route = createFileRoute('/admin')({
  component: AdminDashboard,
})

type Tab = 'overview' | 'users' | 'verifications' | 'disputes' | 'emails'

function AdminDashboard() {
  const { session, loading: isAuthLoading } = useAuth()
  const userId = session?.user?.id
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      return data
    }
  })

  useEffect(() => {
    if (!isAuthLoading && !isProfileLoading) {
      if (!userId || (profile && profile.role !== 'admin')) {
        toast.error('Unauthorized. Admins only.')
        navigate({ to: '/' })
      }
    }
  }, [userId, profile, isProfileLoading, isAuthLoading, navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  if (isAuthLoading || isProfileLoading || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Authenticating Admin...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'verifications', label: 'Verifications', icon: FileText },
    { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
    { id: 'emails', label: 'Emails', icon: Mail },
  ] as const

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">BTHRIFTS Admin</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                View App
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">@{profile?.username}</span>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
                  title="Log out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* TABS */}
        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl mb-8 w-fit overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                  ${isActive 
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }
                `}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* CONTENT */}
        <main>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <AdminStats />
              <div className="grid lg:grid-cols-2 gap-6">
                <AdminVerifications />
                <AdminDisputes />
              </div>
            </div>
          )}
          {activeTab === 'users' && <AdminUsers />}
          {activeTab === 'verifications' && <AdminVerifications />}
          {activeTab === 'disputes' && <AdminDisputes />}
          {activeTab === 'emails' && <AdminEmailTemplates />}
        </main>
      </div>
    </div>
  )
}
