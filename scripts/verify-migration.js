#!/usr/bin/env node
/**
 * Quick verification script for database migration
 */

import { existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 Verifying database migration setup...\n');

const projectRoot = process.cwd();
const legacyDbPath = join(projectRoot, 'data', 'rezepti.db');
const reactDbPath = join(projectRoot, 'data', 'rezepti-react.db');

console.log('📁 Checking database files:');
console.log(`  Legacy DB: ${legacyDbPath} - ${existsSync(legacyDbPath) ? '✅ Exists' : '❌ Missing'}`);
console.log(`  React DB:  ${reactDbPath} - ${existsSync(reactDbPath) ? '✅ Exists' : '⚠️  Will be created on first use'}`);

console.log('\n📁 Checking source files:');
const filesToCheck = [
  'src/db.ts',
  'src/db-react.ts',
  'src/db-manager.ts',
  'src/api-react.ts',
  'src/config.ts',
  'scripts/migrate-to-react-db.ts',
  'scripts/test-migration.ts'
];

filesToCheck.forEach(file => {
  const fullPath = join(projectRoot, file);
  console.log(`  ${file} - ${existsSync(fullPath) ? '✅ Exists' : '❌ Missing'}`);
});

console.log('\n📋 Checking package.json scripts:');
import { readFileSync } from 'fs';
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const scripts = packageJson.scripts || {};
console.log(`  db:migrate - ${scripts['db:migrate'] ? '✅ Exists' : '❌ Missing'}`);

console.log('\n🎯 Summary:');
console.log('1. Legacy database continues to work for existing API endpoints');
console.log('2. React database will be used for /api/v1/ endpoints');
console.log('3. Run migration with: npm run db:migrate');
console.log('4. Test migration with: npx tsx scripts/test-migration.ts');
console.log('5. Start server with: npm start');

console.log('\n🚀 Next steps:');
console.log('1. Start server: npm start');
console.log('2. Test legacy endpoints: curl http://localhost:3000/api/recipes');
console.log('3. Test React endpoints: curl http://localhost:3000/api/v1/recipes');
console.log('4. Migrate data: npm run db:migrate');
console.log('5. Verify migration: npx tsx scripts/test-migration.ts');