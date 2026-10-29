-- Add Welcome Email and Essential Merchant/Order Templates
INSERT INTO public.email_templates (event_type, subject, body_html, variables_help_text)
VALUES
  (
    'welcome_user',
    'Welcome to BTHRIFTS, {{user_name}}! 🎉',
    '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">' ||
    '<h1 style="color:#0f172a;font-size:24px;margin-top:0;">Welcome to BTHRIFTS! 🛍️</h1>' ||
    '<p style="color:#334155;font-size:16px;line-height:1.6;">Hi <strong>{{user_name}}</strong>,</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">We are thrilled to welcome you to Nigeria''s premier thrift fashion & lifestyle community. Whether you are hunting for rare vintage gems or clearing out your wardrobe to make extra cash, you are in the right place.</p>' ||
    '<div style="background-color:#f8fafc;padding:20px;border-radius:12px;margin:24px 0;border:1px solid #e2e8f0;">' ||
    '<h3 style="margin:0 0 12px 0;color:#0f172a;font-size:16px;">Here is how you can get started:</h3>' ||
    '<ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">' ||
    '<li><strong>Browse Verified Thrift:</strong> Discover verified clothing, shoes, and accessories protected by our escrow guarantee.</li>' ||
    '<li><strong>Sell Your Wardrobe:</strong> Setup your thrift store in minutes and reach thousands of buyers.</li>' ||
    '<li><strong>Safe Escrow Payments:</strong> Funds are held safely and only released when delivery is confirmed.</li>' ||
    '</ul>' ||
    '</div>' ||
    '<div style="text-align:center;margin:32px 0;">' ||
    '<a href="https://thriftyfy.africa/browse" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:9999px;">Start Exploring Thrift</a>' ||
    '</div>' ||
    '<p style="color:#64748b;font-size:13px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;margin-bottom:0;">Need help? Reply directly to this email or reach us at <a href="mailto:support@thriftyfy.africa" style="color:#6366f1;">support@thriftyfy.africa</a>.</p>' ||
    '</div>',
    'Available variables: {{user_name}}, {{email}}'
  ),
  (
    'merchant_verified',
    'Congratulations! Your Merchant Account is Verified 🛡️',
    '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">' ||
    '<h1 style="color:#059669;font-size:24px;margin-top:0;">Your Store is Verified! 🛡️</h1>' ||
    '<p style="color:#334155;font-size:16px;line-height:1.6;">Hi <strong>{{merchant_name}}</strong>,</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">Great news! The BTHRIFTS admin team has reviewed and approved your merchant verification documents. Your store now proudly displays the official <strong>Verified Badge</strong>.</p>' ||
    '<div style="background-color:#ecfdf5;padding:16px;border-radius:12px;margin:20px 0;border:1px solid #a7f3d0;">' ||
    '<p style="margin:0;color:#065f46;font-size:14px;font-weight:600;">Benefits of your verified status:</p>' ||
    '<ul style="margin:8px 0 0 0;padding-left:20px;color:#047857;font-size:14px;line-height:1.6;">' ||
    '<li>Increased buyer trust and higher conversion rates</li>' ||
    '<li>Priority placement in thrift search results</li>' ||
    '<li>Express payout processing for completed sales</li>' ||
    '</ul>' ||
    '</div>' ||
    '<p style="color:#334155;font-size:15px;">Keep up the great work and happy selling!</p>' ||
    '</div>',
    'Available variables: {{merchant_name}}'
  ),
  (
    'merchant_verification_rejected',
    'Update regarding your Merchant Verification Request',
    '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">' ||
    '<h1 style="color:#dc2626;font-size:22px;margin-top:0;">Verification Request Update</h1>' ||
    '<p style="color:#334155;font-size:16px;line-height:1.6;">Hi <strong>{{merchant_name}}</strong>,</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">Our compliance team was unable to approve your merchant verification request at this time. This usually occurs if submitted identification documents are blurry, incomplete, or unreadable.</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">You can re-upload clear photos of a valid government ID directly through your dashboard settings.</p>' ||
    '<p style="color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;padding-top:16px;">If you have any questions, reach out to <a href="mailto:support@thriftyfy.africa" style="color:#6366f1;">support@thriftyfy.africa</a>.</p>' ||
    '</div>',
    'Available variables: {{merchant_name}}'
  ),
  (
    'order_cancelled',
    'Order Cancelled — #{{tracking_code}}',
    '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">' ||
    '<h1 style="color:#dc2626;font-size:22px;margin-top:0;">Order Cancelled</h1>' ||
    '<p style="color:#334155;font-size:16px;line-height:1.6;">Hi <strong>{{user_name}}</strong>,</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">Order <strong>#{{tracking_code}}</strong> for <strong>{{product_name}}</strong> has been cancelled.</p>' ||
    '<p style="color:#334155;font-size:14px;line-height:1.6;">If payment had already been made, any held escrow balance has been automatically returned to your wallet balance.</p>' ||
    '<p style="color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;padding-top:16px;">Thank you for using BTHRIFTS.</p>' ||
    '</div>',
    'Available variables: {{user_name}}, {{tracking_code}}, {{product_name}}'
  ),
  (
    'dispute_resolved',
    'Escrow Dispute Resolution Update — Order #{{tracking_code}}',
    '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">' ||
    '<h1 style="color:#0f172a;font-size:22px;margin-top:0;">Dispute Resolution Notice</h1>' ||
    '<p style="color:#334155;font-size:16px;line-height:1.6;">Hi <strong>{{user_name}}</strong>,</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">The dispute regarding Order <strong>#{{tracking_code}}</strong> has been reviewed and resolved by our administration team.</p>' ||
    '<div style="background-color:#f8fafc;padding:16px;border-radius:12px;margin:20px 0;border:1px solid #e2e8f0;">' ||
    '<p style="margin:0;color:#0f172a;font-size:14px;"><strong>Resolution Outcome:</strong> {{resolution}}</p>' ||
    '</div>' ||
    '<p style="color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;padding-top:16px;">Please check your wallet for any refunded or released escrow funds.</p>' ||
    '</div>',
    'Available variables: {{user_name}}, {{tracking_code}}, {{resolution}}'
  )
ON CONFLICT (event_type) DO UPDATE
SET subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    variables_help_text = EXCLUDED.variables_help_text;
