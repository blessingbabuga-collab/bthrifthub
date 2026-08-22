-- Update orders with escrow_status
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS escrow_status text DEFAULT 'pending' 
  CHECK (escrow_status IN ('pending', 'held', 'released', 'refunded', 'disputed'));

-- CREATE WALLETS TABLE
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  pending_balance numeric(12,2) DEFAULT 0.00 NOT NULL,
  available_balance numeric(12,2) DEFAULT 0.00 NOT NULL,
  withdrawn_balance numeric(12,2) DEFAULT 0.00 NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Auto-create wallet for new users (via function replacement)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create missing wallets for existing users
INSERT INTO public.wallets (user_id)
SELECT id FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.wallets);

-- CREATE TRANSACTIONS TABLE
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  type text NOT NULL CHECK (type IN ('escrow_hold', 'escrow_release', 'withdrawal', 'refund')),
  amount numeric(12,2) NOT NULL,
  platform_commission numeric(12,2) DEFAULT 0.00,
  net_amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.wallets WHERE wallets.id = transactions.wallet_id AND wallets.user_id = auth.uid()
  )
);
