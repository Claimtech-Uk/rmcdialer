import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class RMCDiallerCronStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Lambda function to handle all cron job triggers
    const cronHandler = new lambda.Function(this, 'CronHandler', {
      functionName: 'rmc-dialler-cron-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        AMPLIFY_URL: process.env.AMPLIFY_URL || 'https://your-amplify-domain.amplifyapp.com',
        CRON_SECRET: process.env.CRON_SECRET || 'your-cron-secret',
        NODE_ENV: 'production'
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      code: lambda.Code.fromInlineCode(`
const https = require('https');
const { URL } = require('url');

exports.handler = async (event) => {
  const { path } = event;
  const baseUrl = process.env.AMPLIFY_URL;
  
  console.log(\`🔄 [AWS-CRON] Executing: \${path}\`);
  
  try {
    const result = await makeHttpRequest(baseUrl + path);
    console.log(\`✅ [AWS-CRON] Completed: \${path}\`, { 
      status: result.statusCode,
      duration: result.duration 
    });
    return result;
  } catch (error) {
    console.error(\`❌ [AWS-CRON] Failed: \${path}\`, error);
    throw error;
  }
};

function makeHttpRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': \`Bearer \${process.env.CRON_SECRET}\`,
        'User-Agent': 'AWS-EventBridge-Cron/1.0',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({ 
          statusCode: res.statusCode, 
          body: data,
          duration: duration + 'ms'
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      reject({ error: error.message, duration: duration + 'ms' });
    });

    req.setTimeout(295000, () => { // 4m 55s timeout
      req.destroy();
      reject(new Error('Request timeout after 295 seconds'));
    });

    req.end();
  });
}
      `)
    });

    // Define all your cron jobs with AWS EventBridge schedule expressions
    const cronJobs = [
      { name: 'QueueLevelCheck', path: '/api/cron/queue-level-check', schedule: 'rate(5 minutes)' },
      { name: 'SignatureConversionCleanup', path: '/api/cron/signature-conversion-cleanup', schedule: 'cron(0 * * * ? *)' },
      { name: 'SmartNewUsersDiscovery', path: '/api/cron/smart-new-users-discovery', schedule: 'cron(5 * * * ? *)' },
      { name: 'OutstandingRequirementsCleanup', path: '/api/cron/outstanding-requirements-conversion-cleanup', schedule: 'cron(10 * * * ? *)' },
      { name: 'DiscoverNewRequirements', path: '/api/cron/discover-new-requirements', schedule: 'cron(15 * * * ? *)' },
      { name: 'ScoringMaintenance', path: '/api/cron/scoring-maintenance', schedule: 'cron(20 * * * ? *)' },
      { name: 'ConversionAgentAttribution', path: '/api/cron/conversion-agent-attribution', schedule: 'cron(25 * * * ? *)' },
      { name: 'PopulateSeparatedQueues', path: '/api/cron/populate-separated-queues', schedule: 'cron(30 * * * ? *)' },
      { name: 'DailyCleanup', path: '/api/cron/daily-cleanup', schedule: 'cron(0 2 * * ? *)' },
      { name: 'SessionCleanup', path: '/api/cron/session-cleanup', schedule: 'rate(5 minutes)' },
      { name: 'HeartbeatCleanup', path: '/api/cron/heartbeat-cleanup', schedule: 'rate(1 minute)' },
      { name: 'QueueCleanup', path: '/api/cron/queue-cleanup', schedule: 'rate(2 minutes)' },
      { name: 'SmsFollowups', path: '/api/cron/sms-followups', schedule: 'rate(5 minutes)' },
      { name: 'ProcessSmsBatches', path: '/api/cron/process-sms-batches', schedule: 'rate(1 minute)' },
      { name: 'WeeklyScoreAging', path: '/api/cron/weekly-score-aging', schedule: 'cron(1 0 ? * SUN *)' },
      { name: 'ProcessTranscriptions', path: '/api/cron/process-transcriptions', schedule: 'rate(1 minute)' }
    ];

    // Create EventBridge rules and Lambda triggers
    cronJobs.forEach((job) => {
      const rule = new events.Rule(this, \`CronRule\${job.name}\`, {
        ruleName: \`rmc-dialler-\${job.name.toLowerCase()}\`,
        description: \`RMC Dialler cron job: \${job.path}\`,
        schedule: events.Schedule.expression(job.schedule),
        enabled: true
      });

      rule.addTarget(new targets.LambdaFunction(cronHandler, {
        event: events.RuleTargetInput.fromObject({
          path: job.path,
          jobName: job.name,
          schedule: job.schedule,
          source: 'aws-eventbridge'
        })
      }));

      // Create CloudWatch alarm for failed executions
      const errorAlarm = cronHandler.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5)
      }).createAlarm(this, \`CronErrorAlarm\${job.name}\`, {
        alarmName: \`rmc-dialler-cron-errors-\${job.name.toLowerCase()}\`,
        threshold: 3,
        evaluationPeriods: 1,
        treatMissingData: cdk.CloudWatchTreatMissingData.NOT_BREACHING
      });
    });

    // Output the Lambda function ARN for reference
    new cdk.CfnOutput(this, 'CronHandlerArn', {
      value: cronHandler.functionArn,
      description: 'ARN of the cron handler Lambda function'
    });

    // Output EventBridge rule count
    new cdk.CfnOutput(this, 'CronJobCount', {
      value: cronJobs.length.toString(),
      description: 'Number of cron jobs migrated to EventBridge'
    });
  }
}
