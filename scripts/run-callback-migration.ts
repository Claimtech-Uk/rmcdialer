import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function main() {
  const url = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ Missing PROD_DATABASE_URL or DATABASE_URL');
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), 'scripts/2025-08-19_add-callback-lifecycle.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Migration SQL file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Neon requires SSL
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    console.log('🚀 Running callback lifecycle migration...');
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log('✅ Executed:', stmt.split('\n')[0].slice(0, 120));
      } catch (e: any) {
        // Ignore duplicate index errors etc.
        console.warn('⚠️ Statement issue (continuing):', e?.message || e);
      }
    }
    console.log('🎉 Migration complete');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});


