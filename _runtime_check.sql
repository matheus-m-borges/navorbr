-- 1. Schema real da tabela subscriptions
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'subscriptions' ORDER BY ordinal_position;
-- 2. Verificar se product_id existe em alguma tabela relacionada
SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'product_id' AND table_schema = 'public';
