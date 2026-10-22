-- Allow 'paystack' as a valid payment_method in orders table
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_method_check 
CHECK (payment_method IN ('card', 'transfer', 'cod', 'paystack'));
