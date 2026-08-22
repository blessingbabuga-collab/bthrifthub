CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    variables_help_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin full access" ON email_templates FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

INSERT INTO email_templates (event_type, subject, body_html, variables_help_text) VALUES
('order_shipped', 'Your order has been shipped!', '<h1>Great news, {{buyer_name}}!</h1><p>Your order for <strong>{{product_name}}</strong> has been shipped by the seller.</p><p>Tracking Info: {{tracking_info}}</p>', 'Available variables: {{buyer_name}}, {{product_name}}, {{tracking_info}}, {{order_id}}'),
('order_delivered', 'Order Delivered & Escrow Released', '<h1>Hi {{buyer_name}},</h1><p>Your order <strong>{{product_name}}</strong> has been marked as delivered.</p><p>The escrow funds have been released to the seller.</p>', 'Available variables: {{buyer_name}}, {{product_name}}, {{order_id}}'),
('withdrawal_requested', 'Withdrawal Request Received', '<h1>Hi {{user_name}},</h1><p>We have received your withdrawal request for <strong>{{amount}}</strong>.</p><p>It will be processed shortly.</p>', 'Available variables: {{user_name}}, {{amount}}');
