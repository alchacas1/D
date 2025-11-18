#!/usr/bin/env node

/**
 * Migration script for Price Master
 * This script migrates data from JSON files to Firestore
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_FILES = ['.env.local', '.env'];
ENV_FILES.forEach(envFile => {
  const fullPath = path.resolve(__dirname, '..', envFile);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
  }
});

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'node10',
  },
});

const { MigrationService } = require('../src/utils/migration');

async function main() {
  try {
    console.log('🚀 Starting Price Master data migration...');
    console.log('📁 Migrating from JSON files to Firestore...\n');
    
    await MigrationService.runAllMigrations();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('🎉 Your data is now available in Firestore');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('💡 Please check your Firebase configuration and try again');
    process.exit(1);
  }
}

main();
