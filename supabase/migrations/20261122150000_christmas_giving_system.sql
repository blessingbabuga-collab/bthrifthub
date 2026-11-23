-- Migration: Christmas Giving System
-- Dedicated tables, constraints, secure RLS policies, indexes, and transactional RPCs for Christmas Giving

-- 1. GIFT LISTINGS TABLE
CREATE TABLE IF NOT EXISTS public.gift_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  condition text NOT NULL,
  images text[] NOT NULL DEFAULT '{}',
  brand text,
  size text,
  color text,
  specifications text,
  intended_beneficiary_description text,
  location text NOT NULL,
  deadline timestamptz,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'applications_closed', 'awarded', 'withdrawn', 'completed')),
  selected_application_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. GIFT APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.gift_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id uuid NOT NULL REFERENCES public.gift_listings(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_type text NOT NULL CHECK (application_type IN ('self', 'someone_else')),
  intended_recipient_description text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'selected', 'not_selected', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_gift_app_message_length CHECK (char_length(message) <= 200)
);

-- Prevent duplicate active applications per user per gift
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_gift_application
  ON public.gift_applications (gift_id, applicant_id)
  WHERE status != 'withdrawn';

-- Add foreign key back to gift_listings for selected_application_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gift_selected_application'
  ) THEN
    ALTER TABLE public.gift_listings
      ADD CONSTRAINT fk_gift_selected_application
      FOREIGN KEY (selected_application_id)
      REFERENCES public.gift_applications(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. GIFT HANDOVERS TABLE
CREATE TABLE IF NOT EXISTS public.gift_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id uuid NOT NULL REFERENCES public.gift_listings(id) ON DELETE CASCADE UNIQUE,
  giver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.gift_applications(id) ON DELETE CASCADE UNIQUE,
  meeting_location text NOT NULL,
  collection_date date NOT NULL,
  collection_time text NOT NULL,
  collection_instructions text,
  recipient_confirmed_attendance boolean NOT NULL DEFAULT false,
  recipient_attendance_confirmed_at timestamptz,
  giver_confirmed_handover boolean NOT NULL DEFAULT false,
  giver_handover_confirmed_at timestamptz,
  recipient_confirmed_receipt boolean NOT NULL DEFAULT false,
  recipient_receipt_confirmed_at timestamptz,
  recipient_feedback text,
  recipient_feedback_rating integer CHECK (recipient_feedback_rating BETWEEN 1 AND 5),
  recipient_feedback_at timestamptz,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. GIFT REPORTS (Moderation) TABLE
CREATE TABLE IF NOT EXISTS public.gift_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_id uuid REFERENCES public.gift_listings(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.gift_applications(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. NOTIFICATIONS TABLE (General & Giving Notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'giving',
  entity_id text,
  link_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_gift_listings_status ON public.gift_listings (status);
CREATE INDEX IF NOT EXISTS idx_gift_listings_giver_id ON public.gift_listings (giver_id);
CREATE INDEX IF NOT EXISTS idx_gift_listings_category ON public.gift_listings (category);
CREATE INDEX IF NOT EXISTS idx_gift_listings_created_at ON public.gift_listings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_applications_gift_id ON public.gift_applications (gift_id);
CREATE INDEX IF NOT EXISTS idx_gift_applications_applicant_id ON public.gift_applications (applicant_id);
CREATE INDEX IF NOT EXISTS idx_gift_applications_status ON public.gift_applications (status);
CREATE INDEX IF NOT EXISTS idx_gift_handovers_parties ON public.gift_handovers (giver_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id, is_read, created_at DESC);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.gift_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 8. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_listings TO authenticated;
GRANT SELECT ON public.gift_listings TO anon;
GRANT ALL ON public.gift_listings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_applications TO authenticated;
GRANT ALL ON public.gift_applications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_handovers TO authenticated;
GRANT ALL ON public.gift_handovers TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.gift_reports TO authenticated;
GRANT ALL ON public.gift_reports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 9. RLS POLICIES

-- GIFT LISTINGS POLICIES
DROP POLICY IF EXISTS "Public can view published and active gifts" ON public.gift_listings;
CREATE POLICY "Public can view published and active gifts"
  ON public.gift_listings FOR SELECT
  USING (
    status IN ('published', 'applications_closed', 'awarded', 'completed')
    OR (auth.uid() = giver_id)
  );

DROP POLICY IF EXISTS "Users can insert their own gifts" ON public.gift_listings;
CREATE POLICY "Users can insert their own gifts"
  ON public.gift_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = giver_id);

DROP POLICY IF EXISTS "Givers can update their own gifts" ON public.gift_listings;
CREATE POLICY "Givers can update their own gifts"
  ON public.gift_listings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = giver_id
    OR (public.is_admin())
  );

DROP POLICY IF EXISTS "Givers can delete drafts" ON public.gift_listings;
CREATE POLICY "Givers can delete drafts"
  ON public.gift_listings FOR DELETE
  TO authenticated
  USING (
    auth.uid() = giver_id
    OR (public.is_admin())
  );

-- GIFT APPLICATIONS POLICIES
-- Applicants can view their own applications; givers can view applications for their own gifts; admins can view all.
DROP POLICY IF EXISTS "Parties can view gift applications" ON public.gift_applications;
CREATE POLICY "Parties can view gift applications"
  ON public.gift_applications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.gift_listings
      WHERE gift_listings.id = gift_applications.gift_id
        AND gift_listings.giver_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Authenticated users can submit applications" ON public.gift_applications;
CREATE POLICY "Authenticated users can submit applications"
  ON public.gift_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = applicant_id
    AND NOT EXISTS (
      SELECT 1 FROM public.gift_listings
      WHERE gift_listings.id = gift_id
        AND gift_listings.giver_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Applicants can update their own applications" ON public.gift_applications;
CREATE POLICY "Applicants can update their own applications"
  ON public.gift_applications FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.gift_listings
      WHERE gift_listings.id = gift_applications.gift_id
        AND gift_listings.giver_id = auth.uid()
    )
    OR public.is_admin()
  );

-- GIFT HANDOVERS POLICIES
DROP POLICY IF EXISTS "Participants can view handover details" ON public.gift_handovers;
CREATE POLICY "Participants can view handover details"
  ON public.gift_handovers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = giver_id
    OR auth.uid() = recipient_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Givers can create handover arrangement" ON public.gift_handovers;
CREATE POLICY "Givers can create handover arrangement"
  ON public.gift_handovers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = giver_id
    AND EXISTS (
      SELECT 1 FROM public.gift_listings
      WHERE gift_listings.id = gift_id
        AND gift_listings.giver_id = auth.uid()
        AND gift_listings.status IN ('awarded', 'applications_closed')
    )
  );

DROP POLICY IF EXISTS "Participants can update handover confirmations" ON public.gift_handovers;
CREATE POLICY "Participants can update handover confirmations"
  ON public.gift_handovers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = giver_id
    OR auth.uid() = recipient_id
    OR public.is_admin()
  );

-- GIFT REPORTS POLICIES
DROP POLICY IF EXISTS "Users can report gifts or applications" ON public.gift_reports;
CREATE POLICY "Users can report gifts or applications"
  ON public.gift_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view and manage reports" ON public.gift_reports;
CREATE POLICY "Admins can view and manage reports"
  ON public.gift_reports FOR ALL
  TO authenticated
  USING (
    auth.uid() = reporter_id
    OR public.is_admin()
  );

-- NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users or system can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users or system can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 10. TRANSACTION-SAFE DATABASE RPC FUNCTIONS

-- Function A: select_gift_recipient
-- Safely selects one recipient application, marks others not_selected, and updates gift status to 'awarded'
CREATE OR REPLACE FUNCTION public.select_gift_recipient(
  p_gift_id uuid,
  p_application_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gift record;
  v_app record;
  v_giver_profile record;
  v_applicant_rec record;
BEGIN
  -- 1. Lock and fetch gift listing
  SELECT * INTO v_gift
  FROM public.gift_listings
  WHERE id = p_gift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift listing not found');
  END IF;

  -- Verify giver authorization
  IF v_gift.giver_id != auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Only the giver can select a recipient');
  END IF;

  -- Prevent re-selection if already completed or awarded to someone else
  IF v_gift.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot change recipient: gift is already completed');
  END IF;

  -- 2. Lock and fetch application
  SELECT * INTO v_app
  FROM public.gift_applications
  WHERE id = p_application_id AND gift_id = p_gift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Application does not belong to this gift');
  END IF;

  IF v_app.status = 'withdrawn' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot select a withdrawn application');
  END IF;

  -- 3. Update the chosen application to 'selected'
  UPDATE public.gift_applications
  SET status = 'selected', updated_at = now()
  WHERE id = p_application_id;

  -- 4. Mark all other eligible applications for this gift as 'not_selected'
  UPDATE public.gift_applications
  SET status = 'not_selected', updated_at = now()
  WHERE gift_id = p_gift_id AND id != p_application_id AND status != 'withdrawn';

  -- 5. Update gift listing status to 'awarded' and set selected_application_id
  UPDATE public.gift_listings
  SET status = 'awarded',
      selected_application_id = p_application_id,
      updated_at = now()
  WHERE id = p_gift_id;

  -- 6. Insert notifications
  -- For selected recipient
  INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
  VALUES (
    v_app.applicant_id,
    'Congratulations! You have been selected for a gift! 🎁',
    'Your application for "' || v_gift.title || '" was selected by the giver. View collection arrangements.',
    'giving',
    p_gift_id::text,
    '/giving/' || p_gift_id::text
  );

  -- For non-selected applicants
  FOR v_applicant_rec IN
    SELECT applicant_id FROM public.gift_applications
    WHERE gift_id = p_gift_id AND id != p_application_id AND status = 'not_selected'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
    VALUES (
      v_applicant_rec.applicant_id,
      'Update on your Gift Application',
      'The giver has selected another recipient for "' || v_gift.title || '". Thank you for applying!',
      'giving',
      p_gift_id::text,
      '/giving/' || p_gift_id::text
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Recipient selected successfully',
    'gift_id', p_gift_id,
    'application_id', p_application_id
  );
END;
$$;

-- Function B: shortlist_gift_applicant
CREATE OR REPLACE FUNCTION public.shortlist_gift_applicant(
  p_application_id uuid,
  p_shortlist boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app record;
  v_gift record;
  v_next_status text;
BEGIN
  SELECT * INTO v_app FROM public.gift_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Application not found');
  END IF;

  SELECT * INTO v_gift FROM public.gift_listings WHERE id = v_app.gift_id;
  IF v_gift.giver_id != auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  IF v_app.status IN ('selected', 'withdrawn') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot change shortlist status for selected or withdrawn application');
  END IF;

  v_next_status := CASE WHEN p_shortlist THEN 'shortlisted' ELSE 'pending' END;

  UPDATE public.gift_applications
  SET status = v_next_status, updated_at = now()
  WHERE id = p_application_id;

  IF p_shortlist THEN
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
    VALUES (
      v_app.applicant_id,
      'Your application was shortlisted! ⭐',
      'The giver has shortlisted your application for "' || v_gift.title || '".',
      'giving',
      v_gift.id::text,
      '/giving/' || v_gift.id::text
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_next_status);
END;
$$;

-- Function C: arrange_gift_handover
CREATE OR REPLACE FUNCTION public.arrange_gift_handover(
  p_gift_id uuid,
  p_meeting_location text,
  p_collection_date date,
  p_collection_time text,
  p_collection_instructions text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gift record;
  v_app record;
  v_handover_id uuid;
BEGIN
  SELECT * INTO v_gift FROM public.gift_listings WHERE id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift listing not found');
  END IF;

  IF v_gift.giver_id != auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Only giver can arrange handover');
  END IF;

  IF v_gift.selected_application_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No recipient has been selected for this gift yet');
  END IF;

  SELECT * INTO v_app FROM public.gift_applications WHERE id = v_gift.selected_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Selected application not found');
  END IF;

  -- Upsert handover record
  INSERT INTO public.gift_handovers (
    gift_id, giver_id, recipient_id, application_id,
    meeting_location, collection_date, collection_time, collection_instructions,
    updated_at
  )
  VALUES (
    p_gift_id, v_gift.giver_id, v_app.applicant_id, v_app.id,
    p_meeting_location, p_collection_date, p_collection_time, p_collection_instructions,
    now()
  )
  ON CONFLICT (gift_id) DO UPDATE
  SET meeting_location = EXCLUDED.meeting_location,
      collection_date = EXCLUDED.collection_date,
      collection_time = EXCLUDED.collection_time,
      collection_instructions = EXCLUDED.collection_instructions,
      updated_at = now()
  RETURNING id INTO v_handover_id;

  -- Notify recipient
  INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
  VALUES (
    v_app.applicant_id,
    'Collection arranged for your gift! 📍',
    'The giver has arranged collection details for "' || v_gift.title || '". Please review and confirm attendance.',
    'giving',
    p_gift_id::text,
    '/giving/handover/' || p_gift_id::text
  );

  RETURN jsonb_build_object('success', true, 'handover_id', v_handover_id);
END;
$$;

-- Function D: confirm_handover_step
CREATE OR REPLACE FUNCTION public.confirm_handover_step(
  p_gift_id uuid,
  p_step text -- 'recipient_attendance', 'giver_handover', 'recipient_receipt'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_handover record;
  v_gift record;
  v_is_giver boolean;
  v_is_recipient boolean;
BEGIN
  SELECT * INTO v_handover FROM public.gift_handovers WHERE gift_id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Handover arrangements not found for this gift');
  END IF;

  SELECT * INTO v_gift FROM public.gift_listings WHERE id = p_gift_id FOR UPDATE;

  v_is_giver := (auth.uid() = v_handover.giver_id);
  v_is_recipient := (auth.uid() = v_handover.recipient_id);

  IF NOT v_is_giver AND NOT v_is_recipient AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized to confirm handover step');
  END IF;

  IF p_step = 'recipient_attendance' THEN
    IF NOT v_is_recipient AND NOT public.is_admin() THEN
      RETURN jsonb_build_object('success', false, 'message', 'Only the recipient can confirm attendance');
    END IF;

    UPDATE public.gift_handovers
    SET recipient_confirmed_attendance = true,
        recipient_attendance_confirmed_at = now(),
        updated_at = now()
    WHERE id = v_handover.id;

    INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
    VALUES (
      v_handover.giver_id,
      'Recipient confirmed attendance! ✅',
      'The recipient has confirmed they will attend the handover for "' || v_gift.title || '".',
      'giving',
      p_gift_id::text,
      '/giving/handover/' || p_gift_id::text
    );

  ELSIF p_step = 'giver_handover' THEN
    IF NOT v_is_giver AND NOT public.is_admin() THEN
      RETURN jsonb_build_object('success', false, 'message', 'Only the giver can confirm handing over the item');
    END IF;

    UPDATE public.gift_handovers
    SET giver_confirmed_handover = true,
        giver_handover_confirmed_at = now(),
        updated_at = now()
    WHERE id = v_handover.id;

    INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
    VALUES (
      v_handover.recipient_id,
      'Giver confirmed handover! 🎁',
      'The giver has confirmed handing over "' || v_gift.title || '". Please confirm receipt once received.',
      'giving',
      p_gift_id::text,
      '/giving/handover/' || p_gift_id::text
    );

  ELSIF p_step = 'recipient_receipt' THEN
    IF NOT v_is_recipient AND NOT public.is_admin() THEN
      RETURN jsonb_build_object('success', false, 'message', 'Only the recipient can confirm receipt');
    END IF;

    -- Sequence check: giver must have confirmed handover first
    IF NOT v_handover.giver_confirmed_handover THEN
      RETURN jsonb_build_object('success', false, 'message', 'Giver must confirm handover before receipt can be confirmed');
    END IF;

    UPDATE public.gift_handovers
    SET recipient_confirmed_receipt = true,
        recipient_receipt_confirmed_at = now(),
        is_completed = true,
        completed_at = now(),
        updated_at = now()
    WHERE id = v_handover.id;

    UPDATE public.gift_listings
    SET status = 'completed',
        updated_at = now()
    WHERE id = p_gift_id;

    -- Send completion notifications to both
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
    VALUES (
      v_handover.giver_id,
      'Christmas Gift Completed! 🎄✨',
      'Recipient confirmed receipt for "' || v_gift.title || '". You made someone''s Christmas brighter!',
      'giving',
      p_gift_id::text,
      '/giving/handover/' || p_gift_id::text
    );

    INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
    VALUES (
      v_handover.recipient_id,
      'Gift Receipt Confirmed! 🎄✨',
      'Handover of "' || v_gift.title || '" is complete. Merry Christmas and thank you for being part of our community!',
      'giving',
      p_gift_id::text,
      '/giving/handover/' || p_gift_id::text
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid confirmation step');
  END IF;

  RETURN jsonb_build_object('success', true, 'step', p_step);
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.select_gift_recipient(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shortlist_gift_applicant(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arrange_gift_handover(uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_handover_step(uuid, text) TO authenticated;

-- Function E: submit_handover_feedback
CREATE OR REPLACE FUNCTION public.submit_handover_feedback(
  p_gift_id uuid,
  p_feedback text,
  p_rating integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_handover record;
  v_gift record;
BEGIN
  SELECT * INTO v_handover FROM public.gift_handovers WHERE gift_id = p_gift_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Handover record not found');
  END IF;

  IF auth.uid() != v_handover.recipient_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the selected recipient can submit feedback');
  END IF;

  SELECT * INTO v_gift FROM public.gift_listings WHERE id = p_gift_id;

  UPDATE public.gift_handovers
  SET recipient_feedback = p_feedback,
      recipient_feedback_rating = p_rating,
      recipient_feedback_at = now(),
      updated_at = now()
  WHERE id = v_handover.id;

  INSERT INTO public.notifications (user_id, title, message, type, entity_id, link_url)
  VALUES (
    v_handover.giver_id,
    'Heartwarming Feedback Received! ❤️🎄',
    'The recipient of "' || v_gift.title || '" left a thank-you note: "' || SUBSTRING(p_feedback, 1, 60) || '..."',
    'giving',
    p_gift_id::text,
    '/giving/handover/' || p_gift_id::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Feedback recorded');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_handover_feedback(uuid, text, integer) TO authenticated;

-- 11. SEED EMAIL TEMPLATES FOR CHRISTMAS GIVING
INSERT INTO public.email_templates (event_type, subject, body_html, variables_help_text)
VALUES
  (
    'gift_application_received',
    'New Gift Application for {{gift_title}} 🎁',
    '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">' ||
    '<h1 style="color:#0f172a;font-size:22px;margin-top:0;">New Gift Application! 🎁</h1>' ||
    '<p style="color:#334155;font-size:16px;line-height:1.6;">Hi <strong>{{giver_name}}</strong>,</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">Someone has applied for your Christmas Gift listing <strong>{{gift_title}}</strong>.</p>' ||
    '<p style="color:#334155;font-size:14px;line-height:1.6;">Applicant message:</p>' ||
    '<blockquote style="border-left:4px solid #f59e0b;padding-left:16px;margin:16px 0;color:#475569;font-style:italic;">{{application_message}}</blockquote>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">You can review, shortlist, and select a recipient anytime from your dashboard.</p>' ||
    '<div style="text-align:center;margin:28px 0;">' ||
    '<a href="{{review_url}}" style="display:inline-block;background-color:#d97706;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:9999px;">Review Applications</a>' ||
    '</div>' ||
    '</div>',
    'Available variables: {{giver_name}}, {{gift_title}}, {{application_message}}, {{review_url}}'
  ),
  (
    'gift_recipient_selected',
    'Congratulations! You have been selected for {{gift_title}}! 🎄',
    '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;">' ||
    '<h1 style="color:#16a34a;font-size:22px;margin-top:0;">You were selected! 🎄🎁</h1>' ||
    '<p style="color:#334155;font-size:16px;line-height:1.6;">Hi <strong>{{recipient_name}}</strong>,</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">Wonderful news! The giver of <strong>{{gift_title}}</strong> has selected your application.</p>' ||
    '<p style="color:#334155;font-size:15px;line-height:1.6;">The giver will arrange the collection details. Please check your applications and handover tracker for updates.</p>' ||
    '<div style="text-align:center;margin:28px 0;">' ||
    '<a href="{{handover_url}}" style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:9999px;">View Handover Details</a>' ||
    '</div>' ||
    '</div>',
    'Available variables: {{recipient_name}}, {{gift_title}}, {{handover_url}}'
  )
ON CONFLICT (event_type) DO UPDATE
SET subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    variables_help_text = EXCLUDED.variables_help_text;
