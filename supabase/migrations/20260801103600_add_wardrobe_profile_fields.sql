-- Add Digital Wardrobe fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS cover_image text,
  ADD COLUMN IF NOT EXISTS style_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS followers_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS total_sales integer DEFAULT 0;

-- Optional: Create a followers table for Wardrobe follows
CREATE TABLE IF NOT EXISTS public.followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followers_public_read" ON public.followers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "followers_self_insert" ON public.followers FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "followers_self_delete" ON public.followers FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Trigger to update followers_count
CREATE OR REPLACE FUNCTION public.handle_follower_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_followers_count
AFTER INSERT OR DELETE ON public.followers
FOR EACH ROW EXECUTE FUNCTION public.handle_follower_count();
