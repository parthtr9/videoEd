import path from 'path';
import fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

const { execFile } = require('child_process') as jest.Mocked<typeof import('child_process')>;
const fsMock = fs as jest.Mocked<typeof fs>;

import { removeBackground } from '../pipeline/backgroundRemoval';

describe('removeBackground (unit, mocked)', () => {
  const INPUT = '/fake/product.jpg';
  const OUTPUT = '/fake/out/product.png';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws Zod error if inputPath is empty', async () => {
    await expect(removeBackground({ inputPath: '', outputPath: OUTPUT })).rejects.toThrow();
  });

  it('throws Zod error if outputPath is empty', async () => {
    await expect(removeBackground({ inputPath: INPUT, outputPath: '' })).rejects.toThrow();
  });

  it('throws if input file does not exist', async () => {
    fsMock.existsSync.mockReturnValue(false);
    await expect(removeBackground({ inputPath: INPUT, outputPath: OUTPUT }))
      .rejects.toThrow('input file not found');
  });

  it('throws with stderr message if python3 exits non-zero', async () => {
    fsMock.existsSync.mockReturnValueOnce(true);
    execFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(Object.assign(new Error('exit 1'), { stderr: 'rembg processing failed: some error' }));
      return {} as any;
    });
    await expect(removeBackground({ inputPath: INPUT, outputPath: OUTPUT }))
      .rejects.toThrow('rembg processing failed');
  });

  it('throws if output file not created after successful python3 run', async () => {
    fsMock.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    execFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(null, '', '');
      return {} as any;
    });
    await expect(removeBackground({ inputPath: INPUT, outputPath: OUTPUT }))
      .rejects.toThrow('output file was not created');
  });

  it('returns outputPath on success', async () => {
    fsMock.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    execFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(null, OUTPUT, '');
      return {} as any;
    });
    const result = await removeBackground({ inputPath: INPUT, outputPath: OUTPUT });
    expect(result).toBe(OUTPUT);
  });

  it('calls python3 with the rembg script, inputPath, and outputPath', async () => {
    fsMock.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    execFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(null, OUTPUT, '');
      return {} as any;
    });
    await removeBackground({ inputPath: INPUT, outputPath: OUTPUT });
    expect(execFile).toHaveBeenCalledTimes(1);
    const call = execFile.mock.calls[0];
    expect(call).toBeDefined();
    const [cmd, args] = call!;
    expect(cmd).toBe('python3');
    expect(args![0]).toMatch(/remove_bg\.py$/);
    expect(args![1]).toBe(INPUT);
    expect(args![2]).toBe(OUTPUT);
  });
});
