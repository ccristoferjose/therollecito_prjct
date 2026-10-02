'use client';

import SiteFooter from '@/components/layout/site-footer';
import SiteHeader from '@/components/layout/site-header';
import SkipLink from '@/components/layout/skip-link';
import { useLang } from '@/providers/lang-provider';

export default function ClientChrome({ children }: { children: React.ReactNode }) {
  const { t } = useLang();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink label={t.a11y.skipToContent} />
      <SiteHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
