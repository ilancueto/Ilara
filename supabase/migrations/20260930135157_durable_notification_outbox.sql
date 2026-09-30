-- Transactional outbox: no historical backfill or customer messages on deployment.
CREATE TABLE public.order_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('created','payment_pending','payment_received','confirmed','preparing','ready','completed','cancelled')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','sent','failed','skipped')),
  payload jsonb,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  leased_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_code text,
  UNIQUE (order_id, kind)
);
CREATE INDEX order_notification_outbox_due ON public.order_notification_outbox(available_at) WHERE state IN ('pending','processing');
ALTER TABLE public.order_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.order_notification_outbox TO service_role;

CREATE FUNCTION private.enqueue_order_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_order uuid; v_kind text;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    v_order := NEW.id;
    IF TG_OP = 'INSERT' THEN v_kind := 'created';
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('confirmed','preparing','ready','completed','cancelled') THEN v_kind := NEW.status;
    ELSE RETURN NEW;
    END IF;
  ELSE
    v_order := NEW.order_id;
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    IF NEW.status = 'approved' THEN v_kind := 'payment_received';
    ELSIF NEW.status = 'requires_review' THEN v_kind := 'payment_pending';
    ELSE RETURN NEW;
    END IF;
  END IF;
  INSERT INTO public.order_notification_outbox(order_id,kind)
  VALUES(v_order,v_kind) ON CONFLICT(order_id,kind) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.enqueue_order_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER orders_notification_outbox AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.enqueue_order_notification();
CREATE TRIGGER payments_notification_outbox AFTER INSERT OR UPDATE OF status ON public.order_payments
FOR EACH ROW EXECUTE FUNCTION private.enqueue_order_notification();

-- Invoker-only backend RPC. Lease fencing prevents a stale worker completing a reclaimed job.
CREATE FUNCTION public.claim_order_notifications(p_limit integer DEFAULT 3,p_order_id uuid DEFAULT NULL,p_kind text DEFAULT NULL)
RETURNS SETOF public.order_notification_outbox LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.order_notification_outbox SET state='failed',last_code='retry_window_expired',completed_at=now()
  WHERE state IN ('pending','processing') AND created_at < now()-interval '22 hours';
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.order_notification_outbox
    WHERE ((state='pending' AND available_at<=now()) OR (state='processing' AND leased_until<now()))
      AND (p_order_id IS NULL OR order_id=p_order_id) AND (p_kind IS NULL OR kind=p_kind)
    ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(p_limit,3))
  ) UPDATE public.order_notification_outbox q SET state='processing',attempts=q.attempts+1,
      lease_token=gen_random_uuid(),leased_until=now()+interval '10 minutes'
    FROM due WHERE q.id=due.id RETURNING q.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_order_notifications(integer,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_notifications(integer,uuid,text) TO service_role;

CREATE FUNCTION public.finish_order_notification(p_id uuid,p_lease uuid,p_state text,p_code text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_changed integer;
BEGIN
  IF p_state NOT IN ('sent','pending','failed','skipped') THEN RAISE EXCEPTION 'invalid_notification_state'; END IF;
  UPDATE public.order_notification_outbox SET
    state=CASE WHEN p_state='pending' AND attempts>=8 THEN 'failed' ELSE p_state END,
    completed_at=CASE WHEN p_state<>'pending' OR attempts>=8 THEN now() ELSE NULL END,
    available_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer),
    lease_token=NULL,leased_until=NULL,last_code=left(p_code,64)
  WHERE id=p_id AND state='processing' AND lease_token=p_lease;
  GET DIAGNOSTICS v_changed=ROW_COUNT;
  RETURN v_changed=1;
END $$;
REVOKE ALL ON FUNCTION public.finish_order_notification(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_order_notification(uuid,uuid,text,text) TO service_role;
