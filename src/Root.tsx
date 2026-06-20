import React from 'react';
import { Composition } from 'remotion';
import { ProductVideo } from './compositions/ProductVideo';
import { ASPECT_RATIO_DIMENSIONS } from './schemas/videoProps';
import { derivePalette } from './pipeline/colorDerivation';

const DEFAULT_BRAND = '#0066FF';

const DEFAULT_PROPS = {
  productImageUrl: 'https://via.placeholder.com/600x600.png?text=Product',
  brandColor: DEFAULT_BRAND,
  headline: 'Your Product Here',
  subheadline: 'A great tagline goes here.',
  template: 'Minimal' as const,
  aspectRatio: '16:9' as const,
  palette: derivePalette(DEFAULT_BRAND),
};

export const Root: React.FC = () => {
  return (
    <>
      {(['16:9', '9:16', '1:1'] as const).map((ratio) => {
        const { width, height } = ASPECT_RATIO_DIMENSIONS[ratio];
        return (
          <Composition
            key={ratio}
            id={`ProductVideo-${ratio.replace(':', 'x')}`}
            component={ProductVideo}
            durationInFrames={150}
            fps={30}
            width={width}
            height={height}
            defaultProps={{ ...DEFAULT_PROPS, aspectRatio: ratio }}
          />
        );
      })}
    </>
  );
};
