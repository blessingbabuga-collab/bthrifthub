import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { ShieldAlert, FileText, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

type LegalAgreement = {
  id: string
  title: string
  content: string
  version: number
  updated_at: string
}

type UserConsent = {
  agreement_id: string
  version: number
  agreed_at: string
}

export function ReconsentModal() {
  const { session } = useAuth()
  const userId = session?.user?.id
  const qc = useQueryClient()

  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [agreedMap, setAgreedMap] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)

  // 1. Fetch active legal agreements
  const { data: agreements = [], isLoading: isLoadingAgreements } = useQuery({
    queryKey: ['active-legal-agreements'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('legal_agreements')
        .select('*')
      if (error) return []
      return (data || []) as LegalAgreement[]
    },
  })

  // 2. Fetch user consents
  const { data: userConsents = [], isLoading: isLoadingConsents } = useQuery({
    queryKey: ['user-legal-consents', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_legal_consents')
        .select('agreement_id, version, agreed_at')
        .eq('user_id', userId)
      if (error) return []
      return (data || []) as UserConsent[]
    },
  })

  // Determine which agreements need user consent (either never agreed or agreed to an older version)
  const pendingAgreements = agreements.filter((ag) => {
    const matchingConsent = userConsents.find(
      (c) => c.agreement_id === ag.id && c.version >= ag.version
    )
    return !matchingConsent
  })

  const hasPending = !!userId && !isLoadingAgreements && !isLoadingConsents && pendingAgreements.length > 0

  const handleToggleCheck = (id: string) => {
    setAgreedMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const allChecked = pendingAgreements.every((ag) => !!agreedMap[ag.id])

  const handleSubmit = async () => {
    if (!allChecked) {
      toast.error('Please read and agree to all updated legal policies to continue.')
      return
    }

    setSubmitting(true)
    try {
      const consentsToInsert = pendingAgreements.map((ag) => ({
        user_id: userId,
        agreement_id: ag.id,
        version: ag.version,
        agreement_title: ag.title,
        agreement_content_snapshot: ag.content,
      }))

      const { error } = await (supabase as any)
        .from('user_legal_consents')
        .upsert(consentsToInsert, { onConflict: 'user_id, agreement_id, version' })

      if (error) throw error

      toast.success('Thank you! Legal policies accepted.')
      qc.invalidateQueries({ queryKey: ['user-legal-consents', userId] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit acceptance.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!hasPending) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-card border border-border w-full max-w-xl max-h-[90vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-amber-500/10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-foreground">Updated Legal Terms</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              We have updated our platform agreements. To protect your rights, escrow security, and privacy on Bthrifts, please review and accept the latest versions to continue using your account.
            </p>
          </div>
        </div>

        {/* Scrollable list of pending agreements */}
        <div className="p-6 overflow-y-auto space-y-4">
          {pendingAgreements.map((ag) => {
            const isExpanded = expandedDoc === ag.id
            const isAgreed = !!agreedMap[ag.id]

            return (
              <div 
                key={ag.id}
                className="border border-border rounded-2xl overflow-hidden bg-secondary/20 transition-all"
              >
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        {ag.title}
                        <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          v{ag.version}
                        </span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Updated {new Date(ag.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedDoc(isExpanded ? null : ag.id)}
                    className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline px-2 py-1"
                  >
                    {isExpanded ? (
                      <>
                        Collapse <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        Review <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-border bg-background/80 max-h-60 overflow-y-auto text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {ag.content}
                  </div>
                )}

                <div className="p-3 bg-secondary/40 border-t border-border flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAgreed}
                      onChange={() => handleToggleCheck(ag.id)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0 accent-emerald-600"
                    />
                    <span>I have read and agree to the {ag.title}</span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-border bg-secondary/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {allChecked ? 'All agreements checked' : 'Accept all to proceed'}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allChecked || submitting}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-glow hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
