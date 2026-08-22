-- CREATE REVIEWS TABLE
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  buyer_id uuid REFERENCES public.profiles(id) NOT NULL,
  seller_id uuid REFERENCES public.profiles(id) NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  photos text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "Reviews are public to read" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (true);

-- Buyers can only review if the order belongs to them and is delivered
CREATE POLICY "Buyers can leave reviews for delivered orders" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = buyer_id AND
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_id 
      AND orders.buyer_id = auth.uid() 
      AND orders.status = 'delivered'
    )
  );

-- Trigger to recalculate seller rating when a new review is added
CREATE OR REPLACE FUNCTION public.handle_new_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_avg numeric;
BEGIN
  SELECT round(avg(rating)::numeric, 1) INTO new_avg
  FROM public.reviews
  WHERE seller_id = NEW.seller_id;
  
  UPDATE public.profiles
  SET rating = new_avg
  WHERE id = NEW.seller_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_seller_rating
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.handle_new_review();
