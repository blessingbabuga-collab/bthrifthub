-- Add default platform settings for official email configuration (Resend)
INSERT INTO public.platform_settings (key, value, description)
VALUES 
  ('resend_from_name', 'BTHRIFTS', 'Default sender name for official platform emails'),
  ('resend_from_email', 'notifications@resend.dev', 'Default sender email address registered/verified on Resend'),
  ('resend_reply_to', 'support@thriftyfy.africa', 'Reply-to email address for customer inquiries')
ON CONFLICT (key) DO NOTHING;
