/**
 * Creates the remotion-lambda-role IAM role that Remotion's deployFunction needs.
 * Safe to re-run — skips creation if role already exists, updates policy either way.
 * Run: npx ts-node scripts/setup_lambda_role.ts
 */
import 'dotenv/config';
import {
  IAMClient,
  CreateRoleCommand,
  PutRolePolicyCommand,
  GetRoleCommand,
  NoSuchEntityException,
} from '@aws-sdk/client-iam';

const ROLE_NAME = 'remotion-lambda-role';

const TRUST_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'lambda.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ],
});

const INLINE_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '0',
      Effect: 'Allow',
      Action: ['s3:ListAllMyBuckets'],
      Resource: ['*'],
    },
    {
      Sid: '1',
      Effect: 'Allow',
      Action: [
        's3:CreateBucket', 's3:ListBucket', 's3:PutBucketAcl',
        's3:GetObject', 's3:DeleteObject', 's3:PutObjectAcl',
        's3:PutObject', 's3:GetBucketLocation',
      ],
      Resource: ['arn:aws:s3:::remotionlambda-*'],
    },
    {
      Sid: '2',
      Effect: 'Allow',
      Action: ['lambda:InvokeFunction'],
      Resource: ['arn:aws:lambda:*:*:function:remotion-render-*'],
    },
    {
      Sid: '3',
      Effect: 'Allow',
      Action: ['logs:CreateLogGroup'],
      Resource: ['arn:aws:logs:*:*:log-group:/aws/lambda-insights'],
    },
    {
      Sid: '4',
      Effect: 'Allow',
      Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      Resource: [
        'arn:aws:logs:*:*:log-group:/aws/lambda/remotion-render-*',
        'arn:aws:logs:*:*:log-group:/aws/lambda-insights:*',
      ],
    },
  ],
});

async function main(): Promise<void> {
  const client = new IAMClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });

  // Create role if it doesn't exist
  try {
    await client.send(new GetRoleCommand({ RoleName: ROLE_NAME }));
    console.log(`Role "${ROLE_NAME}" already exists — skipping creation.`);
  } catch (err) {
    if (err instanceof NoSuchEntityException) {
      console.log(`Creating role "${ROLE_NAME}"...`);
      await client.send(
        new CreateRoleCommand({
          RoleName: ROLE_NAME,
          AssumeRolePolicyDocument: TRUST_POLICY,
          Description: 'Execution role for Remotion Lambda renders',
        }),
      );
      console.log('Role created.');
    } else {
      throw err;
    }
  }

  // Always put (upsert) the inline policy
  console.log('Attaching inline policy...');
  await client.send(
    new PutRolePolicyCommand({
      RoleName: ROLE_NAME,
      PolicyName: 'remotion-lambda-policy',
      PolicyDocument: INLINE_POLICY,
    }),
  );

  console.log(`\nDone. "${ROLE_NAME}" is ready.`);
  console.log('Wait ~10 seconds for IAM to propagate, then run: npm run lambda:deploy');
}

main().catch((err: Error) => {
  console.error(`Setup failed: ${err.message}`);
  process.exit(1);
});
