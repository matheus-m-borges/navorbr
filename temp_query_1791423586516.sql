SELECT name, created_at FROM vault.decrypted_secrets WHERE name IN ('navor_base_url', 'navor_cron_secret');
