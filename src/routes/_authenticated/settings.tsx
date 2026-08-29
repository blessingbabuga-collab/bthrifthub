import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, KeyRound, Phone, User, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Form states
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (data) {
        setFullName(data.full_name || "");
        setUsername(data.username || "");
        setPhone((data as any).phone_number || "");
      }
      return data;
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file || !user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Profile photo updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Update Profile (Name & Username & Phone)
      if (fullName !== profile?.full_name || username !== profile?.username || phone !== (profile as any)?.phone_number) {
        const updatePayload: any = { full_name: fullName, username, phone_number: phone };
        const { error: profileError } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", user!.id);
          
        if (profileError) throw profileError;
      }

      // 2. Update Password (Auth level)
      if (newPassword.trim() !== "") {
        const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
        if (passError) throw passError;
        setNewPassword(""); // clear after success
      }

      toast.success("Account settings updated successfully!");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />
      
      <div className="mx-auto max-w-2xl px-4 py-8 animate-fade-in">
        <BackButton fallback="/profile" />
        <h1 className="font-display text-3xl font-bold mt-4 mb-6 uppercase tracking-tight text-foreground">Account Settings</h1>

        {/* Photo Upload Section */}
        <div className="bg-card border border-border rounded-[24px] p-6 mb-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-24 h-24 rounded-full border-4 border-background shadow-md overflow-hidden bg-secondary flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-display font-bold text-muted-foreground">
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h3 className="font-bold text-foreground">Profile Photo</h3>
            <p className="text-sm text-muted-foreground mb-3">Upload a clear photo to build trust with buyers.</p>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleAvatarUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-secondary text-foreground rounded-full text-sm font-semibold hover:bg-secondary/80 transition-colors flex items-center gap-2 mx-auto sm:mx-0"
            >
              <Camera className="h-4 w-4" />
              {uploading ? "Uploading..." : "Change Photo"}
            </button>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleUpdateProfile} className="bg-card border border-border rounded-[24px] p-6 shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Full Name
            </label>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
              placeholder="e.g. Tunde Adams"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Username
            </label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
              placeholder="e.g. tunde"
            />
          </div>



          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> Phone Number (Optional)
            </label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
              placeholder="+234..."
            />
          </div>

          <div className="pt-2 border-t border-border">
            <label className="block text-sm font-bold text-foreground mb-1.5 flex items-center gap-2 mt-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" /> Change Password
            </label>
            <p className="text-xs text-muted-foreground mb-2">Leave blank if you don't want to change it.</p>
            <input 
              type="password" 
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
              placeholder="New password"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-14 bg-primary text-primary-foreground rounded-full font-display font-bold uppercase tracking-widest text-lg shadow-glow hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-4"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}
