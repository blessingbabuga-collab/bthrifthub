-- Create platform_settings table to store admin configurable fee rates
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read platform settings (needed for checkout calculations)
CREATE POLICY "Allow public read platform settings" ON public.platform_settings
    FOR SELECT TO public USING (true);

-- Only admins can modify platform settings
CREATE POLICY "Allow admin full access to platform settings" ON public.platform_settings
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Seed default commission percentage (8.00%)
INSERT INTO public.platform_settings (key, value, description)
VALUES ('platform_commission_percent', '8', 'Platform commission percentage deducted from merchant sales')
ON CONFLICT (key) DO NOTHING;

-- Helper SQL function to get current commission percentage safely
CREATE OR REPLACE FUNCTION public.get_platform_commission_percent()
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_val text;
BEGIN
    SELECT value INTO v_val FROM public.platform_settings WHERE key = 'platform_commission_percent';
    IF v_val IS NULL OR NOT (v_val ~ '^[0-9]+(\.[0-9]+)?$') THEN
        RETURN 8.00; -- default fallback
    END IF;
    RETURN v_val::numeric;
END;
$$;
