import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import { env } from '@/lib/config/env';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: 'The Rollecito — Fresh-baked rolls, ordered online',
    template: '%s · The Rollecito',
  },
  description:
    'Order fresh-baked rolls online and pick them up at your nearest The Rollecito location.',
  openGraph: {
    siteName: 'The Rollecito',
    type: 'website',
    url: env.siteUrl,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
