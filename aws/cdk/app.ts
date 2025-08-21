#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RMCDiallerCronStack } from './cron-migration-stack';

const app = new cdk.App();

new RMCDiallerCronStack(app, 'RMCDiallerCronStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'RMC Dialler Cron Jobs Migration - Vercel to AWS EventBridge',
  tags: {
    Project: 'RMC-Dialler',
    Environment: 'Production',
    Service: 'CronJobs'
  }
});
