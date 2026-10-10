BEGIN;
-- Tenant A
INSERT INTO core.accounts (id, name) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant A') ON CONFLICT (id) DO NOTHING;
INSERT INTO core.plans (id, name, amount) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Plan A', 100) ON CONFLICT (id) DO NOTHING;
INSERT INTO core.subscriptions (id, account_id, plan_id, status, amount) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active', 100) ON CONFLICT (account_id) DO UPDATE SET plan_id=EXCLUDED.plan_id;
INSERT INTO rephub.brands (id, company_name, brand, status, is_demo, states) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Brand A', 'BA', 'Ativa', false, '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO rephub.clients (id, legal_name, status, interest_brands) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Client A', 'Active', '{}') ON CONFLICT (id) DO NOTHING;

-- Tenant B
INSERT INTO core.accounts (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Tenant B') ON CONFLICT (id) DO NOTHING;
INSERT INTO core.plans (id, name, amount) VALUES ('22222222-2222-2222-2222-222222222222', 'Plan B', 200) ON CONFLICT (id) DO NOTHING;
INSERT INTO core.subscriptions (id, account_id, plan_id, status, amount) VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'active', 200) ON CONFLICT (account_id) DO UPDATE SET plan_id=EXCLUDED.plan_id;
INSERT INTO rephub.brands (id, company_name, brand, status, is_demo, states) VALUES ('44444444-4444-4444-4444-444444444444', 'Brand B', 'BB', 'Ativa', false, '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO rephub.clients (id, legal_name, status, interest_brands) VALUES ('55555555-5555-5555-5555-555555555555', 'Client B', 'Active', '{}') ON CONFLICT (id) DO NOTHING;
COMMIT;
