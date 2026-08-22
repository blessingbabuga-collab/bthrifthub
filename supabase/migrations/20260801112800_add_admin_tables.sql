-- Add role to profiles if it doesn't exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- VERIFICATIONS TABLE
CREATE TABLE public.verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  document_url text NOT NULL,
  selfie_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification" ON public.verifications
  FOR SELECT TO authenticated USING (auth.uid() = seller_id);

CREATE POLICY "Users can submit verification" ON public.verifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins can view all verifications" ON public.verifications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update verifications" ON public.verifications
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger to auto-verify seller when approved
CREATE OR REPLACE FUNCTION public.handle_verification_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.profiles SET is_verified = true WHERE id = NEW.seller_id;
  ELSIF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
    UPDATE public.profiles SET is_verified = false WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_verification_status_change
AFTER UPDATE ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.handle_verification_approval();


-- DISPUTES TABLE
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  raised_by uuid REFERENCES public.profiles(id) NOT NULL,
  reason text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved_buyer', 'resolved_seller')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their disputes" ON public.disputes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_id AND (orders.buyer_id = auth.uid()))
  );

CREATE POLICY "Buyers can raise disputes" ON public.disputes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = raised_by);

CREATE POLICY "Admins can manage disputes" ON public.disputes
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger to lock escrow when dispute is raised
CREATE OR REPLACE FUNCTION public.handle_new_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.orders SET escrow_status = 'disputed' WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_dispute_raised
AFTER INSERT ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.handle_new_dispute();
