/**
 * CLI unit tests. Tests arg parsing and orchestration logic.
 * buildVideoJob and child_process are mocked — no real rendering.
 */

jest.mock('../pipeline/buildVideoJob');
jest.mock('child_process');
jest.mock('fs');

import fs from 'fs';
import { execFile } from 'child_process';
import { buildVideoJob } from '../pipeline/buildVideoJob';

const mockBuildJob = buildVideoJob as jest.MockedFunction<typeof buildVideoJob>;
const mockExecFile = execFile as jest.MockedFunction<typeof execFile>;
const fsMock = fs as jest.Mocked<typeof fs>;

// Pull parseArgs out for isolated testing by re-importing the module internals.
// Since parseArgs isn't exported, we test it indirectly via arg validation behaviour.

const MOCK_JOB = {
  props: {
    productImageUrl: 'file:///fake/out/product_no_bg.png',
    brandColor: '#FF5500',
    headline: 'Buy Now',
    template: 'Minimal' as const,
    aspectRatio: '16:9' as const,
    palette: {
      brand: '#ff5500',
      accent: '#cc4400',
      backgroundLight: '#fff5f0',
      backgroundDark: '#1a0a00',
      textOnLight: '#1a0a00',
      textOnDark: '#fff5f0',
    },
  },
  processedImagePath: '/fake/out/product_no_bg.png',
  narrationPath: null,
};

describe('CLI arg parsing', () => {
  // We test via running main() with controlled process.argv

  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    jest.resetAllMocks();
    // Silence output in tests
    console.error = jest.fn();
    console.log = jest.fn();
    // Mock fs operations
    fsMock.mkdirSync = jest.fn();
    fsMock.copyFileSync = jest.fn();
    fsMock.statSync = jest.fn().mockReturnValue({ size: 1024 * 1024 * 2 });
    // Mock process.exit to prevent test runner from exiting
    process.exit = jest.fn() as any;
    mockBuildJob.mockResolvedValue(MOCK_JOB as any);
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback: any) => {
      if (callback) callback(null, '', '');
      return {} as any;
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  it('exits 1 and prints missing args when required flags absent', async () => {
    process.argv = ['node', 'cli.ts', '--image', './img.jpg'];
    // Dynamically import to get a fresh module execution
    jest.isolateModules(() => {
      require('../cli');
    });
    // Give async main() a tick to run
    await new Promise((r) => setTimeout(r, 10));
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Missing required args'),
    );
  });

  it('exits 0 when --help passed', async () => {
    process.argv = ['node', 'cli.ts', '--help'];
    jest.isolateModules(() => {
      require('../cli');
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});

describe('CLI orchestration', () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalConsoleLog = console.log;

  const FULL_ARGS = [
    'node', 'cli.ts',
    '--image', '/fake/product.jpg',
    '--brand', '#FF5500',
    '--headline', 'Buy Now',
    '--template', 'Minimal',
    '--ratio', '16:9',
    '--out', '/fake/out',
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    console.log = jest.fn();
    process.exit = jest.fn() as any;
    fsMock.mkdirSync = jest.fn();
    fsMock.copyFileSync = jest.fn();
    fsMock.statSync = jest.fn().mockReturnValue({ size: 1024 * 1024 * 2 });
    mockBuildJob.mockResolvedValue(MOCK_JOB as any);
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback: any) => {
      if (callback) callback(null, '', '');
      return {} as any;
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.log = originalConsoleLog;
  });

  it('calls buildVideoJob with correct args from CLI flags', async () => {
    process.argv = FULL_ARGS;
    await new Promise<void>((resolve) => {
      jest.isolateModules(() => {
        require('../cli');
        setTimeout(resolve, 50);
      });
    });
    expect(mockBuildJob).toHaveBeenCalledWith(
      expect.objectContaining({
        brandColor: '#FF5500',
        headline: 'Buy Now',
        template: 'Minimal',
        aspectRatio: '16:9',
      }),
    );
  });

  it('copies processed image into public/processed before render', async () => {
    process.argv = FULL_ARGS;
    await new Promise<void>((resolve) => {
      jest.isolateModules(() => {
        require('../cli');
        setTimeout(resolve, 50);
      });
    });
    expect(fsMock.copyFileSync).toHaveBeenCalledWith(
      MOCK_JOB.processedImagePath,
      expect.stringContaining('public/processed'),
    );
  });

  it('passes composition ID matching aspectRatio to remotion render', async () => {
    process.argv = FULL_ARGS;
    await new Promise<void>((resolve) => {
      jest.isolateModules(() => {
        require('../cli');
        setTimeout(resolve, 50);
      });
    });
    expect(mockExecFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(['ProductVideo-16x9']),
      expect.anything(),
      expect.any(Function),
    );
  });
});
