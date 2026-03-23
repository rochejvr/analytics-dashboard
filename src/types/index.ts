export interface ActivityEvent {
  id: string;
  app_id: string;
  environment: string;
  category: 'user_action' | 'system' | 'pipeline' | 'error' | 'performance';
  event_name: string;
  entity_type: string | null;
  entity_id: string | null;
  session_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  stage: string | null;
  previous_stage: string | null;
  duration_ms: number | null;
  value_numeric: number | null;
  value_currency: string | null;
  metadata: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  occurred_at: string;
  created_at: string;
}

export interface EventSummary {
  event_name: string;
  count: number;
  avg_duration_ms: number | null;
  total_value: number | null;
}

export interface DateRange {
  label: string;
  from: Date;
  to: Date;
}
