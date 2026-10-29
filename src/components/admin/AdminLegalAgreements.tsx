// @ts-nocheck
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { FileText, Save, CheckCircle2, History, AlertCircle, Eye } from 'lucide-react'

type LegalAgreement = {
  id: string
  title: string
  content: string
  version: number
  updated_at: string
}

export function AdminLegalAgreements() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<'terms_and_conditions' | 'privacy_policy'>('terms_and_conditions')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ['admin-legal-agreements'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('legal_agreements')
        .select('*')
        .order('id')
      if (error) throw error
      return data as LegalAgreement[]
    },
    onSuccess: (data) => {
      const current = data.find((a) => a.id === selectedId)
      if (current && !title && !content) {
        setTitle(current.title)
        setContent(current.content)
      }
    },
  })

  const currentAgreement = agreements.find((a) => a.id === selectedId)

  // When switching tabs, update local state
  const handleSelectTab = (id: 'terms_and_conditions' | 'privacy_policy') => {
    setSelectedId(id)
    const target = agreements.find((a) => a.id === id)
    if (target) {
      setTitle(target.title)
      setContent(target.content)
    }
  }

  // Count recent consents for stats
  const { data: consentStats } = useQuery({
    queryKey: ['admin-consent-stats', selectedId],
    queryFn: async () => {
      const { data, count, error } = await (supabase as any)
        .from('user_legal_consents')
        .select('id, agreed_at, version', { count: 'exact' })
        .eq('agreement_id', selectedId)
      if (error) return { total: 0 }
      return { total: count || 0 }
    },
  })

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required')
      return
    }

    const hasChanged = currentAgreement && (currentAgreement.title !== title || currentAgreement.content !== content)
    if (!hasChanged) {
      toast.info('No changes detected.')
      return
    }

    const nextVersion = (currentAgreement?.version || 1) + 1
    const confirmSave = confirm(
      `Saving will publish Version ${nextVersion} of "${title}".\n\nExisting users will be required to re-agree to these terms next time they sign in. Do you want to proceed?`
    )
    if (!confirmSave) return

    setSaving(true)
    try {
      const { error } = await (supabase as any)
        .from('legal_agreements')
        .upsert({
          id: selectedId,
          title: title.trim(),
          content: content.trim(),
          version: nextVersion,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      toast.success(`Published ${title} (v${nextVersion})! Users will be prompted to re-agree on login.`)
      qc.invalidateQueries({ queryKey: ['admin-legal-agreements'] })
      qc.invalidateQueries({ queryKey: ['legal-agreements'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to save agreement')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Legal Agreements & Policies</h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure Terms & Conditions and Privacy Policy. Modifying these increments the version and prompts all users to re-agree.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Back to Editor' : 'Live Preview'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Publishing...' : 'Save & Publish Version'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => handleSelectTab('terms_and_conditions')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${
            selectedId === 'terms_and_conditions'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Terms & Conditions (v{agreements.find((a) => a.id === 'terms_and_conditions')?.version || 1})
        </button>
        <button
          onClick={() => handleSelectTab('privacy_policy')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${
            selectedId === 'privacy_policy'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Privacy Agreement (v{agreements.find((a) => a.id === 'privacy_policy')?.version || 1})
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-semibold text-sm mb-1">Enforcement & Auditing Rules</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>New Registrations:</strong> Users must review and accept both agreements before creating an account.</li>
            <li><strong>Existing Users:</strong> Whenever you edit and save this content, the version bumps automatically, and returning users must re-agree on login before accessing the platform.</li>
            <li><strong>Audit Logs & Profile Copy:</strong> Every agreement acceptance is permanently logged with an exact snapshot of the text and timestamp. Users can review their agreed copy anytime in their Profile.</li>
          </ul>
        </div>
      </div>

      {/* Form / Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Terms and Conditions"
              className="w-full text-lg font-bold text-slate-900 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active Version: {currentAgreement?.version || 1}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Last updated: {currentAgreement?.updated_at ? new Date(currentAgreement.updated_at).toLocaleDateString() : 'Never'}
            </p>
          </div>
        </div>

        {previewMode ? (
          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 min-h-[400px]">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">{title}</h3>
            <div className="prose prose-slate max-w-none text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
              {content}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Agreement Content (Markdown Supported: ## Headings, - Lists, **Bold**)
              </label>
              <span className="text-xs text-slate-400">{content.length} characters</span>
            </div>
            <textarea
              rows={18}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter agreement terms here..."
              className="w-full font-mono text-sm text-slate-800 bg-slate-50/40 border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  )
}
