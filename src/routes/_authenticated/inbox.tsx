import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { MobileNav } from '@/components/MobileNav'
import { BackButton } from '@/components/BackButton'
import { formatNaira } from '@/lib/products'

export const Route = createFileRoute('/_authenticated/inbox')({
  component: InboxRoute,
})

function InboxRoute() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: chats, isLoading } = useQuery({
    queryKey: ['inbox-chats', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          id,
          updated_at,
          product:products (id, title, price, image_url),
          buyer:profiles!buyer_id (id, username, avatar_url),
          seller:profiles!seller_id (id, username, avatar_url)
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data
    }
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 sm:pb-0 flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex justify-center py-20 text-muted-foreground">Loading inbox...</div>
        <MobileNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-0">
      <SiteHeader />
      <div className="container mx-auto py-8 max-w-4xl px-4 animate-fade-in">
        <BackButton fallback="/profile" />
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight text-foreground mt-4 mb-6">Messages</h1>
        
        {chats && chats.length > 0 ? (
          <div className="flex flex-col gap-4">
            {chats.map((chat: any) => {
              const isBuyer = chat.buyer.id === userId
              const otherUser = isBuyer ? chat.seller : chat.buyer

              return (
                <Link 
                  to="/inbox/$chatId" 
                  params={{ chatId: chat.id }} 
                  key={chat.id}
                  className="group block bg-card border border-border rounded-[24px] p-5 shadow-sm hover:shadow-md transition-all hover:bg-secondary/50 flex items-center gap-4"
                >
                  <div className="w-14 h-14 rounded-full border-2 border-border/50 overflow-hidden flex-shrink-0 bg-secondary flex items-center justify-center font-display font-bold text-xl text-foreground">
                    {otherUser.avatar_url ? (
                      <img src={otherUser.avatar_url} alt={otherUser.username} className="w-full h-full object-cover" />
                    ) : (
                      otherUser.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-bold text-foreground truncate uppercase font-display tracking-widest text-sm">@{otherUser.username}</h3>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex-shrink-0">
                        {new Date(chat.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate font-medium">
                      Regarding: <span className="text-foreground">{chat.product?.title}</span>
                    </p>
                  </div>
                  
                  {chat.product?.image_url && (
                     <div className="w-14 h-14 rounded-xl overflow-hidden border border-border flex-shrink-0 relative">
                       <img src={chat.product.image_url} alt="product" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                     </div>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-secondary/30 border border-border border-dashed rounded-[32px] flex flex-col items-center justify-center">
            <p className="text-foreground font-display font-bold text-xl uppercase tracking-widest">No messages yet</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">When you contact a seller or a buyer contacts you, your conversations will show up here.</p>
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
