-- Migration: Admin toggle for Find a Gift availability + Gift Published Thank-You Email Template

-- 1. Seed platform setting to blind "Find a Gift" until Admin opens it
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'giving_find_gift_enabled',
  'false',
  'Controls whether the public Find a Gift browsing experience is open to users'
)
ON CONFLICT (key) DO NOTHING;

-- 2. Seed Thank-You Email Template when a Giver publishes a Christmas Gift
INSERT INTO public.email_templates (event_type, subject, body_html, variables_help_text)
VALUES (
  'gift_published_thanks',
  'Thank you for giving "{{gift_title}}" this Christmas! 🎄🎁',
  '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">' ||
  '<h1 style="color:#047857;font-size:22px;margin-top:0;">Thank You for Your Generosity! 🎄🎁</h1>' ||
  '<p style="color:#334155;font-size:16px;line-height:1.6;">Hi <strong>{{giver_name}}</strong>,</p>' ||
  '<p style="color:#334155;font-size:15px;line-height:1.6;">Thank you for publishing <strong>{{gift_title}}</strong> on BTHRIFTS Christmas Giving. Your kindness will make someone''s Christmas truly special.</p>' ||
  '<p style="color:#334155;font-size:14px;line-height:1.6;">We will notify you by email and in-app whenever someone applies for your gift so you can review their pitch and choose a recipient.</p>' ||
  '<div style="text-align:center;margin:28px 0;">' ||
  '<a href="{{manage_url}}" style="display:inline-block;background-color:#047857;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:9999px;">Manage Your Given Gifts</a>' ||
  '</div>' ||
  '</div>',
  'Available variables: {{giver_name}}, {{gift_title}}, {{manage_url}}'
)
ON CONFLICT (event_type) DO UPDATE
SET subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    variables_help_text = EXCLUDED.variables_help_text;
