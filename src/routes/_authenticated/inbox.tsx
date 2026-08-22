import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

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
          product:products (id, title, price, images),
          buyer:profiles!buyer_id (id, username, avatar_url),
          seller:profiles!seller_id (id, username, avatar_url)
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data
    }
  })

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading inbox...</div>

  return (
    <div className="container mx-auto py-8 max-w-4xl px-4">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      
      {chats && chats.length > 0 ? (
        <div className="flex flex-col gap-3">
          {chats.map((chat: any) => {
            const isBuyer = chat.buyer.id === userId
            const otherUser = isBuyer ? chat.seller : chat.buyer

            return (
              <Link 
                to="/inbox/$chatId" 
                params={{ chatId: chat.id }} 
                key={chat.id}
                className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  {otherUser.avatar_url ? (
                    <img src={otherUser.avatar_url} alt={otherUser.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 bg-gray-100">
                      {otherUser.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">@{otherUser.username}</h3>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    Regarding: {chat.product?.title}
                  </p>
                </div>
                
                {chat.product?.images && chat.product.images[0] && (
                   <img src={chat.product.images[0]} alt="product" className="w-12 h-12 rounded object-cover flex-shrink-0 border" />
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 border rounded-lg border-dashed">
          <p className="text-gray-500">No messages yet.</p>
          <p className="text-sm text-gray-400 mt-2">When you contact a seller or a buyer contacts you, it will show up here.</p>
        </div>
      )}
    </div>
  )
}
