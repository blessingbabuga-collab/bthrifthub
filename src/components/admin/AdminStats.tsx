import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Users, ShieldCheck, AlertCircle, Banknote } from 'lucide-react'

export function AdminStats() {
  const { data: stats } = useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      // In a real production app, these would be aggregated via an RPC call or edge function for performance
      // Here we will do simple counts for the MVP
      const [
        { count: userCount },
        { count: pendingVerifications },
        { count: openDisputes },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ])

      return {
        totalUsers: userCount || 0,
        pendingVerifications: pendingVerifications || 0,
        openDisputes: openDisputes || 0,
        // Mocked value for Escrow Volume until transactions table is aggregated
        escrowVolume: '₦ 2.4M' 
      }
    }
  })

  const statCards = [
    { name: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Pending Verifications', value: stats?.pendingVerifications || 0, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { name: 'Open Disputes', value: stats?.openDisputes || 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
    { name: 'Escrow Volume', value: stats?.escrowVolume || '₦ 0', icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-100' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((stat, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className={`p-4 rounded-xl ${stat.bg}`}>
            <stat.icon className={`h-6 w-6 ${stat.color}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{stat.name}</p>
            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
          </div>
        </div>
      ))}
    </div>
  )
}
