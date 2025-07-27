#!/usr/bin/env tsx

/**
 * Queue Migration Setup Test
 * 
 * This script validates that the queue migration setup is working correctly
 * before proceeding with the actual migration.
 */

import { 
  QUEUE_MIGRATION_FLAGS, 
  getCurrentMigrationPhase, 
  validateMigrationFlags,
  logFeatureFlagStatus,
  getEnvironmentConfig 
} from '../lib/config/features';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

class QueueMigrationSetupTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Queue Migration Setup Tests');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Test 1: Feature flag validation
    await this.testFeatureFlags();

    // Test 2: Migration phase detection
    await this.testMigrationPhases();

    // Test 3: Environment configuration
    await this.testEnvironmentConfig();

    // Test 4: Schema file existence
    await this.testSchemaFiles();

    // Test 5: Migration script existence
    await this.testMigrationScripts();

    // Summary
    this.printSummary();
  }

  private async testFeatureFlags(): Promise<void> {
    const testName = 'Feature Flag Validation';
    
    try {
      const validation = validateMigrationFlags();
      
      if (validation.isValid) {
        this.addResult(testName, true, 'All feature flags are valid', {
          warnings: validation.warnings
        });
      } else {
        this.addResult(testName, false, 'Feature flag validation failed', {
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
    } catch (error) {
      this.addResult(testName, false, `Feature flag test failed: ${error}`);
    }
  }

  private async testMigrationPhases(): Promise<void> {
    const testName = 'Migration Phase Detection';
    
    try {
      const currentPhase = getCurrentMigrationPhase();
      const expectedPhase = 'pre-migration'; // Should be pre-migration initially
      
      if (currentPhase === expectedPhase) {
        this.addResult(testName, true, `Correctly detected phase: ${currentPhase}`);
      } else {
        this.addResult(testName, false, `Expected '${expectedPhase}', got '${currentPhase}'`);
      }
    } catch (error) {
      this.addResult(testName, false, `Migration phase test failed: ${error}`);
    }
  }

  private async testEnvironmentConfig(): Promise<void> {
    const testName = 'Environment Configuration';
    
    try {
      const config = getEnvironmentConfig();
      
      if (config.environment && config.migrationPhase && config.safetyChecks) {
        this.addResult(testName, true, `Environment config loaded for ${config.environment}`, {
          environment: config.environment,
          phase: config.migrationPhase,
          safetyChecks: config.safetyChecks.length
        });
      } else {
        this.addResult(testName, false, 'Environment configuration incomplete');
      }
    } catch (error) {
      this.addResult(testName, false, `Environment config test failed: ${error}`);
    }
  }

  private async testSchemaFiles(): Promise<void> {
    const testName = 'Schema Files';
    const fs = require('fs');
    const path = require('path');
    
    try {
      const originalSchema = path.join(process.cwd(), 'prisma/schema.prisma');
      const newSchema = path.join(process.cwd(), 'prisma/schema-new-queues.prisma');
      
      const files = [
        { path: originalSchema, name: 'Original schema' },
        { path: newSchema, name: 'New queues schema' }
      ];
      
      const missing = files.filter(file => !fs.existsSync(file.path));
      
      if (missing.length === 0) {
        this.addResult(testName, true, 'All schema files exist');
      } else {
        this.addResult(testName, false, 'Missing schema files', {
          missing: missing.map(f => f.name)
        });
      }
    } catch (error) {
      this.addResult(testName, false, `Schema files test failed: ${error}`);
    }
  }

  private async testMigrationScripts(): Promise<void> {
    const testName = 'Migration Scripts';
    const fs = require('fs');
    const path = require('path');
    
    try {
      const scripts = [
        'scripts/generate-queue-migration.ts',
        'scripts/add-queue-constraints.sql',
        'scripts/test-queue-migration-setup.ts'
      ];
      
      const missing = scripts.filter(script => 
        !fs.existsSync(path.join(process.cwd(), script))
      );
      
      if (missing.length === 0) {
        this.addResult(testName, true, 'All migration scripts exist');
      } else {
        this.addResult(testName, false, 'Missing migration scripts', {
          missing
        });
      }
    } catch (error) {
      this.addResult(testName, false, `Migration scripts test failed: ${error}`);
    }
  }

  private addResult(testName: string, passed: boolean, message: string, details?: any): void {
    this.results.push({ testName, passed, message, details });
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${testName}: ${message}`);
    
    if (details) {
      console.log(`   📋 Details:`, details);
    }
    console.log('');
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = total - passed;
    
    console.log('📊 Test Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log('');
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Queue migration setup is ready.');
      console.log('');
      console.log('🎯 Next Steps:');
      console.log('   1. Run: npm run migrate:queue:preview');
      console.log('   2. Review generated migration SQL');
      console.log('   3. Test in development environment');
      console.log('   4. Proceed with Phase 1 implementation');
    } else {
      console.log('⚠️  Some tests failed. Please fix the issues before proceeding.');
      console.log('');
      console.log('Failed tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`   • ${r.testName}: ${r.message}`));
    }
    
    console.log('');
    console.log('📋 Current Feature Flag Status:');
    logFeatureFlagStatus();
  }
}

// CLI execution
async function main() {
  const tester = new QueueMigrationSetupTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { QueueMigrationSetupTester }; 