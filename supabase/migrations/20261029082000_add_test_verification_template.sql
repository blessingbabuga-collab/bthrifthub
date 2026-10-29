-- Add test_verification email template so test emails succeed on any deployed version of send-email
INSERT INTO public.email_templates (event_type, subject, body_html, variables_help_text)
VALUES (
  'test_verification',
  '{{test_subject}}',
  '{{test_body}}',
  'Variables: {{test_subject}}, {{test_body}}'
)
ON CONFLICT (event_type) DO UPDATE
SET subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html;
