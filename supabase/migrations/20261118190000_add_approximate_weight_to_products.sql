ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS approximate_weight text;
