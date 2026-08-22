// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Lock, Eye, EyeOff } from 'lucide-react'

export const Route = createFileRoute('/wardrobe/$username')({
  component: WardrobeComponent,
})

function WardrobeComponent() {
  const { username } = Route.useParams()
  const { session } = useAuth()
  const currentUserId = session?.user?.id

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()
      
      if (error) throw error
      return data
    }
  })

  const isOwner = currentUserId === profile?.id

  const { data: allProducts, isLoading: isProductsLoading } = useQuery({
    queryKey: ['wardrobe-products', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      // Owner fetches everything to calculate values. 
      // Public viewer relies on RLS, but we also filter client-side just in case.
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', profile.id)
        
      if (error) throw error
      return data
    }
  })

  if (isProfileLoading) {
    return <div className="flex justify-center py-20 text-slate-500">Loading wardrobe...</div>
  }

  if (!profile) {
    return <div className="text-center py-20 text-slate-500">Wardrobe not found for @{username}</div>
  }

  // Determine visibility
  const canViewWardrobe = isOwner || !profile.is_wardrobe_private
  
  // Filter products based on individual privacy
  const visibleProducts = allProducts?.filter(p => isOwner || !p.is_private) || []
  
  // Calculate total wardrobe value (all products, including private ones, for accurate calibration)
  const totalWardrobeValue = allProducts?.reduce((sum, p) => sum + Number(p.price || 0), 0) || 0
  
  // Can the current user see the value?
  const canViewValue = isOwner || profile.is_wardrobe_value_visible

  return (
    <div className="container mx-auto py-8 px-4 font-sans text-slate-900">
      <div className="flex flex-col items-center mb-8">
        <div className="w-full h-48 bg-slate-200 rounded-2xl mb-16 relative overflow-hidden border border-slate-200 shadow-sm">
          {profile.cover_image ? (
            <img src={profile.cover_image} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-400 to-purple-500" />
          )}
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-24 h-24 rounded-full border-4 border-white shadow-sm object-cover bg-white" />
            ) : (
              <div className="w-24 h-24 bg-indigo-100 rounded-full border-4 border-white shadow-sm flex items-center justify-center text-3xl font-bold text-indigo-700">
                {profile.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        
        <h1 className="text-2xl font-bold mt-2">@{profile.username}</h1>
        {profile.is_verified && <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full mt-2 font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Verified Seller
        </span>}
        <p className="text-slate-500 text-sm mt-3 max-w-md text-center leading-relaxed">{profile.bio || 'Welcome to my digital wardrobe!'}</p>

        {canViewValue && (
          <div className="mt-6 bg-amber-50 border border-amber-200 text-amber-800 px-6 py-3 rounded-xl shadow-sm text-center">
            <p className="text-xs uppercase tracking-wider font-semibold opacity-80 mb-1">Total Wardrobe Value</p>
            <p className="text-2xl font-bold">₦{totalWardrobeValue.toLocaleString()}</p>
          </div>
        )}

        {!isOwner && (
          <button className="mt-6 bg-slate-900 text-white hover:bg-slate-800 h-10 px-8 rounded-lg font-medium transition-colors shadow-sm">
            Follow
          </button>
        )}
      </div>

      <div className="border-t border-slate-200 pt-8">
        {!canViewWardrobe ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <Lock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">This wardrobe is private</h3>
            <p className="mt-2 text-sm">You must be the owner to view the contents of this wardrobe.</p>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Wardrobe ({visibleProducts.length})</h2>
              {isOwner && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  {profile.is_wardrobe_private ? <Lock className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{profile.is_wardrobe_private ? 'Private Wardrobe' : 'Public Wardrobe'}</span>
                </div>
              )}
            </div>

            {isProductsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[1,2,3,4].map(i => (
                  <div key={i} className="animate-pulse bg-slate-200 aspect-[3/4] rounded-xl" />
                ))}
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="text-center py-20 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                No items found in this wardrobe.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {visibleProducts.map((product: any) => (
                  <div key={product.id} className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Private Badge */}
                    {product.is_private && isOwner && (
                      <div className="absolute top-2 left-2 z-10 bg-slate-900/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 font-medium">
                        <EyeOff className="w-3 h-3" /> Private
                      </div>
                    )}
                    <div className="aspect-[3/4] overflow-hidden bg-slate-100">
                      <img src={product.image_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-slate-900 truncate">{product.title}</h3>
                      <p className="text-sm text-slate-500 truncate mb-2">{product.brand || 'Unbranded'}</p>
                      <p className="font-bold text-lg text-slate-900">₦{product.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
