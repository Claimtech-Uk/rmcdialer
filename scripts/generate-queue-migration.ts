#!/usr/bin/env tsx

/**
 * Queue Separation Migration Generator
 * 
 * This script safely generates the Prisma migration for separated queue tables
 * without affecting the current database.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface MigrationConfig {
  migrationName: string;
  backupSchema: boolean;
  validateSchema: boolean;
  dryRun: boolean;
}

class QueueMigrationGenerator {
  private config: MigrationConfig;
  private originalSchemaPath: string;
  private newSchemaPath: string;
  private backupSchemaPath: string;

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      migrationName: 'add_separated_queue_tables',
      backupSchema: true,
      validateSchema: true,
      dryRun: true,
      ...config
    };

    this.originalSchemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
    // Archived draft schema. Kept only for historical reference.
    this.newSchemaPath = path.join(process.cwd(), 'archive/prisma/schema-new-queues.prisma');
    this.backupSchemaPath = path.join(process.cwd(), 'prisma/schema.prisma.backup');
  }

  async generateMigration(): Promise<void> {
    console.log('🚀 Starting Queue Separation Migration Generation');
    console.log(`   📋 Migration Name: ${this.config.migrationName}`);
    console.log(`   🔒 Dry Run: ${this.config.dryRun}`);
    console.log('');

    try {
      // Step 1: Backup original schema
      if (this.config.backupSchema) {
        await this.backupOriginalSchema();
      }

      // Step 2: Validate the new schema
      if (this.config.validateSchema) {
        await this.validateNewSchema();
      }

      // Step 3: Generate migration (dry run)
      if (this.config.dryRun) {
        await this.generateDryRunMigration();
      } else {
        await this.generateActualMigration();
      }

      console.log('✅ Migration generation completed successfully');

    } catch (error) {
      console.error('❌ Migration generation failed:', error);
      
      // Restore original schema if we modified it
      if (existsSync(this.backupSchemaPath)) {
        await this.restoreOriginalSchema();
      }
      
      throw error;
    }
  }

  private async backupOriginalSchema(): Promise<void> {
    console.log('📄 Backing up original schema.prisma...');
    
    if (!existsSync(this.originalSchemaPath)) {
      throw new Error('Original schema.prisma not found');
    }

    copyFileSync(this.originalSchemaPath, this.backupSchemaPath);
    console.log(`   ✅ Backup created: ${this.backupSchemaPath}`);
  }

  private async validateNewSchema(): Promise<void> {
    console.log('🔍 Validating new schema...');
    
    if (!existsSync(this.newSchemaPath)) {
      throw new Error('New schema file not found: ' + this.newSchemaPath);
    }

    // Temporarily copy new schema to check syntax
    const tempSchemaPath = path.join(process.cwd(), 'prisma/schema-temp.prisma');
    copyFileSync(this.newSchemaPath, tempSchemaPath);

    try {
      // Validate schema syntax using Prisma
      await execAsync(`npx prisma validate --schema=${tempSchemaPath}`);
      console.log('   ✅ Schema syntax is valid');

      // Generate client to check for any relation issues
      await execAsync(`npx prisma generate --schema=${tempSchemaPath}`);
      console.log('   ✅ Schema relations are valid');

    } finally {
      // Clean up temp file
      if (existsSync(tempSchemaPath)) {
        require('fs').unlinkSync(tempSchemaPath);
      }
    }
  }

  private async generateDryRunMigration(): Promise<void> {
    console.log('🧪 Generating migration (DRY RUN)...');
    
    // Copy new schema to main location temporarily
    copyFileSync(this.newSchemaPath, this.originalSchemaPath);

    try {
      // Generate migration in dry run mode
      const { stdout, stderr } = await execAsync(
        `npx prisma migrate diff --from-schema-datamodel=${this.backupSchemaPath} --to-schema-datamodel=${this.originalSchemaPath} --script`
      );

      console.log('📋 Generated Migration SQL:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(stdout);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (stderr) {
        console.warn('⚠️ Warnings:', stderr);
      }

      // Save migration SQL to file for review
      const migrationSqlPath = path.join(process.cwd(), `migration-${this.config.migrationName}.sql`);
      writeFileSync(migrationSqlPath, stdout);
      console.log(`💾 Migration SQL saved to: ${migrationSqlPath}`);

    } finally {
      // Restore original schema
      await this.restoreOriginalSchema();
    }
  }

  private async generateActualMigration(): Promise<void> {
    console.log('🚀 Generating actual migration...');
    console.log('⚠️  WARNING: This will modify your database schema!');
    
    // Copy new schema to main location
    copyFileSync(this.newSchemaPath, this.originalSchemaPath);

    try {
      // Generate and apply migration
      await execAsync(`npx prisma migrate dev --name ${this.config.migrationName}`);
      console.log('✅ Migration generated and applied successfully');

    } catch (error) {
      console.error('❌ Migration failed, restoring original schema...');
      await this.restoreOriginalSchema();
      throw error;
    }
  }

  private async restoreOriginalSchema(): Promise<void> {
    if (existsSync(this.backupSchemaPath)) {
      copyFileSync(this.backupSchemaPath, this.originalSchemaPath);
      console.log('🔄 Original schema restored');
    }
  }

  async cleanup(): Promise<void> {
    // Remove backup files if they exist
    if (existsSync(this.backupSchemaPath)) {
      require('fs').unlinkSync(this.backupSchemaPath);
      console.log('🧹 Cleanup: Removed backup schema');
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--apply');
  const skipValidation = args.includes('--skip-validation');

  const generator = new QueueMigrationGenerator({
    dryRun: isDryRun,
    validateSchema: !skipValidation
  });

  try {
    await generator.generateMigration();
    
    if (isDryRun) {
      console.log('');
      console.log('🎯 Next Steps:');
      console.log('   1. Review the generated migration SQL');
      console.log('   2. Test in development environment');
      console.log('   3. Run with --apply to generate actual migration');
      console.log('');
      console.log('💡 Commands:');
      console.log('   npm run migrate:queue:preview  # This command (dry run)');
      console.log('   npm run migrate:queue:apply    # Apply migration');
    }

  } catch (error) {
    console.error('Migration generation failed:', error);
    process.exit(1);
  } finally {
    if (isDryRun) {
      await generator.cleanup();
    }
  }
}

if (require.main === module) {
  main();
}

export { QueueMigrationGenerator }; 