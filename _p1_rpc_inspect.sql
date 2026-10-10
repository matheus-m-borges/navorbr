SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'create_notification_event_idempotent'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
