\echo 'EXTRACTING_TENANT_A'
\copy (SELECT * FROM core.accounts WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') TO '/tmp/tenant_a_accounts.csv' WITH CSV HEADER
\copy (SELECT * FROM core.subscriptions WHERE account_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') TO '/tmp/tenant_a_subscriptions.csv' WITH CSV HEADER
\copy (SELECT * FROM rephub.brands WHERE id IN (SELECT brand_id FROM rephub.clients WHERE legal_name = 'Client A')) TO '/tmp/tenant_a_brands.csv' WITH CSV HEADER
\copy (SELECT * FROM rephub.clients WHERE legal_name = 'Client A') TO '/tmp/tenant_a_clients.csv' WITH CSV HEADER
\echo 'EXTRACTION_COMPLETE'

