SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'subscriptions','plans','accounts','notification_events',
    'notifications','notification_deliveries','notification_preferences',
    'notification_rules','automation_runs','provisioning_records',
    'product_onboarding_states','user_consents','memberships','invitations',
    'account_members','profiles'
  )
ORDER BY table_name, ordinal_position;
