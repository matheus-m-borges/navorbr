#!/bin/sh
pg_dump -U postgres -d navor_core_test --data-only   -t core.accounts -t core.subscriptions -t rephub.brands -t rephub.clients   --where="id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' OR account_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'"   > /tmp/tenant_a_data.sql
echo "DUMP_EXIT_CODE=$?"
wc -l /tmp/tenant_a_data.sql

#!/bin/sh
pg_dump -U postgres -d navor_core_test --data-only   -t core.accounts -t core.subscriptions -t rephub.brands -t rephub.clients   --where="id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' OR account_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'"   > /tmp/tenant_a_data.sql
echo "DUMP_EXIT=$?"
if [ -f /tmp/tenant_a_data.sql ]; then
  echo "LINES=$(wc -l < /tmp/tenant_a_data.sql)"
else
  echo "FILE_MISSING"
fi

