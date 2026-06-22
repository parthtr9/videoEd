/**
 * Sets up cost monitoring for VideoEd:
 *   1. SNS topic for alert emails
 *   2. CloudWatch billing alarm — fires when estimated monthly AWS spend > $BILLING_THRESHOLD
 *   3. CloudWatch Lambda alarm — fires when Lambda invocations exceed LAMBDA_ALARM_COUNT in an hour
 *
 * Billing metrics only exist in us-east-1 regardless of where your resources live.
 * Lambda invocation metrics are created in your configured AWS_REGION.
 *
 * Run: npx ts-node scripts/setup_cost_monitoring.ts
 * Env required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 * Optional: ALERT_EMAIL (default: parthtttrivedi@gmail.com)
 *           BILLING_THRESHOLD_USD (default: 10)
 *           LAMBDA_INVOCATION_ALARM_COUNT (default: 500 per hour)
 */
import 'dotenv/config';
import {
  CloudWatchClient,
  PutMetricAlarmCommand,
  ComparisonOperator,
  Statistic,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import {
  SNSClient,
  CreateTopicCommand,
  SubscribeCommand,
  ListSubscriptionsByTopicCommand,
} from '@aws-sdk/client-sns';

const REGION = process.env['AWS_REGION'] ?? 'us-east-1';
const BILLING_REGION = 'us-east-1'; // billing metrics only published here
const ALERT_EMAIL = process.env['ALERT_EMAIL'] ?? 'parthtttrivedi@gmail.com';
const BILLING_THRESHOLD = parseFloat(process.env['BILLING_THRESHOLD_USD'] ?? '10');
const LAMBDA_ALARM_COUNT = parseInt(process.env['LAMBDA_INVOCATION_ALARM_COUNT'] ?? '500', 10);
const SNS_TOPIC_NAME = 'videoed-cost-alerts';

async function getOrCreateTopic(sns: SNSClient): Promise<string> {
  const res = await sns.send(new CreateTopicCommand({ Name: SNS_TOPIC_NAME }));
  const arn = res.TopicArn!;
  console.log(`SNS topic: ${arn}`);
  return arn;
}

async function ensureEmailSubscription(sns: SNSClient, topicArn: string): Promise<void> {
  // Check if subscription already exists to avoid duplicates
  const existing = await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }));
  const already = existing.Subscriptions?.some(
    s => s.Protocol === 'email' && s.Endpoint === ALERT_EMAIL,
  );
  if (already) {
    console.log(`Email ${ALERT_EMAIL} already subscribed.`);
    return;
  }
  await sns.send(new SubscribeCommand({ TopicArn: topicArn, Protocol: 'email', Endpoint: ALERT_EMAIL }));
  console.log(`Subscribed ${ALERT_EMAIL}. Check your email to confirm the subscription.`);
}

async function createBillingAlarm(topicArn: string): Promise<void> {
  // Billing alarms must live in us-east-1 — that's where AWS publishes billing metrics
  const cw = new CloudWatchClient({ region: BILLING_REGION });
  await cw.send(new PutMetricAlarmCommand({
    AlarmName: 'videoed-estimated-charges',
    AlarmDescription: `VideoEd: estimated AWS charges exceed $${BILLING_THRESHOLD}`,
    Namespace: 'AWS/Billing',
    MetricName: 'EstimatedCharges',
    Dimensions: [{ Name: 'Currency', Value: 'USD' }],
    Statistic: Statistic.Maximum,
    Period: 86400,        // 1 day — billing metrics update daily
    EvaluationPeriods: 1,
    Threshold: BILLING_THRESHOLD,
    ComparisonOperator: ComparisonOperator.GreaterThanOrEqualToThreshold,
    AlarmActions: [topicArn],
    OKActions: [topicArn],
    TreatMissingData: 'notBreaching',
  }));
  console.log(`Billing alarm set: alert if estimated charges >= $${BILLING_THRESHOLD}/month`);
}

async function createLambdaInvocationAlarm(topicArn: string): Promise<void> {
  const cw = new CloudWatchClient({ region: REGION });
  await cw.send(new PutMetricAlarmCommand({
    AlarmName: 'videoed-lambda-invocations-high',
    AlarmDescription: `VideoEd: Lambda invocations exceeded ${LAMBDA_ALARM_COUNT} in 1 hour`,
    Namespace: 'AWS/Lambda',
    MetricName: 'Invocations',
    // No FunctionName dimension — catches ALL Lambda invocations in account
    Statistic: Statistic.Sum,
    Period: 3600,         // 1 hour window
    EvaluationPeriods: 1,
    Threshold: LAMBDA_ALARM_COUNT,
    ComparisonOperator: ComparisonOperator.GreaterThanOrEqualToThreshold,
    AlarmActions: [topicArn],
    TreatMissingData: 'notBreaching',
  }));
  console.log(`Lambda alarm set: alert if invocations >= ${LAMBDA_ALARM_COUNT}/hour`);
}

async function main(): Promise<void> {
  console.log(`Setting up cost monitoring. Alert email: ${ALERT_EMAIL}\n`);

  const sns = new SNSClient({ region: BILLING_REGION }); // SNS topic in us-east-1 alongside billing alarm
  const topicArn = await getOrCreateTopic(sns);
  await ensureEmailSubscription(sns, topicArn);
  await createBillingAlarm(topicArn);
  await createLambdaInvocationAlarm(topicArn);

  console.log('\nCost monitoring active.');
  console.log(`Billing threshold: $${BILLING_THRESHOLD} (env: BILLING_THRESHOLD_USD)`);
  console.log(`Lambda alarm: ${LAMBDA_ALARM_COUNT} invocations/hour (env: LAMBDA_INVOCATION_ALARM_COUNT)`);
  console.log('Alerts → SNS → email. Confirm the subscription email before alarms can fire.');
}

main().catch((err: Error) => {
  console.error(`Setup failed: ${err.message}`);
  process.exit(1);
});
