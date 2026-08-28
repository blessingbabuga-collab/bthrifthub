import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Search, ShieldAlert, ShieldCheck, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'

export function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState('')

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin_users', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
        
      if (searchTerm) {
        query = query.or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data
    }
  })

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage all registered buyers and sellers.</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search users..." 
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading users...</td></tr>
            ) : users && users.length > 0 ? (
              users.map((user: any) => (
                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                        {user.full_name?.charAt(0) || user.username?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.full_name || 'No Name'}</p>
                        <p className="text-slate-500">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_verified ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <ShieldCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        <ShieldAlert className="h-3.5 w-3.5" /> Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-slate-700">{user.role}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={async () => {
                          try {
                            const newStatus = !user.is_verified
                            const { error } = await supabase.from('profiles').update({ is_verified: newStatus }).eq('id', user.id)
                            if (error) throw error
                            toast.success(`User ${newStatus ? 'Verified' : 'Unverified'}`)
                            refetch()
                          } catch (err: any) {
                            toast.error(err.message)
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        {user.is_verified ? 'Unverify' : 'Verify'}
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            const newRole = user.role === 'admin' ? 'user' : 'admin'
                            const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
                            if (error) throw error
                            toast.success(`User role changed to ${newRole}`)
                            refetch()
                          } catch (err: any) {
                            toast.error(err.message)
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Make {user.role === 'admin' ? 'User' : 'Admin'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
