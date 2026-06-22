'use client';

import React, { useState } from 'react';
import { VideoPreview } from './components/VideoPreview';
import { ASPECT_RATIO_DIMENSIONS } from '../src/schemas/videoProps';
import { derivePalette } from '../src/pipeline/colorDerivation';
import type { Template, AspectRatio } from '../src/schemas/videoProps';

const LABEL: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 4 };
const INPUT: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };

export default function HomePage() {
  const [brandColor, setBrandColor] = useState('#FF5500');
  const [headline, setHeadline] = useState('Your Product');
  const [subheadline, setSubheadline] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [template, setTemplate] = useState<Template>('Minimal');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [submitting, setSubmitting] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(brandColor);
  const palette = isValidHex ? derivePalette(brandColor) : derivePalette('#FF5500');
  const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setMessageId(null);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImagePath: productImageUrl || '/tmp/placeholder.png',
          outputDir: '/tmp/videoed-out',
          brandColor,
          headline,
          subheadline: subheadline || undefined,
          template,
          aspectRatio,
        }),
      });
      const data = await res.json() as { messageId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMessageId(data.messageId ?? null);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ display: 'flex', gap: 32, padding: 32, fontFamily: 'system-ui, sans-serif', minHeight: '100vh', maxWidth: 1400, margin: '0 auto' }}>
      {/* Form */}
      <section style={{ width: 340, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, marginTop: 0 }}>VideoEd</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            <span style={LABEL}>Product Image URL</span>
            <input style={INPUT} type="url" value={productImageUrl} onChange={e => setProductImageUrl(e.target.value)} placeholder="https://..." />
          </label>
          <label>
            <span style={LABEL}>Brand Color</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={isValidHex ? brandColor : '#FF5500'} onChange={e => setBrandColor(e.target.value)} style={{ width: 44, height: 36, border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4 }} />
              <input style={{ ...INPUT, flex: 1 }} type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} placeholder="#FF5500" />
            </div>
            {!isValidHex && <span style={{ fontSize: 12, color: '#c00' }}>Must be 6-digit hex (#RRGGBB)</span>}
          </label>
          <label>
            <span style={LABEL}>Headline <span style={{ color: '#999', fontWeight: 400 }}>(max 80 chars)</span></span>
            <input style={INPUT} type="text" value={headline} onChange={e => setHeadline(e.target.value)} maxLength={80} required />
          </label>
          <label>
            <span style={LABEL}>Subheadline <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></span>
            <input style={INPUT} type="text" value={subheadline} onChange={e => setSubheadline(e.target.value)} maxLength={160} />
          </label>
          <label>
            <span style={LABEL}>Template</span>
            <select style={INPUT} value={template} onChange={e => setTemplate(e.target.value as Template)}>
              <option value="Minimal">Minimal</option>
              <option value="Bold">Bold</option>
              <option value="Luxury">Luxury</option>
            </select>
          </label>
          <label>
            <span style={LABEL}>Aspect Ratio</span>
            <select style={INPUT} value={aspectRatio} onChange={e => setAspectRatio(e.target.value as AspectRatio)}>
              <option value="16:9">16:9 — Landscape</option>
              <option value="9:16">9:16 — Portrait / Reel</option>
              <option value="1:1">1:1 — Square</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={submitting || !headline || !isValidHex}
            style={{ marginTop: 8, padding: '10px 20px', backgroundColor: isValidHex ? brandColor : '#ccc', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', fontSize: 15 }}
          >
            {submitting ? 'Submitting…' : 'Submit Render Job'}
          </button>
          {messageId && (
            <div style={{ padding: 12, background: '#f0fff4', border: '1px solid #b2f5c8', borderRadius: 6, fontSize: 13 }}>
              Job queued. ID: <code>{messageId}</code>
            </div>
          )}
          {submitError && (
            <div style={{ padding: 12, background: '#fff5f5', border: '1px solid #fcc', borderRadius: 6, fontSize: 13, color: '#c00' }}>
              {submitError}
            </div>
          )}
        </form>
      </section>

      {/* Preview */}
      <section style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 16 }}>Live preview — updates as you type. No render triggered.</p>
        <VideoPreview
          props={{
            productImageUrl: productImageUrl || 'https://placehold.co/400x400/e0e0e0/999999?text=Product',
            brandColor,
            headline,
            subheadline: subheadline || undefined,
            template,
            aspectRatio,
            palette,
          }}
          width={dims.width}
          height={dims.height}
        />
      </section>
    </main>
  );
}
