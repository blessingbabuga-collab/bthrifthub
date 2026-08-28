import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { MobileNav } from '@/components/MobileNav'
import { BackButton } from '@/components/BackButton'

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
      if (error && error.code !== 'PGRST116') throw error
      return data || { available_balance: 0, pending_balance: 0, withdrawn_balance: 0 }
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
      const { data, error } = await (supabase as any)
        .from('bank_accounts')
        .select('*')
        .eq('user_id', userId!)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  const [withdrawing, setWithdrawing] = React.useState(false)
  const qc = useQueryClient()

  if (isWalletLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 sm:pb-0 flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex justify-center py-20 text-muted-foreground">Loading wallet...</div>
        <MobileNav />
      </div>
    )
  }

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
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
      <SiteHeader />
      <div className="container mx-auto py-8 max-w-4xl px-4 animate-fade-in">
        <BackButton fallback="/profile" />
        <h1 className="text-3xl font-display font-bold tracking-tight text-foreground uppercase mt-4 mb-8">Seller Wallet</h1>
        
        {/* Balances Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10">
          <div className="bg-foreground text-background shadow-lg border border-border/10 rounded-[24px] p-6 flex flex-col justify-between min-h-[140px]">
            <h3 className="text-sm font-bold text-background/60 tracking-wider uppercase">Available Balance</h3>
            <p className="text-4xl font-display font-bold tracking-tight">₦{Number(wallet?.available_balance || 0).toLocaleString('en-US')}</p>
          </div>
          <div className="bg-foreground text-background shadow-lg border border-border/10 rounded-[24px] p-6 flex flex-col justify-between min-h-[140px]">
            <h3 className="text-sm font-bold text-background/60 tracking-wider uppercase">Pending Escrow</h3>
            <p className="text-4xl font-display font-bold tracking-tight text-amber">₦{Number(wallet?.pending_balance || 0).toLocaleString('en-US')}</p>
          </div>
          <div className="bg-foreground text-background shadow-lg border border-border/10 rounded-[24px] p-6 flex flex-col justify-between min-h-[140px]">
            <h3 className="text-sm font-bold text-background/60 tracking-wider uppercase">Total Withdrawn</h3>
            <p className="text-4xl font-display font-bold tracking-tight text-background/40">₦{Number(wallet?.withdrawn_balance || 0).toLocaleString('en-US')}</p>
          </div>
        </div>

        <div className="mb-12 p-6 md:p-8 bg-secondary/50 border border-border shadow-sm rounded-[24px] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground mb-1 uppercase font-display">Verified Bank Account</h3>
            {bankAccount ? (
              <p className="text-muted-foreground font-medium">
                <span className="text-foreground font-bold">{(bankAccount as any).bank_name}</span> • {(bankAccount as any).account_number.slice(0, 3)}***{(bankAccount as any).account_number.slice(-4)}
                <br/>
                <span className="text-sm text-muted-foreground uppercase font-bold tracking-widest mt-1 inline-block">{(bankAccount as any).account_name}</span>
              </p>
            ) : (
              <p className="text-destructive text-sm font-bold">No bank account linked. Complete your store setup.</p>
            )}
          </div>
          <button 
             onClick={handleWithdraw}
             className="bg-primary text-primary-foreground shadow-glow hover:opacity-90 active:scale-95 transition-all h-14 px-8 rounded-full font-bold uppercase tracking-widest font-display disabled:opacity-50 disabled:pointer-events-none"
             disabled={!wallet?.available_balance || wallet.available_balance <= 0 || withdrawing || !bankAccount}
           >
             {withdrawing ? "Processing..." : "Withdraw Funds"}
           </button>
        </div>

        {/* Transactions History */}
        <h2 className="text-xl font-display font-bold uppercase tracking-tight text-foreground mb-6">Transaction History</h2>
        
        {isTxLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading transactions...</div>
        ) : transactions && transactions.length > 0 ? (
          <div className="bg-card shadow-sm border border-border rounded-[24px] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold text-muted-foreground tracking-widest uppercase text-xs">Date</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground tracking-widest uppercase text-xs">Description</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground tracking-widest uppercase text-xs">Type</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground tracking-widest uppercase text-xs text-right">Amount</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground tracking-widest uppercase text-xs text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-5 text-muted-foreground whitespace-nowrap font-medium">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-5 text-foreground font-medium">{tx.description || '-'}</td>
                    <td className="px-6 py-5">
                      <span className="capitalize text-muted-foreground font-medium">{tx.type.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-foreground">
                      {tx.type === 'withdrawal' ? '-' : '+'}₦{Number(tx.net_amount).toLocaleString('en-US')}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                        tx.status === 'pending' ? 'bg-amber/10 text-amber border border-amber/20' :
                        'bg-destructive/10 text-destructive border border-destructive/20'
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
          <div className="border border-border border-dashed rounded-[24px] p-16 text-center text-muted-foreground font-medium bg-secondary/30">
            No transactions found.
          </div>
        )}
      </div>
      
      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  )
}
