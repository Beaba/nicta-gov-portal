import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NICTA Internal Executive and Board Portal',
  description: 'NICTA internal SMC submission, AI template review, and Board reporting portal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
