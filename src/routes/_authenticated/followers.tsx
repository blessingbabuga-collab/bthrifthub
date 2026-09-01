import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { SiteHeader } from '@/components/SiteHeader'
import { MobileNav } from '@/components/MobileNav'
import { Users, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/followers')({
  component: FollowersPage,
})

function FollowersPage() {
  const { user } = useAuth()
  
  const { data: followers, isLoading } = useQuery({
    queryKey: ['followers_list', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Query people following me
      const { data: follows, error } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('following_id', user!.id)
        
      if (error) throw error
      if (!follows || follows.length === 0) return []

      const followerIds = follows.map(f => f.follower_id)
      
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from('public_profiles')
        .select('id, username, full_name, avatar_url, bio')
        .in('id', followerIds)
        
      if (profilesError) throw profilesError
      return profiles
    }
  })

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-0">
      <SiteHeader />
      
      <div className="mx-auto max-w-2xl p-4 font-sans">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => history.back()} className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-2xl font-bold">Followers</h1>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-secondary rounded-2xl" />)}
          </div>
        ) : followers && followers.length > 0 ? (
          <div className="space-y-4">
            {followers.map((profile: any) => (
                <Link key={profile.id} to="/wardrobe/$username" params={{ username: profile.username }} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-secondary/50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-secondary overflow-hidden shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-lg bg-amber/10 text-amber">
                        {profile.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground truncate">{profile.full_name || profile.username}</h3>
                    <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                  </div>
                </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground bg-secondary/30 rounded-3xl border border-border border-dashed">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>You don't have any followers yet.</p>
          </div>
        )}
      </div>
      
      <MobileNav />
    </div>
  )
}
