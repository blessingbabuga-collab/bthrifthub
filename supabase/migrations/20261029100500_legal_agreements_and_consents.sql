-- Migration: Legal Agreements (Terms & Conditions and Privacy Policy)
-- Enforces acceptance at registration and re-acceptance when agreements are modified.

CREATE TABLE IF NOT EXISTS public.legal_agreements (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Seed default initial agreements if not present
INSERT INTO public.legal_agreements (id, title, content, version, updated_at)
VALUES
  (
    'terms_and_conditions',
    'Terms and Conditions',
    '## 1. Acceptance of Terms
By creating an account or using Bthrifts, you agree to these Terms and Conditions in full. If you do not agree, please do not use our services.

## 2. Marketplace & Escrow
Bthrifts operates an escrow-protected marketplace. Buyer payments are held securely until orders are delivered and inspected.

## 3. User Conduct & Prohibited Items
Users must provide accurate information. Counterfeit, stolen, or illegal goods are strictly prohibited.

## 4. Account Termination
We reserve the right to suspend or terminate accounts that violate our community standards or platform integrity.',
    1,
    now()
  ),
  (
    'privacy_policy',
    'Privacy Agreement',
    '## 1. Information We Collect
We collect information you provide directly, including name, email, phone number, shipping address, and transaction details.

## 2. How We Use Your Data
Your information is used strictly to process orders, facilitate escrow payments, prevent fraud, and send service communications.

## 3. Data Protection
We implement industry-standard encryption and security measures to protect your personal and payment data.

## 4. Your Rights
You have the right to access, update, or request deletion of your personal data at any time through account settings.',
    1,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- Create user_legal_consents table tracking each user consent per agreement and version
CREATE TABLE IF NOT EXISTS public.user_legal_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_id text NOT NULL REFERENCES public.legal_agreements(id) ON DELETE CASCADE,
  version integer NOT NULL,
  agreed_at timestamp with time zone NOT NULL DEFAULT now(),
  agreement_title text NOT NULL,
  agreement_content_snapshot text NOT NULL,
  ip_address text,
  UNIQUE (user_id, agreement_id, version)
);

-- Enable RLS
ALTER TABLE public.legal_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_legal_consents ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.legal_agreements TO anon, authenticated;
GRANT ALL ON public.legal_agreements TO authenticated;
GRANT ALL ON public.user_legal_consents TO authenticated;

-- Policies for legal_agreements:
DROP POLICY IF EXISTS "Anyone can read legal agreements" ON public.legal_agreements;
CREATE POLICY "Anyone can read legal agreements"
  ON public.legal_agreements FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage legal agreements" ON public.legal_agreements;
CREATE POLICY "Admins can manage legal agreements"
  ON public.legal_agreements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policies for user_legal_consents:
DROP POLICY IF EXISTS "Users can view their own consents" ON public.user_legal_consents;
CREATE POLICY "Users can view their own consents"
  ON public.user_legal_consents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own consents" ON public.user_legal_consents;
CREATE POLICY "Users can insert their own consents"
  ON public.user_legal_consents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all consents" ON public.user_legal_consents;
CREATE POLICY "Admins can view all consents"
  ON public.user_legal_consents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
