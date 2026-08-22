// @ts-nocheck
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Store, Building2, UserCircle, Phone, Mail, MapPin, CheckCircle2 } from 'lucide-react'

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
  const [bankCode, setBankCode] = useState('044') // Default Access Bank for UI testing
  const [accountNumber, setAccountNumber] = useState('')
  const [validatedName, setValidatedName] = useState('')
  const [isBankValidating, setIsBankValidating] = useState(false)

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) setStep(2)
  }

  const validateBank = async () => {
    if (accountNumber.length !== 10) {
      toast.error("Account number must be 10 digits")
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
    // Ensure validated name matches rep name (case-insensitive fuzzy match in production, exact for MVP)
    if (!validatedName || validatedName.toLowerCase() !== repName.toLowerCase()) {
      toast.error("Bank account name must match Representative Name precisely.")
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
          location: city,
          role: 'seller' // Upgrade to seller
        })
        .eq('id', session?.user?.id)
      
      if (profileError) throw profileError

      // 2. Save Bank Account
      const { error: bankError } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: session?.user?.id,
          bank_code: bankCode,
          bank_name: "Selected Bank", // Ideally mapped from bankCode
          account_number: accountNumber,
          account_name: validatedName
        })
      
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
        <h1 className="text-3xl font-bold text-slate-900">Set Up Your Store</h1>
        <p className="mt-2 text-slate-500">Become a seller and open your digital wardrobe.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Progress Bar */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <div className={`flex-1 text-center py-4 text-sm font-medium border-b-2 ${step === 1 ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>
            1. Business Info
          </div>
          <div className={`flex-1 text-center py-4 text-sm font-medium border-b-2 ${step === 2 ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>
            2. Bank Setup
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><Building2 className="h-4 w-4"/> Business Name</label>
                  <input required value={businessName} onChange={e => setBusinessName(e.target.value)} type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" placeholder="e.g. Bella's Boutique" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><UserCircle className="h-4 w-4"/> Representative Name</label>
                  <input required value={repName} onChange={e => setRepName(e.target.value)} type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" placeholder="Full Name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><Phone className="h-4 w-4"/> Phone Number</label>
                  <input required value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" placeholder="+234..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><Mail className="h-4 w-4"/> Business Email</label>
                  <input required value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" placeholder="store@example.com" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><MapPin className="h-4 w-4"/> City / Operation Base</label>
                  <input required value={city} onChange={e => setCity(e.target.value)} type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" placeholder="e.g. Lagos, Abuja" />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                  Continue
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-100 flex gap-3">
                <Store className="h-5 w-5 shrink-0 mt-0.5" />
                <p>For payout security, your bank account name must strictly match the Representative Name provided: <strong>{repName}</strong>.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bank Code</label>
                  <select value={bankCode} onChange={e => setBankCode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500">
                    <option value="044">Access Bank</option>
                    <option value="011">First Bank</option>
                    <option value="058">GTBank</option>
                    <option value="033">UBA</option>
                    <option value="057">Zenith Bank</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                  <div className="flex gap-3">
                    <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} type="text" maxLength={10} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" placeholder="0000000000" />
                    <button onClick={validateBank} disabled={isBankValidating || accountNumber.length !== 10} className="bg-slate-100 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors">
                      {isBankValidating ? 'Checking...' : 'Validate'}
                    </button>
                  </div>
                </div>

                {validatedName && (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Validated Account</p>
                      <p className="font-medium text-emerald-900">{validatedName}</p>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-between">
                <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-900 font-medium px-4 py-2">
                  Back
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={isLoading || !validatedName}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
