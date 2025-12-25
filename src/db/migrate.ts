import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool, closePool } from './connection';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  console.log('Starting database migration...');

  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    await pool.query(schema);

    console.log('✅ Migration completed successfully!');
    console.log('\nSchemas created:');
    console.log('  - shared (Common data)');
    console.log('  - alice_strategy (Strategic decisions)');
    console.log('  - dorothy_finance (Financial models & valuations)');
    console.log('  - belle_market (Market intelligence)');
    console.log('  - anna_compliance (Regulations & certifications)');
    console.log('  - wendy_meetings (Meeting records & action items)');
    console.log('  - aurora_ops (Operational data)');
    console.log('  - elsa_risk (Risk assessments & guardrails)');
    console.log('  - amy_tracker (Project history)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await closePool();
  }
}

migrate();
