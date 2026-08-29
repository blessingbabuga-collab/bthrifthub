// @ts-nocheck
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { MobileNav } from '@/components/MobileNav'
import { BackButton } from '@/components/BackButton'

export const Route = createFileRoute('/page/$slug')({
  component: CmsPageView,
})

function CmsPageView() {
  const { slug } = Route.useParams()

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['cms-page', slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cms_pages')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Page not found')
      return data as { id: string; slug: string; title: string; content: string; published: boolean }
    },
  })

  // Simple markdown-ish rendering: support ## headings, **bold**, newlines
  const renderContent = (content: string) => {
    return content.split('\n\n').map((block, i) => {
      // Heading
      if (block.startsWith('## ')) {
        return <h2 key={i} className="text-2xl font-display mt-8 mb-3">{block.slice(3)}</h2>
      }
      if (block.startsWith('### ')) {
        return <h3 key={i} className="text-xl font-display mt-6 mb-2">{block.slice(4)}</h3>
      }
      // Bullet list
      if (block.startsWith('- ')) {
        const items = block.split('\n').filter(l => l.startsWith('- '))
        return (
          <ul key={i} className="list-disc list-inside space-y-1.5 my-4 text-muted-foreground">
            {items.map((item, j) => <li key={j}>{item.slice(2)}</li>)}
          </ul>
        )
      }
      // Regular paragraph
      return <p key={i} className="text-muted-foreground leading-relaxed my-4">{block}</p>
    })
  }

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackButton fallback="/" />
        {isLoading && (
          <div className="mt-6 space-y-4">
            <div className="h-10 w-2/3 bg-secondary rounded-xl animate-pulse" />
            <div className="h-4 bg-secondary rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-secondary rounded animate-pulse" />
            <div className="h-4 w-4/6 bg-secondary rounded animate-pulse" />
          </div>
        )}
        {error && (
          <div className="mt-6 text-center py-16">
            <h1 className="font-display text-4xl">Page not found</h1>
            <p className="text-muted-foreground mt-3">This page doesn't exist or has been unpublished.</p>
            <Link to="/" className="inline-block mt-6 text-amber font-semibold hover:underline">← Back to home</Link>
          </div>
        )}
        {page && (
          <article className="mt-6">
            <h1 className="font-display text-4xl md:text-5xl tracking-tight">{page.title}</h1>
            <div className="mt-6 text-base">
              {renderContent(page.content)}
            </div>
          </article>
        )}
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  )
}
