-- Migration: 20261123100000_giving_booking_start_date.sql
-- Description: Platform setting for admin to configure the date when gift bookings/exchanges commence.

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'giving_booking_start_date',
  '2026-12-06',
  'The official date when the general public can start booking/applying for Christmas gifts'
)
ON CONFLICT (key) DO NOTHING;
