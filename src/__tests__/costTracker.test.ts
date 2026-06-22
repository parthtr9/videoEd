import { estimateRenderCost, logRenderCost } from '../monitoring/costTracker';

describe('estimateRenderCost', () => {
  it('returns zero lambda cost for zero-second render', () => {
    const estimate = estimateRenderCost(0);
    expect(estimate.lambdaUsd).toBe(0);
    expect(estimate.durationSeconds).toBe(0);
  });

  it('returns correct lambda cost for 30-second render', () => {
    // 30s × 2 GB × $0.0000166667/GB-s = $0.001000002 ≈ $0.000001 precision
    const estimate = estimateRenderCost(30);
    expect(estimate.lambdaUsd).toBeCloseTo(0.001, 4);
    expect(estimate.durationSeconds).toBe(30);
  });

  it('always includes fixed S3 cost', () => {
    const estimate = estimateRenderCost(10);
    expect(estimate.s3Usd).toBeGreaterThan(0);
  });

  it('totalUsd equals lambdaUsd + s3Usd', () => {
    const estimate = estimateRenderCost(60);
    expect(estimate.totalUsd).toBeCloseTo(estimate.lambdaUsd + estimate.s3Usd, 6);
  });

  it('longer render costs more', () => {
    const short = estimateRenderCost(10);
    const long = estimateRenderCost(60);
    expect(long.lambdaUsd).toBeGreaterThan(short.lambdaUsd);
    expect(long.totalUsd).toBeGreaterThan(short.totalUsd);
  });

  it('throws on negative duration', () => {
    expect(() => estimateRenderCost(-1)).toThrow('durationSeconds must be >= 0');
  });

  it('all values rounded to 6 decimal places', () => {
    const estimate = estimateRenderCost(7);
    const decimalPlaces = (n: number) => (n.toString().split('.')[1] ?? '').length;
    expect(decimalPlaces(estimate.lambdaUsd)).toBeLessThanOrEqual(6);
    expect(decimalPlaces(estimate.s3Usd)).toBeLessThanOrEqual(6);
    expect(decimalPlaces(estimate.totalUsd)).toBeLessThanOrEqual(6);
  });
});

describe('logRenderCost', () => {
  it('logs to console without throwing', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => logRenderCost('render-123', estimateRenderCost(30))).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('log output includes job ID and cost fields', () => {
    let logged = '';
    jest.spyOn(console, 'log').mockImplementation(msg => { logged = msg as string; });
    logRenderCost('render-abc', estimateRenderCost(30));
    jest.restoreAllMocks();
    expect(logged).toContain('render-abc');
    expect(logged).toContain('lambda=');
    expect(logged).toContain('total=');
  });
});
