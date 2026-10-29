-- Add resend_api_key to platform_settings so Resend works directly without requiring CLI secret deployment
INSERT INTO public.platform_settings (key, value, description)
VALUES 
  ('resend_api_key', '', 'API Key from resend.com to send all official platform emails')
ON CONFLICT (key) DO NOTHING;
