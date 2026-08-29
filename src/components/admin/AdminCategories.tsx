// @ts-nocheck
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { ImageUploader, type UploadedImage } from '@/components/ImageUploader'
import { useAuth } from '@/hooks/useAuth'

type Category = {
  id: string
  name: string
  image_url: string
}

export function AdminCategories() {
  const { session } = useAuth()
  const userId = session?.user?.id
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '' })
  const [images, setImages] = useState<UploadedImage[]>([])
  const [saving, setSaving] = useState(false)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories-admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('categories').select('*').order('name')
      if (error) throw error
      return data as Category[]
    },
  })

  const startEdit = (cat: Category) => {
    setEditing(cat)
    setForm({ name: cat.name })
    setImages(cat.image_url ? [{ url: cat.image_url, path: '' }] : [])
    setCreating(false)
  }

  const startCreate = () => {
    setEditing(null)
    setForm({ name: '' })
    setImages([])
    setCreating(true)
  }

  const cancel = () => {
    setEditing(null)
    setCreating(false)
  }

  const handleSave = async () => {
    if (!form.name || images.length === 0) { toast.error('Name and image are required'); return }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await (supabase as any).from('categories').update({
          name: form.name, image_url: images[0].url, updated_at: new Date().toISOString()
        }).eq('id', editing.id)
        if (error) throw error
        toast.success('Category updated')
      } else {
        const { error } = await (supabase as any).from('categories').insert({
          name: form.name, image_url: images[0].url
        })
        if (error) throw error
        toast.success('Category created')
      }
      qc.invalidateQueries({ queryKey: ['categories-admin'] })
      qc.invalidateQueries({ queryKey: ['categories'] }) // for public routes
      cancel()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"? This might break products using this category if you don't reassign them.`)) return
    const { error } = await (supabase as any).from('categories').delete().eq('id', cat.id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    qc.invalidateQueries({ queryKey: ['categories-admin'] })
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  if (!userId) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Categories</h2>
          <p className="text-sm text-slate-500 mt-1">Manage product categories and their images.</p>
        </div>
        <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4" /> New Category
        </button>
      </div>

      {/* Editor */}
      {(editing || creating) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">{editing ? 'Edit Category' : 'New Category'}</h3>
            <button onClick={cancel} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. Watches"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Image</label>
              <ImageUploader userId={userId} value={images} onChange={(newImages) => setImages(newImages.slice(0, 1))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={cancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">No categories found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                {cat.image_url ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200">
                    <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200" />
                )}
                <p className="font-semibold text-slate-900">{cat.name}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-4">
                <button onClick={() => startEdit(cat)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => deleteCategory(cat)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
