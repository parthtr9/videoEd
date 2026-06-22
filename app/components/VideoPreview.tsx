'use client';

import { Player } from '@remotion/player';
import { ProductVideo } from '../../src/compositions/ProductVideo';
import type { VideoProps } from '../../src/schemas/videoProps';

type Props = {
  props: VideoProps & { palette: NonNullable<VideoProps['palette']> };
  width: number;
  height: number;
};

export function VideoPreview({ props, width, height }: Props) {
  const maxWidth = 760;
  const scale = Math.min(1, maxWidth / width);
  const displayWidth = Math.round(width * scale);
  const displayHeight = Math.round(height * scale);

  return (
    <div style={{ width: displayWidth, height: displayHeight }}>
      <Player
        component={ProductVideo}
        inputProps={props}
        durationInFrames={150}
        compositionWidth={width}
        compositionHeight={height}
        fps={30}
        style={{ width: displayWidth, height: displayHeight }}
        controls
      />
    </div>
  );
}
