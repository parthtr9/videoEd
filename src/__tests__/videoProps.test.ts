import { VideoPropsSchema, ASPECT_RATIO_DIMENSIONS } from '../schemas/videoProps';

describe('VideoPropsSchema', () => {
  const validProps = {
    productImageUrl: 'https://example.com/product.png',
    brandColor: '#FF5500',
    headline: 'Buy This Now',
    template: 'Minimal',
    aspectRatio: '16:9',
  };

  it('accepts valid props', () => {
    expect(() => VideoPropsSchema.parse(validProps)).not.toThrow();
  });

  it('accepts all valid templates', () => {
    for (const template of ['Minimal', 'Bold', 'Luxury']) {
      expect(() => VideoPropsSchema.parse({ ...validProps, template })).not.toThrow();
    }
  });

  it('accepts all valid aspect ratios', () => {
    for (const aspectRatio of ['16:9', '9:16', '1:1']) {
      expect(() => VideoPropsSchema.parse({ ...validProps, aspectRatio })).not.toThrow();
    }
  });

  it('rejects invalid brandColor', () => {
    expect(() => VideoPropsSchema.parse({ ...validProps, brandColor: 'red' })).toThrow();
    expect(() => VideoPropsSchema.parse({ ...validProps, brandColor: '#FFF' })).toThrow();
    expect(() => VideoPropsSchema.parse({ ...validProps, brandColor: '#GGGGGG' })).toThrow();
  });

  it('rejects empty headline', () => {
    expect(() => VideoPropsSchema.parse({ ...validProps, headline: '' })).toThrow();
  });

  it('rejects headline over 80 chars', () => {
    expect(() => VideoPropsSchema.parse({ ...validProps, headline: 'A'.repeat(81) })).toThrow();
  });

  it('rejects invalid template', () => {
    expect(() => VideoPropsSchema.parse({ ...validProps, template: 'Fancy' })).toThrow();
  });

  it('rejects non-URL productImageUrl', () => {
    expect(() => VideoPropsSchema.parse({ ...validProps, productImageUrl: 'not-a-url' })).toThrow();
  });

  it('accepts optional fields when omitted', () => {
    const result = VideoPropsSchema.parse(validProps);
    expect(result.subheadline).toBeUndefined();
    expect(result.voiceoverScript).toBeUndefined();
    expect(result.palette).toBeUndefined();
  });
});

describe('ASPECT_RATIO_DIMENSIONS', () => {
  it('16:9 is 1920x1080', () => {
    expect(ASPECT_RATIO_DIMENSIONS['16:9']).toEqual({ width: 1920, height: 1080 });
  });

  it('9:16 is 1080x1920', () => {
    expect(ASPECT_RATIO_DIMENSIONS['9:16']).toEqual({ width: 1080, height: 1920 });
  });

  it('1:1 is 1080x1080', () => {
    expect(ASPECT_RATIO_DIMENSIONS['1:1']).toEqual({ width: 1080, height: 1080 });
  });
});
