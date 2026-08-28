// @ts-nocheck
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Store, Building2, UserCircle, Phone, Mail, MapPin, CheckCircle2, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/_authenticated/store-setup')({
  component: StoreSetup,
})

function StoreSetup() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Step 1: Business Details
  const [businessName, setBusinessName] = useState('')
  const [repName, setRepName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')

  // Step 2: Bank Details
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [validatedName, setValidatedName] = useState('')
  const [isBankValidating, setIsBankValidating] = useState(false)

  // Fetch all Nigerian Banks from Paystack
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

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) setStep(2)
  }

  const validateBank = async () => {
    if (accountNumber.length !== 10) {
      toast.error("Account number must be 10 digits")
      return
    }
    if (!bankCode) {
      toast.error("Please select a bank")
      return
    }

    setIsBankValidating(true)
    try {
      const { data, error } = await supabase.functions.invoke('paystack-validate-bank', {
        body: { account_number: accountNumber, bank_code: bankCode }
      })

      if (error || !data || data.error) {
        throw new Error(data?.error || "Failed to validate account")
      }

      setValidatedName(data.account_name)
      toast.success("Bank account validated!")
    } catch (err: any) {
      toast.error(err.message)
      setValidatedName('')
    } finally {
      setIsBankValidating(false)
    }
  }

  const handleSubmit = async () => {
    if (!validatedName) {
      toast.error("Please validate your bank account first")
      return
    }

    setIsLoading(true)
    try {
      // 1. Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          business_name: businessName,
          rep_name: repName,
          phone_number: phone,
          email: email,
          location: city
        })
        .eq('id', session?.user?.id)
      
      if (profileError) throw profileError

      // Get the selected bank name
      const selectedBank = banks?.find(b => b.code === bankCode)

      // 2. Save Bank Account
      const { error: bankError } = await supabase
        .from('bank_accounts')
        .upsert({
          user_id: session?.user?.id,
          bank_code: bankCode,
          bank_name: selectedBank?.name || "Unknown Bank",
          account_number: accountNumber,
          account_name: validatedName
        }, { onConflict: 'user_id' })
      
      if (bankError) throw bankError

      toast.success("Store setup complete!")
      navigate({ to: '/wardrobe/$username', params: { username: session?.user?.user_metadata?.username || 'me' }})
      
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold text-foreground">Set Up Your Store</h1>
        <p className="mt-2 text-muted-foreground">Become a seller and open your digital wardrobe.</p>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Progress Bar */}
        <div className="flex border-b border-border bg-secondary/50">
          <div className={`flex-1 text-center py-4 text-sm font-medium border-b-2 ${step === 1 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
            1. Business Info
          </div>
          <div className={`flex-1 text-center py-4 text-sm font-medium border-b-2 ${step === 2 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
            2. Bank Setup
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2"><Building2 className="h-4 w-4"/> Business Name</label>
                  <input required value={businessName} onChange={e => setBusinessName(e.target.value)} type="text" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background" placeholder="e.g. Bella's Boutique" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2"><UserCircle className="h-4 w-4"/> Representative Name</label>
                  <input required value={repName} onChange={e => setRepName(e.target.value)} type="text" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background" placeholder="Full Name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2"><Phone className="h-4 w-4"/> Phone Number</label>
                  <input required value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background" placeholder="+234..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2"><Mail className="h-4 w-4"/> Business Email</label>
                  <input required value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background" placeholder="store@example.com" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2"><MapPin className="h-4 w-4"/> City / Operation Base</label>
                  <input required value={city} onChange={e => setCity(e.target.value)} type="text" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background" placeholder="e.g. Lagos, Abuja" />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full font-semibold hover:opacity-90 transition-opacity shadow-glow">
                  Continue
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-500/10 text-blue-600 p-4 rounded-xl text-sm border border-blue-500/20 flex gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p>For payout security, we verify your bank account name against your business details.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Bank Name</label>
                  <select value={bankCode} onChange={e => {setBankCode(e.target.value); setValidatedName('');}} disabled={isBanksLoading} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background">
                    <option value="" disabled>Select your bank</option>
                    {isBanksLoading && <option value="">Loading banks...</option>}
                    {banks?.map((b, i) => (
                      <option key={`${b.code}-${i}`} value={b.code}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Account Number</label>
                  <div className="flex gap-3">
                    <input value={accountNumber} onChange={e => {setAccountNumber(e.target.value); setValidatedName('');}} type="text" maxLength={10} className="flex-1 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background" placeholder="0000000000" />
                    <button onClick={validateBank} disabled={isBankValidating || accountNumber.length !== 10 || !bankCode} className="bg-amber text-amber-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-colors shadow-amber">
                      {isBankValidating ? 'Checking...' : 'Validate'}
                    </button>
                  </div>
                </div>

                {validatedName && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Validated Account</p>
                      <p className="font-medium text-emerald-600">{validatedName}</p>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground font-medium px-4 py-2">
                  Back
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={isLoading || !validatedName}
                  className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-glow"
                >
                  {isLoading ? 'Setting up...' : 'Create Store'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
