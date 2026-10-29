import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { MobileNav } from '@/components/MobileNav'
import { BackButton } from '@/components/BackButton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Building2, CheckCircle2, Loader2, PencilLine } from 'lucide-react'
import { sendPlatformEmail } from '@/lib/resend'

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
        .maybeSingle()
      if (error) throw error
      return (data || { id: '', available_balance: 0, pending_balance: 0, withdrawn_balance: 0 }) as any
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
      return data || []
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
        .maybeSingle()
      if (error) throw error
      return data
    }
  })

  const [withdrawing, setWithdrawing] = React.useState(false)
  const [bankModalOpen, setBankModalOpen] = React.useState(false)
  const [bankCode, setBankCode] = React.useState('')
  const [accountNumber, setAccountNumber] = React.useState('')
  const [validatedName, setValidatedName] = React.useState('')
  const [isValidatingBank, setIsValidatingBank] = React.useState(false)
  const [isSavingBank, setIsSavingBank] = React.useState(false)
  const qc = useQueryClient()

  // Fetch list of Nigerian banks from Paystack
  const { data: banks, isLoading: isBanksLoading } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const res = await fetch('https://api.paystack.co/bank?country=nigeria')
      const json = await res.json()
      if (json.status && json.data) {
        return json.data as { name: string, code: string }[]
      }
      return []
    }
  })

  // Validate bank account via Paystack Edge Function
  const handleValidateAccount = async () => {
    if (accountNumber.length !== 10) {
      toast.error("Account number must be exactly 10 digits")
      return
    }
    if (!bankCode) {
      toast.error("Please select a bank")
      return
    }

    setIsValidatingBank(true)
    try {
      const { data, error } = await supabase.functions.invoke('paystack-validate-bank', {
        body: { account_number: accountNumber, bank_code: bankCode }
      })

      if (error || !data || data.error) {
        throw new Error(data?.error || "Failed to resolve account name")
      }

      setValidatedName(data.account_name)
      toast.success("Account name verified!")
    } catch (err: any) {
      toast.error(err.message || "Invalid account details")
      setValidatedName('')
    } finally {
      setIsValidatingBank(false)
    }
  }

  // Save bank account to database
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validatedName) {
      toast.error("Please verify account number first")
      return
    }

    setIsSavingBank(true)
    try {
      const selectedBank = banks?.find(b => b.code === bankCode)
      const { error } = await (supabase as any)
        .from('bank_accounts')
        .upsert({
          user_id: userId,
          bank_code: bankCode,
          bank_name: selectedBank?.name || "Unknown Bank",
          account_number: accountNumber,
          account_name: validatedName
        }, { onConflict: 'user_id' })

      if (error) throw error

      toast.success("Bank account updated successfully!")
      setBankModalOpen(false)
      qc.invalidateQueries({ queryKey: ['bankAccount', userId] })
    } catch (err: any) {
      toast.error(err.message || "Could not save bank account")
    } finally {
      setIsSavingBank(false)
    }
  }

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

      // Trigger transactional email via Resend
      sendPlatformEmail({
        event_type: "withdrawal_requested",
        target_user_id: userId,
        variables: { amount: `₦${amount}` }
      }).catch(() => {});
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
          <div className="flex-1">
            <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
              <h3 className="text-lg font-bold tracking-tight text-foreground uppercase font-display flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Verified Bank Account
              </h3>
              <button 
                onClick={() => {
                  if (bankAccount) {
                    setBankCode((bankAccount as any).bank_code || '')
                    setAccountNumber((bankAccount as any).account_number || '')
                    setValidatedName((bankAccount as any).account_name || '')
                  }
                  setBankModalOpen(true)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline transition-all"
              >
                <PencilLine className="h-3.5 w-3.5" />
                {bankAccount ? "Change Bank Account" : "Link Bank Account"}
              </button>
            </div>
            {bankAccount ? (
              <p className="text-muted-foreground font-medium">
                <span className="text-foreground font-bold">{(bankAccount as any).bank_name}</span> • {(bankAccount as any).account_number.slice(0, 3)}***{(bankAccount as any).account_number.slice(-4)}
                <br/>
                <span className="text-sm text-muted-foreground uppercase font-bold tracking-widest mt-1 inline-block">{(bankAccount as any).account_name}</span>
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-destructive text-sm font-bold">No bank account linked yet.</p>
                <button
                  onClick={() => setBankModalOpen(true)}
                  className="text-xs text-primary underline font-bold"
                >
                  Link now
                </button>
              </div>
            )}
          </div>
          <button 
             onClick={handleWithdraw}
             className="bg-primary text-primary-foreground shadow-glow hover:opacity-90 active:scale-95 transition-all h-14 px-8 rounded-full font-bold uppercase tracking-widest font-display disabled:opacity-50 disabled:pointer-events-none shrink-0"
             disabled={!wallet?.available_balance || wallet.available_balance <= 0 || withdrawing || !bankAccount}
           >
             {withdrawing ? "Processing..." : "Withdraw Funds"}
           </button>
        </div>

        {/* Bank Account Update Modal */}
        <Dialog open={bankModalOpen} onOpenChange={setBankModalOpen}>
          <DialogContent className="sm:max-w-md p-6 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl tracking-tight text-foreground font-bold">
                {bankAccount ? "Update Bank Account" : "Link Bank Account"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveBank} className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
                  Select Bank
                </label>
                <select
                  value={bankCode}
                  onChange={(e) => {
                    setBankCode(e.target.value)
                    setValidatedName('')
                  }}
                  disabled={isBanksLoading}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                >
                  <option value="">{isBanksLoading ? "Loading banks..." : "-- Choose Your Bank --"}</option>
                  {banks?.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
                  Account Number (10 Digits)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="0123456789"
                    value={accountNumber}
                    onChange={(e) => {
                      setAccountNumber(e.target.value.replace(/\D/g, ""))
                      setValidatedName('')
                    }}
                    className="flex-1 h-12 px-4 rounded-xl border border-border bg-background font-mono text-base tracking-wider focus:ring-2 focus:ring-primary focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleValidateAccount}
                    disabled={isValidatingBank || accountNumber.length !== 10 || !bankCode}
                    className="px-5 h-12 rounded-xl bg-secondary text-foreground text-xs font-bold hover:bg-secondary/80 disabled:opacity-50 transition-all shrink-0"
                  >
                    {isValidatingBank ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                  </button>
                </div>
              </div>

              {validatedName && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-start gap-2.5 animate-fade-in">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/80">Account Name Verified</p>
                    <p className="font-bold text-sm text-emerald-700">{validatedName}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  className="px-5 h-11 rounded-full text-sm font-bold text-muted-foreground hover:bg-secondary transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!validatedName || isSavingBank}
                  className="px-6 h-11 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-glow hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {isSavingBank ? "Saving..." : "Save Bank Details"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Transactions History */}
        <h2 className="text-xl font-display font-bold uppercase tracking-tight text-foreground mb-6">Transaction History</h2>
        
        {isTxLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading transactions...</div>
        ) : transactions && transactions.length > 0 ? (
          <div>
            {/* Desktop / Tablet Table View */}
            <div className="hidden md:block bg-card shadow-sm border border-border rounded-[24px] overflow-hidden overflow-x-auto">
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

            {/* Mobile Responsive Cards */}
            <div className="md:hidden space-y-3">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-foreground line-clamp-2">{tx.description || tx.type.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full shrink-0 ${
                      tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                      tx.status === 'pending' ? 'bg-amber/10 text-amber border border-amber/20' :
                      'bg-destructive/10 text-destructive border border-destructive/20'
                    }`}>
                      {tx.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="capitalize text-muted-foreground font-medium bg-secondary px-2 py-0.5 rounded-md">
                      {tx.type.replace('_', ' ')}
                    </span>
                    <span className={`font-mono text-base font-bold ${tx.type === 'withdrawal' ? 'text-destructive' : 'text-emerald-500'}`}>
                      {tx.type === 'withdrawal' ? '-' : '+'}₦{Number(tx.net_amount).toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
