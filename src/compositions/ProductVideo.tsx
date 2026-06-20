import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { VideoProps } from '../schemas/videoProps';

type Props = VideoProps & {
  palette: NonNullable<VideoProps['palette']>;
};

export const ProductVideo: React.FC<Props> = ({
  productImageUrl,
  headline,
  subheadline,
  template,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineOpacity = spring({ frame, fps, from: 0, to: 1, delay: 10, config: { damping: 20 } });
  const imageScale = spring({ frame, fps, from: 0.85, to: 1, config: { damping: 18 } });

  const bgColor = template === 'Bold' ? palette.backgroundDark : palette.backgroundLight;
  const textColor = template === 'Bold' ? palette.textOnDark : palette.textOnLight;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ transform: `scale(${imageScale})`, marginBottom: 40, maxWidth: '60%', maxHeight: '55%' }}>
        <img
          src={productImageUrl}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      <h1 style={{
        color: textColor,
        fontFamily: template === 'Luxury' ? 'Georgia, serif' : 'system-ui, sans-serif',
        fontSize: 64,
        fontWeight: template === 'Bold' ? 900 : 600,
        textAlign: 'center',
        opacity: headlineOpacity,
        margin: 0,
        letterSpacing: template === 'Luxury' ? '0.05em' : 'normal',
      }}>
        {headline}
      </h1>
      {subheadline && (
        <p style={{
          color: textColor,
          fontFamily: template === 'Luxury' ? 'Georgia, serif' : 'system-ui, sans-serif',
          fontSize: 32,
          fontWeight: 400,
          textAlign: 'center',
          opacity: interpolate(frame, [25, 45], [0, 0.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          marginTop: 20,
        }}>
          {subheadline}
        </p>
      )}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 8,
        backgroundColor: palette.brand,
      }} />
    </AbsoluteFill>
  );
};
