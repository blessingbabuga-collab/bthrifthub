import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Package, Store, Wallet, Settings, ChevronRight, ShieldCheck, FileCheck, Calendar, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LegalDocumentModal } from "@/components/legal/LegalDocumentModal";

export const Route = createFileRoute("/profile")({
  component: ProfileDashboard,
});

function ProfileDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedConsent, setSelectedConsent] = useState<{ title: string; content: string } | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  const { data: userConsents = [] } = useQuery({
    queryKey: ["profile-user-consents", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_legal_consents")
        .select("*")
        .eq("user_id", user!.id)
        .order("agreed_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">You need to sign in to view your profile.</p>
        <Link to="/auth" className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium shadow-glow">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-secondary/30">
      <SiteHeader />
      
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold mb-6">Profile</h1>

        {/* Identity Card */}
        <div className="bg-card border border-border rounded-3xl p-6 flex items-center gap-5 shadow-sm mb-8">
          <div className="w-20 h-20 bg-amber/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-background shadow-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-amber">
                {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {profile?.full_name || "Thrifter"}
            </h2>
            <p className="text-sm text-muted-foreground mb-2">@{profile?.username || "username"}</p>
            <Link to="/followers" className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:opacity-80 bg-secondary px-3 py-1 rounded-full">
              <span>{profile?.followers_count || 0}</span>
              <span className="text-muted-foreground font-normal">Followers</span>
            </Link>
          </div>
        </div>

        {/* Hub Links */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm mb-8">
          <div className="divide-y divide-border">
            {profile?.role === 'admin' && (
              <Link to="/admin" className="flex items-center gap-4 p-5 hover:bg-indigo-50 transition-colors bg-indigo-50/50">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-indigo-900">Admin Dashboard</h3>
                  <p className="text-xs text-indigo-600/80">Manage users, disputes, and verifications</p>
                </div>
                <ChevronRight className="h-5 w-5 text-indigo-400" />
              </Link>
            )}
            
            <Link to="/wardrobe/$username" params={{ username: profile?.username || "unknown" }} className="flex items-center gap-4 p-5 hover:bg-secondary/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Store className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">My Storefront</h3>
                <p className="text-xs text-muted-foreground">View your public wardrobe</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            
            <Link to="/orders" className="flex items-center gap-4 p-5 hover:bg-secondary/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">My Orders</h3>
                <p className="text-xs text-muted-foreground">Track purchases and sales</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>

            <Link to="/wallet" className="flex items-center gap-4 p-5 hover:bg-secondary/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Wallet & Earnings</h3>
                <p className="text-xs text-muted-foreground">Manage your funds and payouts</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            
            <Link to="/settings" className="flex items-center gap-4 p-5 hover:bg-secondary/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center">
                <Settings className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Account Settings</h3>
                <p className="text-xs text-muted-foreground">Edit profile, photo, and security</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Legal Agreements Signed & Consents */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Signed Legal Agreements</h3>
              <p className="text-xs text-muted-foreground">Your verified copies of Terms and Privacy agreements</p>
            </div>
          </div>

          {userConsents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic bg-secondary/30 p-4 rounded-2xl">
              No signed agreements on file yet. You will be prompted on next policy update.
            </p>
          ) : (
            <div className="space-y-3">
              {userConsents.map((consent: any) => (
                <div
                  key={consent.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-secondary/30 border border-border hover:bg-secondary/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{consent.agreement_title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        v{consent.version}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Agreed on {new Date(consent.agreed_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedConsent({
                        title: `${consent.agreement_title} (v${consent.version})`,
                        content: consent.agreement_content_snapshot,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal for viewing signed copy */}
        <LegalDocumentModal
          isOpen={!!selectedConsent}
          onClose={() => setSelectedConsent(null)}
          title={selectedConsent?.title || "Legal Agreement"}
          content={selectedConsent?.content || ""}
        />

        {/* Sign Out */}
        <button onClick={signOut} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10 font-semibold transition-colors">
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>

      </div>
      
      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}
