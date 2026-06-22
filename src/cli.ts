import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { buildVideoJob } from './pipeline/buildVideoJob';
import { AspectRatio } from './schemas/videoProps';

const execFileAsync = promisify(execFile);

const REMOTION_BIN = path.join(__dirname, '../node_modules/.bin/remotion');
const PUBLIC_PROCESSED = path.join(__dirname, '../public/processed');

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const args: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

function usage(): void {
  console.log(`
VideoEd CLI — generate a branded product video

Usage:
  npx ts-node src/cli.ts [options]

Required:
  --image        Path to product image (JPEG or PNG)
  --brand        Brand color as 6-digit hex  e.g. "#FF5500"
  --headline     Headline text (max 80 chars)
  --template     Minimal | Bold | Luxury
  --ratio        16:9 | 9:16 | 1:1

Optional:
  --subheadline  Secondary text line (max 160 chars)
  --script       Voiceover narration script (max 500 chars)
  --out          Output directory (default: ./out)
  --lambda       Render on AWS Lambda instead of locally
  --help         Show this message
`);
}

async function renderLocal(job: Awaited<ReturnType<typeof buildVideoJob>>, outputDir: string): Promise<string> {
  fs.mkdirSync(PUBLIC_PROCESSED, { recursive: true });

  const imageFilename = path.basename(job.processedImagePath);
  fs.copyFileSync(job.processedImagePath, path.join(PUBLIC_PROCESSED, imageFilename));

  let publicNarrationUrl: string | undefined;
  if (job.narrationPath) {
    const narrationFilename = path.basename(job.narrationPath);
    fs.copyFileSync(job.narrationPath, path.join(PUBLIC_PROCESSED, narrationFilename));
    publicNarrationUrl = `/processed/${narrationFilename}`;
  }

  const renderProps = {
    ...job.props,
    productImageUrl: `/processed/${imageFilename}`,
    narrationUrl: publicNarrationUrl,
  };

  const ratio = job.props.aspectRatio as AspectRatio;
  const compositionId = `ProductVideo-${ratio.replace(':', 'x')}`;
  const outputFile = path.join(outputDir, `video_${ratio.replace(':', 'x')}.mp4`);

  try {
    await execFileAsync(
      REMOTION_BIN,
      ['render', 'src/index.ts', compositionId, outputFile, `--props=${JSON.stringify(renderProps)}`],
      { cwd: path.join(__dirname, '..') },
    );
  } catch (err: unknown) {
    const stderr = (err as { stderr?: string }).stderr ?? '';
    const msg = stderr.trim() || (err instanceof Error ? err.message : String(err));
    throw new Error(`Remotion render failed — ${msg}`);
  }

  return outputFile;
}

async function renderLambda(job: Awaited<ReturnType<typeof buildVideoJob>>): Promise<string> {
  const { renderJobOnLambda } = await import('./lambda/renderOnLambda');
  return renderJobOnLambda(job);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args['help']) {
    usage();
    process.exit(0);
  }

  const missing = ['image', 'brand', 'headline', 'template', 'ratio'].filter(
    (k) => !args[k],
  );
  if (missing.length > 0) {
    console.error(`Missing required args: ${missing.map((k) => `--${k}`).join(', ')}`);
    usage();
    process.exit(1);
  }

  const useLambda = args['lambda'] === 'true';
  const outputDir = path.resolve(args['out'] ?? './out');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('[1/3] Processing image and deriving palette...');

  const job = await buildVideoJob({
    productImagePath: path.resolve(args['image']!),
    outputDir,
    brandColor: args['brand']!,
    headline: args['headline']!,
    subheadline: args['subheadline'],
    voiceoverScript: args['script'],
    template: args['template']!,
    aspectRatio: args['ratio']!,
  });

  console.log(`[2/3] Rendering (${useLambda ? 'Lambda' : 'local'})...`);
  const output = useLambda ? await renderLambda(job) : await renderLocal(job, outputDir);

  console.log('[3/3] Done.');
  console.log(`Output: ${output}`);
  if (!useLambda) {
    console.log(`Size:   ${(fs.statSync(output).size / 1024 / 1024).toFixed(1)} MB`);
  }
}

main().catch((err: Error) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
