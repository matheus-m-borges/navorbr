-- 1. Verificar constraints únicas em notification_preferences
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.notification_preferences'::regclass
  AND contype = 'u';

-- 2. Verificar índices únicos em notification_preferences
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notification_preferences'
  AND schemaname = 'public';

-- 3. Verificar duplicatas existentes (user_id, category, channel)
SELECT user_id, category, channel, COUNT(*) as cnt
FROM notification_preferences
GROUP BY user_id, category, channel
HAVING COUNT(*) > 1
LIMIT 10;

-- 4. Definição da RPC create_notification_event_idempotent
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'create_notification_event_idempotent'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
