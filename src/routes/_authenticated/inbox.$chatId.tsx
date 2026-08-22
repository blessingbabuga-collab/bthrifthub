import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Send } from 'lucide-react'

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
    }
  })

  useEffect(() => {
    // Setup Supabase real-time subscription for new messages
    const channel = supabase
      .channel(`chat_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          // Invalidate and refetch messages when a new one arrives
          queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, queryClient])

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: userId,
          content: content
        })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] })
    }
  })

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    sendMessageMutation.mutate(newMessage.trim())
  }

  if (!chat) return <div className="p-8 text-center text-gray-500">Loading chat...</div>

  const isBuyer = chat.buyer.id === userId
  const otherUser = isBuyer ? chat.seller : chat.buyer

  return (
    <div className="container mx-auto py-4 max-w-4xl h-[calc(100vh-80px)] flex flex-col px-4">
      {/* Chat Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
           {otherUser.avatar_url ? (
             <img src={otherUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
           ) : (
             <div className="w-full h-full flex items-center justify-center font-bold text-gray-500">
               {otherUser.username?.charAt(0).toUpperCase()}
             </div>
           )}
        </div>
        <div>
          <h2 className="font-bold text-lg">@{otherUser.username}</h2>
          <p className="text-xs text-gray-500">Regarding: {chat.product?.title}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50">
        {messages?.map((msg: any) => {
          const isMe = msg.sender_id === userId
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg px-4 py-2 ${isMe ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-white border rounded-bl-none'}`}>
                <p className="text-sm">{msg.content}</p>
                <span className={`text-[10px] mt-1 block ${isMe ? 'text-primary-foreground/70' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..." 
          className="flex-grow border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
          disabled={sendMessageMutation.isPending}
        />
        <button 
          type="submit" 
          disabled={sendMessageMutation.isPending || !newMessage.trim()}
          className="bg-primary text-primary-foreground p-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center w-12"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
