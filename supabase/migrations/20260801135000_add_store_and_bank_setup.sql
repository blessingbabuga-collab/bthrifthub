-- Updates to profiles table for store setup and wardrobe privacy
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS rep_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS is_wardrobe_private boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_wardrobe_value_visible boolean DEFAULT true;

-- Updates to products table for individual product privacy
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS for bank_accounts
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Bank accounts should only be readable and insertable by the owner or admin
CREATE POLICY "bank_accounts_owner_read" ON public.bank_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bank_accounts_owner_insert" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bank_accounts_owner_update" ON public.bank_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Admins can read all bank accounts
CREATE POLICY "bank_accounts_admin_read" ON public.bank_accounts FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);
