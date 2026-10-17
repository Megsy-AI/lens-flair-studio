CREATE TABLE public.lumen_payment_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 device_hash text NOT NULL,
 provider text NOT NULL,
 provider_session text,
 amount integer NOT NULL DEFAULT 300,
 currency text NOT NULL DEFAULT 'USD',
 status text NOT NULL DEFAULT 'pending',
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lumen_payment_orders TO service_role;
REVOKE ALL ON public.lumen_payment_orders FROM anon, authenticated;
ALTER TABLE public.lumen_payment_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX lumen_orders_device ON public.lumen_payment_orders(device_hash, status);
CREATE UNIQUE INDEX lumen_orders_provider_session ON public.lumen_payment_orders(provider, provider_session) WHERE provider_session IS NOT NULL;
CREATE FUNCTION public.lumen_order_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER lumen_order_updated BEFORE UPDATE ON public.lumen_payment_orders FOR EACH ROW EXECUTE FUNCTION public.lumen_order_timestamp();
CREATE POLICY lumen_orders_no_client_access ON public.lumen_payment_orders FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TABLE public.bot_settings (key text PRIMARY KEY, value text, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.bot_settings TO service_role;
REVOKE ALL ON public.bot_settings FROM anon, authenticated;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bot_settings_no_client_access ON public.bot_settings FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);