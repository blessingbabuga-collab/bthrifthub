// @ts-nocheck
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Plus, Pencil, Eye, EyeOff, Trash2, Save, X } from 'lucide-react'

type CmsPage = {
  id: string
  slug: string
  title: string
  content: string
  published: boolean
  created_at: string
  updated_at: string
}

export function AdminCMS() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<CmsPage | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ slug: '', title: '', content: '', published: true })
  const [saving, setSaving] = useState(false)

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['cms-pages-admin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('cms_pages').select('*').order('title')
      if (error) throw error
      return data as CmsPage[]
    },
  })

  const startEdit = (page: CmsPage) => {
    setEditing(page)
    setForm({ slug: page.slug, title: page.title, content: page.content, published: page.published })
    setCreating(false)
  }

  const startCreate = () => {
    setEditing(null)
    setForm({ slug: '', title: '', content: '', published: true })
    setCreating(true)
  }

  const cancel = () => {
    setEditing(null)
    setCreating(false)
  }

  const handleSave = async () => {
    if (!form.title || !form.slug) { toast.error('Title and slug are required'); return }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await (supabase as any).from('cms_pages').update({
          title: form.title, slug: form.slug, content: form.content, published: form.published, updated_at: new Date().toISOString()
        }).eq('id', editing.id)
        if (error) throw error
        toast.success('Page updated')
      } else {
        const { error } = await (supabase as any).from('cms_pages').insert({
          title: form.title, slug: form.slug, content: form.content, published: form.published
        })
        if (error) throw error
        toast.success('Page created')
      }
      qc.invalidateQueries({ queryKey: ['cms-pages-admin'] })
      cancel()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (page: CmsPage) => {
    const { error } = await (supabase as any).from('cms_pages').update({ published: !page.published, updated_at: new Date().toISOString() }).eq('id', page.id)
    if (error) { toast.error(error.message); return }
    toast.success(page.published ? 'Unpublished' : 'Published')
    qc.invalidateQueries({ queryKey: ['cms-pages-admin'] })
  }

  const deletePage = async (page: CmsPage) => {
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return
    const { error } = await (supabase as any).from('cms_pages').delete().eq('id', page.id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    qc.invalidateQueries({ queryKey: ['cms-pages-admin'] })
  }

  const autoSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">CMS Pages</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your About, Help Center, and other static pages.</p>
        </div>
        <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4" /> New Page
        </button>
      </div>

      {/* Editor */}
      {(editing || creating) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">{editing ? 'Edit Page' : 'New Page'}</h3>
            <button onClick={cancel} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                value={form.title}
                onChange={(e) => {
                  setForm(f => ({ ...f, title: e.target.value, ...(creating ? { slug: autoSlug(e.target.value) } : {}) }))
                }}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Page title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL path)</label>
              <div className="flex items-center">
                <span className="text-sm text-slate-400 mr-1">/page/</span>
                <input
                  value={form.slug}
                  onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="about"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content (Markdown supported)</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
              rows={12}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              placeholder="Write your page content here..."
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.published} onChange={(e) => setForm(f => ({ ...f, published: e.target.checked }))} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm font-medium text-slate-700">Published</span>
            </label>
            <div className="flex gap-3">
              <button onClick={cancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pages list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">No CMS pages yet. Click "New Page" to create one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 truncate">{page.title}</p>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${page.published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {page.published ? 'Live' : 'Draft'}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">/page/{page.slug}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-4">
                <button onClick={() => startEdit(page)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => togglePublish(page)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title={page.published ? 'Unpublish' : 'Publish'}>
                  {page.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={() => deletePage(page)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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
