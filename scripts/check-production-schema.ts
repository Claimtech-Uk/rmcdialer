import { Client } from 'pg';

function getConnectionString(): string {
  const fromEnv = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  if (!fromEnv) {
    throw new Error('Missing PROD_DATABASE_URL or DATABASE_URL');
  }
  return fromEnv;
}

async function fetchTableColumns(client: Client, table: string) {
  return client.query(
    `
    SELECT 
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `,
    [table]
  );
}

async function checkProductionSchema() {
  console.log('🔍 Checking production database schema (read-only)...\n');

  const client = new Client({
    connectionString: getConnectionString(),
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Agents
    console.log('📋 agents');
    const agentsColumns = await fetchTableColumns(client, 'agents');
    console.table(agentsColumns.rows);

    // Agent sessions
    console.log('\n📋 agent_sessions');
    const sessionsColumns = await fetchTableColumns(client, 'agent_sessions');
    console.table(sessionsColumns.rows);

    // New queue tables
    console.log('\n📋 unsigned_users_queue');
    const unsignedColumns = await fetchTableColumns(client, 'unsigned_users_queue');
    console.table(unsignedColumns.rows);

    console.log('\n📋 outstanding_requests_queue');
    const outstandingColumns = await fetchTableColumns(client, 'outstanding_requests_queue');
    console.table(outstandingColumns.rows);

    // Inbound queue (created via raw SQL file if present)
    console.log('\n📋 inbound_call_queue (if exists)');
    try {
      const inboundColumns = await fetchTableColumns(client, 'inbound_call_queue');
      if (inboundColumns.rows.length > 0) {
        console.table(inboundColumns.rows);
      } else {
        console.log('  (table not found)');
      }
    } catch {
      console.log('  (table not found)');
    }

    // Highlight potential mismatches we specifically care about
    const outstandingRequirement = outstandingColumns.rows.find((r: any) => r.column_name === 'requirement_types');
    if (outstandingRequirement) {
      const typeLabel = `${outstandingRequirement.data_type}${outstandingRequirement.udt_name ? ` (${outstandingRequirement.udt_name})` : ''}`;
      console.log(`\n🔎 outstanding_requests_queue.requirement_types column type: ${typeLabel}`);
      console.log('   Expected: jsonb OR text[] (decide and migrate to one)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkProductionSchema();