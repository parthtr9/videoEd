/**
 * Full pipeline integration test: bg removal + color derivation → VideoProps.
 * Skipped unless INTEGRATION=true.
 * Run with: INTEGRATION=true npx jest buildVideoJob.integration
 */
import path from 'path';
import os from 'os';
import fs from 'fs';
import { buildVideoJob } from '../pipeline/buildVideoJob';
import { VideoPropsSchema } from '../schemas/videoProps';

const RUN = process.env['INTEGRATION'] === 'true';

(RUN ? describe : describe.skip)('buildVideoJob integration', () => {
  const FIXTURE = path.join(__dirname, 'fixtures', 'red_square.png');

  it('runs full pipeline: bg removal + color derivation → valid VideoProps', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'videoed-job-'));
    try {
      const { props, processedImagePath } = await buildVideoJob({
        productImagePath: FIXTURE,
        outputDir: outDir,
        brandColor: '#0066FF',
        headline: 'Integration Test Product',
        subheadline: 'Looks great automatically',
        template: 'Bold',
        aspectRatio: '16:9',
      });

      // Processed image exists and is non-empty
      expect(fs.existsSync(processedImagePath)).toBe(true);
      expect(fs.statSync(processedImagePath).size).toBeGreaterThan(100);

      // Props are valid
      expect(() => VideoPropsSchema.parse(props)).not.toThrow();

      // Correct file:// URL
      expect(props.productImageUrl).toBe(`file://${processedImagePath}`);

      // Palette was derived
      expect(props.palette).toBeDefined();
      expect(props.palette!.brand).toBe('#0066ff');

      // Template and ratio passed through
      expect(props.template).toBe('Bold');
      expect(props.aspectRatio).toBe('16:9');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }, 90_000);
});
