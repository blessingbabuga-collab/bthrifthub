import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Percent, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export function AdminCommissionSettings() {
  const queryClient = useQueryClient()
  const [percentInput, setPercentInput] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)

  const { data: setting, isLoading } = useQuery({
    queryKey: ['platform-commission-setting'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('key', 'platform_commission_percent')
        .maybeSingle()
      if (error) throw error
      if (data) {
        setPercentInput(data.value)
      }
      return data
    }
  })

  const updateCommissionMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const num = Number(newValue)
      if (isNaN(num) || num < 0 || num > 100) {
        throw new Error('Please enter a valid percentage between 0 and 100')
      }

      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'platform_commission_percent',
          value: num.toString(),
          description: 'Platform commission percentage deducted from merchant sales',
          updated_at: new Date().toISOString()
        })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Platform commission fee updated successfully!')
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['platform-commission-setting'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update commission fee')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateCommissionMutation.mutate(percentInput)
  }

  const currentPercent = setting?.value || '8'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
          <Percent className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Platform Commission Fee</h2>
          <p className="text-xs text-slate-500">
            Control the percentage BTHRIFTS earns on each merchant transaction held in escrow.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 mb-6 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Current Rate
          </span>
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {isLoading ? '...' : `${currentPercent}%`}
          </span>
        </div>
        <div className="text-right text-xs text-slate-500 max-w-[240px]">
          Example: On a ₦10,000 order, the platform earns{' '}
          <strong className="text-indigo-600">
            ₦{Math.round((10000 * (Number(currentPercent) || 8)) / 100).toLocaleString()}
          </strong>{' '}
          and the merchant receives{' '}
          <strong className="text-emerald-600">
            ₦{Math.round(10000 * (1 - (Number(currentPercent) || 8) / 100)).toLocaleString()}
          </strong>.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Update Commission Percentage
          </label>
          <div className="relative max-w-xs">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={percentInput}
              onChange={(e) => {
                setPercentInput(e.target.value)
                setIsEditing(true)
              }}
              placeholder="e.g. 5, 8, 10"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="absolute right-4 top-2.5 text-slate-400 font-bold">%</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            Changes apply immediately to all upcoming checkouts.
          </p>
        </div>

        <button
          type="submit"
          disabled={updateCommissionMutation.isPending || !percentInput}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 active:scale-95"
        >
          {updateCommissionMutation.isPending ? (
            <span>Saving...</span>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Save Fee Setting</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
