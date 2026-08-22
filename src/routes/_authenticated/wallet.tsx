import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/_authenticated/wallet')({
  component: WalletRoute,
})

function WalletRoute() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: wallet, isLoading: isWalletLoading } = useQuery({
    queryKey: ['wallet', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId!)
        .single()
      if (error) throw error
      return data
    }
  })

  const { data: transactions, isLoading: isTxLoading } = useQuery({
    queryKey: ['transactions', wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', wallet!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    }
  })

  const { data: bankAccount } = useQuery({
    queryKey: ['bankAccount', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', userId!)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  if (isWalletLoading) return <div className="p-8 text-center text-gray-500">Loading wallet...</div>

  const [withdrawing, setWithdrawing] = React.useState(false)
  const qc = useQueryClient()

  const handleWithdraw = async () => {
    if (!wallet || wallet.available_balance <= 0) return;
    const amountStr = window.prompt(`How much would you like to withdraw? (Available: ₦${wallet.available_balance})`);
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > wallet.available_balance) {
      alert("Invalid amount");
      return;
    }
    setWithdrawing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + "/functions/v1/paystack-withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      alert("Withdrawal initiated successfully");
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["transactions", wallet.id] });

      // Trigger transactional email
      supabase.functions.invoke("send-email", {
        body: {
          event_type: "withdrawal_requested",
          target_user_id: userId,
          variables: { amount: `₦${amount}` }
        }
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="container mx-auto py-12 max-w-4xl px-4 animate-fade-in">
      <h1 className="text-3xl font-display tracking-tight text-white/95 mb-8">Seller Wallet</h1>
      
      {/* Balances Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#15151a] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] border border-white/5 rounded-[24px] p-8 flex flex-col justify-between h-40">
          <h3 className="text-sm font-medium text-white/50 tracking-tight">Available Balance</h3>
          <p className="text-4xl font-bold tracking-tight text-white/95">₦{wallet?.available_balance || '0.00'}</p>
        </div>
        <div className="bg-[#15151a] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] border border-white/5 rounded-[24px] p-8 flex flex-col justify-between h-40">
          <h3 className="text-sm font-medium text-white/50 tracking-tight">Pending Escrow</h3>
          <p className="text-4xl font-bold tracking-tight text-amber-500">₦{wallet?.pending_balance || '0.00'}</p>
        </div>
        <div className="bg-[#15151a] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] border border-white/5 rounded-[24px] p-8 flex flex-col justify-between h-40">
          <h3 className="text-sm font-medium text-white/50 tracking-tight">Total Withdrawn</h3>
          <p className="text-4xl font-bold tracking-tight text-white/30">₦{wallet?.withdrawn_balance || '0.00'}</p>
        </div>
      </div>

      <div className="mb-12 p-8 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 shadow-2xl rounded-[24px] flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium tracking-tight text-white/90 mb-1">Verified Bank Account</h3>
          {bankAccount ? (
            <p className="text-white/60 font-medium">
              <span className="text-white/95">{bankAccount.bank_name}</span> • {bankAccount.account_number.slice(0, 3)}***{bankAccount.account_number.slice(-4)}
              <br/>
              <span className="text-sm text-white/40">{bankAccount.account_name}</span>
            </p>
          ) : (
            <p className="text-red-400 text-sm font-medium">No bank account linked. Complete your store setup.</p>
          )}
        </div>
        <button 
           onClick={handleWithdraw}
           className="bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_14px_0_rgba(245,158,11,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_20px_0_rgba(245,158,11,0.4)] hover:-translate-y-0.5 active:scale-95 transition-all h-12 px-8 rounded-full font-bold text-sm disabled:opacity-50 disabled:pointer-events-none"
           disabled={!wallet?.available_balance || wallet.available_balance <= 0 || withdrawing || !bankAccount}
         >
           {withdrawing ? "Processing..." : "Withdraw Funds"}
         </button>
      </div>

      {/* Transactions History */}
      <h2 className="text-xl font-display tracking-tight text-white/90 mb-6">Transaction History</h2>
      
      {isTxLoading ? (
        <div className="text-center py-12 text-white/40">Loading transactions...</div>
      ) : transactions && transactions.length > 0 ? (
        <div className="bg-[#15151a] shadow-2xl border border-white/5 rounded-[24px] overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-black/20 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium text-white/50 tracking-tight">Date</th>
                <th className="px-6 py-4 font-medium text-white/50 tracking-tight">Description</th>
                <th className="px-6 py-4 font-medium text-white/50 tracking-tight">Type</th>
                <th className="px-6 py-4 font-medium text-white/50 tracking-tight text-right">Amount</th>
                <th className="px-6 py-4 font-medium text-white/50 tracking-tight text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((tx: { id: string, created_at: string, description: string, type: string, net_amount: number, status: string }) => (
                <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-5 text-white/50 whitespace-nowrap font-medium">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-5 text-white/80 font-medium">{tx.description || '-'}</td>
                  <td className="px-6 py-5">
                    <span className="capitalize text-white/60 font-medium">{tx.type.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-white/95">
                    {tx.type === 'withdrawal' ? '-' : '+'}₦{tx.net_amount}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      tx.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      tx.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-white/5 border-dashed rounded-[24px] p-16 text-center text-white/40 font-medium bg-[#15151a]/50">
          No transactions found.
        </div>
      )}
    </div>
  )
}
