import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { AlertTriangle, CheckCircle, MessagesSquare } from 'lucide-react'
import { toast } from 'sonner'

export function AdminDisputes() {
  const { data: disputes, refetch } = useQuery({
    queryKey: ['admin_disputes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('*, order:orders(tracking_code, total), raiser:profiles(username, full_name)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    }
  })

  const resolveDispute = async (id: string, resolution: 'resolved_buyer' | 'resolved_seller') => {
    try {
      const { error } = await supabase.from('disputes').update({ status: resolution }).eq('id', id)
      if (error) throw error
      toast.success(`Dispute ${resolution.replace('_', ' to ')}`)
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!disputes) return <div className="p-8 text-center text-slate-500">Loading disputes...</div>

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Open Disputes
        </h2>
        <p className="text-sm text-slate-500 mt-1">Review escrow disputes raised by buyers or sellers.</p>
      </div>

      {disputes.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {disputes.map((d: any) => (
            <li key={d.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-md font-semibold tracking-wide uppercase">Escrow Locked</span>
                    <span className="text-sm font-medium text-slate-900">Order: {d.order?.tracking_code}</span>
                    <span className="text-sm text-slate-500">₦{d.order?.total?.toLocaleString()}</span>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-3">
                    <p className="text-sm font-medium text-slate-900 mb-1">Raised by @{d.raiser?.username}</p>
                    <p className="text-sm text-slate-600">"{d.reason}"</p>
                  </div>
                  
                  {d.evidence_urls && d.evidence_urls.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {d.evidence_urls.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="h-16 w-16 rounded-md bg-slate-200 overflow-hidden border border-slate-300 hover:opacity-80 transition-opacity">
                          <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col justify-start gap-2 w-full md:w-48 shrink-0">
                  <button className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-medium text-sm transition-colors">
                    <MessagesSquare className="h-4 w-4" /> Message Parties
                  </button>
                  <div className="h-px bg-slate-200 my-1 w-full" />
                  <button onClick={() => resolveDispute(d.id, 'resolved_buyer')} className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-600 px-4 py-2 rounded-lg font-medium text-sm transition-colors text-left">
                    Refund Buyer
                  </button>
                  <button onClick={() => resolveDispute(d.id, 'resolved_seller')} className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm transition-colors text-left">
                    Pay Seller
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Zero active disputes</h3>
          <p className="text-slate-500 mt-1">All escrow transactions are proceeding smoothly.</p>
        </div>
      )}
    </div>
  )
}
