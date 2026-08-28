import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { CheckCircle, XCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'

export function AdminVerifications() {
  const { data: verifications, refetch } = useQuery({
    queryKey: ['admin_verifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verifications')
        .select('*, seller:profiles(username, full_name, is_verified, id)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    }
  })

  const handleVerify = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('verifications').update({ status }).eq('id', id)
      if (error) throw error
      toast.success(`Verification ${status}`)
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!verifications) return <div className="p-8 text-center text-slate-500">Loading verifications...</div>

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-500" />
          Pending Verifications
        </h2>
        <p className="text-sm text-slate-500 mt-1">Review seller identification documents to grant verified status.</p>
      </div>

      {verifications.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {verifications.map((v: any) => (
            <li key={v.id} className="p-6 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                  {v.seller.full_name?.charAt(0) || v.seller.username?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{v.seller.full_name || 'No Name Provided'}</p>
                  <p className="text-sm text-slate-500">@{v.seller.username}</p>
                  <div className="flex gap-4 mt-3">
                    <a href={v.document_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">View ID Document</a>
                    <a href={v.selfie_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">View Selfie</a>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={() => handleVerify(v.id, 'approved')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-foreground px-5 py-2.5 rounded-lg hover:bg-emerald-600 font-medium transition-colors shadow-sm shadow-emerald-500/20">
                  <CheckCircle className="h-4 w-4" /> Approve
                </button>
                <button onClick={() => handleVerify(v.id, 'rejected')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 px-5 py-2.5 rounded-lg hover:bg-red-50 hover:border-red-300 font-medium transition-colors">
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">All caught up!</h3>
          <p className="text-slate-500 mt-1">There are no pending verifications at this time.</p>
        </div>
      )}
    </div>
  )
}
