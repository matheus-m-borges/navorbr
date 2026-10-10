import postgres from "postgres";

const connStr = "postgresql://postgres.ngayznhpiyecbpikbfuz:u5G4ie0BNSdl4D7zqwGTUdRmEZQlrcLU@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connStr);

async function test() {
  try {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'barberhub' AND table_name = 'accounts_payable';
    `;
    console.log("Columns of barberhub.accounts_payable:", cols);
  } catch (err) {
    console.error("PG Error:", err.message);
  } finally {
    await sql.end();
  }
}

test();
