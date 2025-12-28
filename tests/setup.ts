/**
 * Vitest setup file
 * Runs before all tests
 */

import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Verify required environment variables
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`⚠️  Warning: ${key} not set in environment`);
  }
}

console.log('🧪 Test environment loaded');
console.log(`📊 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`);
