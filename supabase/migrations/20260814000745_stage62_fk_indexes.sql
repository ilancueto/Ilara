-- Stage 6.2 follow-up: cover foreign keys reported by hosted performance advisors.
CREATE INDEX IF NOT EXISTS stock_alerts_assigned_to_idx
  ON public.stock_alerts (assigned_to);

CREATE INDEX IF NOT EXISTS stock_alert_events_actor_user_id_idx
  ON public.stock_alert_events (actor_user_id);
