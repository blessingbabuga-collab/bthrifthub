// @ts-nocheck
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { ProductCard } from '@/components/ProductCard'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { MobileNav } from '@/components/MobileNav'

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
        .maybeSingle()
      
      if (data) return data
      
      const { DUMMY_PRODUCTS } = await import('@/lib/dummy')
      const dummySeller = DUMMY_PRODUCTS.find(p => p.seller.username === username)?.seller
      if (dummySeller) {
        return {
          id: dummySeller.id,
          username: dummySeller.username,
          full_name: dummySeller.full_name,
          avatar_url: dummySeller.avatar_url,
          bio: "Welcome to my premium curated thrift wardrobe!",
          is_verified: true,
          is_wardrobe_private: false,
          is_wardrobe_value_visible: true,
          cover_image: null
        }
      }
      throw new Error("Not found")
    }
  })

  const isOwner = currentUserId === profile?.id

  const { data: allProducts, isLoading: isProductsLoading } = useQuery({
    queryKey: ['wardrobe-products', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', profile.id)
        
      if (!error && data && data.length > 0) return data;
      
      const { DUMMY_PRODUCTS } = await import('@/lib/dummy')
      return DUMMY_PRODUCTS.filter(p => p.seller_id === profile.id)
    }
  })

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex justify-center py-20 text-muted-foreground">Loading wardrobe...</div>
        <MobileNav />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="text-center py-20 text-muted-foreground">Wardrobe not found for @{username}</div>
        <MobileNav />
      </div>
    )
  }

  // Determine visibility
  const canViewWardrobe = isOwner || !profile.is_wardrobe_private
  const visibleProducts = allProducts?.filter(p => isOwner || !p.is_private) || []
  const totalWardrobeValue = allProducts?.reduce((sum, p) => sum + Number(p.price || 0), 0) || 0
  const canViewValue = isOwner || profile.is_wardrobe_value_visible

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-0">
      <SiteHeader />
      
      <div className="mx-auto max-w-6xl py-8 px-4 font-sans text-foreground">
        <div className="flex flex-col items-center mb-8">
          <div className="w-full h-48 bg-secondary rounded-2xl mb-16 relative overflow-hidden border border-border shadow-sm">
            {profile.cover_image ? (
              <img src={profile.cover_image} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-amber/50 to-primary/50" />
            )}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-24 h-24 rounded-full border-4 border-background shadow-sm object-cover bg-background" />
              ) : (
                <div className="w-24 h-24 bg-secondary rounded-full border-4 border-background shadow-sm flex items-center justify-center text-3xl font-bold text-foreground">
                  {profile.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          
          <h1 className="font-display text-3xl font-bold mt-2 uppercase">@{profile.username}</h1>
          {profile.is_verified && <span className="bg-emerald-500/10 text-emerald-600 text-xs px-3 py-1 rounded-full mt-2 font-medium flex items-center gap-1 border border-emerald-500/20">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Verified Seller
          </span>}
          <p className="text-muted-foreground text-sm mt-3 max-w-md text-center leading-relaxed">{profile.bio || 'Welcome to my digital wardrobe!'}</p>

          {canViewValue && (
            <div className="mt-6 bg-amber/10 border border-amber/20 text-amber px-6 py-3 rounded-xl shadow-sm text-center">
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-80 mb-1">Total Wardrobe Value</p>
              <p className="font-display text-3xl font-bold">₦{totalWardrobeValue.toLocaleString("en-US")}</p>
            </div>
          )}

          {!isOwner && (
            <button className="mt-6 bg-foreground text-background hover:opacity-90 h-10 px-8 rounded-full font-bold transition-opacity shadow-sm">
              Follow
            </button>
          )}
        </div>

        <div className="border-t border-border pt-8">
          {!canViewWardrobe ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="bg-secondary p-4 rounded-full mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground">This wardrobe is private</h3>
              <p className="mt-2 text-sm">You must be the owner to view the contents of this wardrobe.</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight">Wardrobe ({visibleProducts.length})</h2>
                {isOwner && (
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-secondary px-3 py-1.5 rounded-full border border-border">
                    {profile.is_wardrobe_private ? <Lock className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{profile.is_wardrobe_private ? 'Private Wardrobe' : 'Public Wardrobe'}</span>
                  </div>
                )}
              </div>

              {isProductsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="animate-pulse bg-secondary aspect-square rounded-2xl" />
                  ))}
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground bg-secondary/50 rounded-3xl border border-border border-dashed flex flex-col items-center justify-center gap-4">
                  <p>No items found in this wardrobe.</p>
                  {isOwner && (
                    <Link to="/sell" className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-full hover:opacity-90 active:scale-95 transition-all shadow-glow">
                      Sell your first item
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {visibleProducts.map((product: any) => (
                    <ProductCard key={product.id} p={product} isOwner={isOwner} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  )
}
