import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Send, ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { MobileNav } from '@/components/MobileNav'

export const Route = createFileRoute('/_authenticated/inbox/$chatId')({
  component: ChatRoute,
})

function ChatRoute() {
  const { chatId } = Route.useParams()
  const { session } = useAuth()
  const userId = session?.user?.id
  const queryClient = useQueryClient()
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: chat } = useQuery({
    queryKey: ['chat-details', chatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          product:products (*),
          buyer:profiles!buyer_id (*),
          seller:profiles!seller_id (*)
        `)
        .eq('id', chatId)
        .single()
      if (error) throw error
      return data
    }
  })

  const { data: messages } = useQuery({
    queryKey: ['chat-messages', chatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    refetchInterval: 3000
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: userId!,
          content
        })
      if (error) throw error
      
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId)
    },
    onSuccess: () => {
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] })
      queryClient.invalidateQueries({ queryKey: ['inbox-chats'] })
    }
  })

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    sendMessageMutation.mutate(newMessage.trim())
  }

  if (!chat) return <div className="p-8 text-center text-muted-foreground">Loading chat...</div>

  const isBuyer = chat.buyer.id === userId
  const otherUser = isBuyer ? chat.seller : chat.buyer

  return (
    <div className="flex flex-col h-screen bg-background pb-16 sm:pb-0">
      <div className="hidden sm:block">
        <SiteHeader />
      </div>

      {/* Chat Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-card shadow-sm z-10 sticky top-0">
        <Link to="/inbox" className="p-2 hover:bg-secondary rounded-full transition-colors mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="w-10 h-10 rounded-full border border-border overflow-hidden bg-secondary flex items-center justify-center font-display font-bold text-foreground">
           {otherUser.avatar_url ? (
             <img src={otherUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
           ) : (
             otherUser.username?.charAt(0).toUpperCase()
           )}
        </div>
        <div>
          <h2 className="font-bold text-lg font-display uppercase tracking-widest text-foreground">@{otherUser.username}</h2>
          <p className="text-xs font-medium text-muted-foreground truncate max-w-[200px] sm:max-w-md">Regarding: {chat.product?.title}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4 bg-background">
        {messages?.map((msg: any) => {
          const isMe = msg.sender_id === userId
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary text-foreground rounded-bl-sm'}`}>
                <p className="text-sm">{msg.content}</p>
                <span className={`text-[9px] mt-1 block uppercase font-bold tracking-widest ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-card border-t border-border p-3">
        <form onSubmit={handleSendMessage} className="container max-w-4xl mx-auto flex gap-2">
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..." 
            className="flex-grow bg-secondary/50 border border-border text-foreground rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
            disabled={sendMessageMutation.isPending}
          />
          <button 
            type="submit" 
            disabled={sendMessageMutation.isPending || !newMessage.trim()}
            className="bg-primary text-primary-foreground p-3 rounded-full hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center w-12 h-12 shadow-glow transition-all active:scale-95"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      <MobileNav />
    </div>
  )
}
