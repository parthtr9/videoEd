import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VideoEd — Live Preview',
  description: 'Preview and submit product video render jobs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8f8f8' }}>{children}</body>
    </html>
  );
}
