import Link from 'next/link';
import { LangProvider } from '@/providers/lang-provider';
import SiteFooter from '@/components/layout/site-footer';

/**
 * PUBLIC marketing layout — Server Component. SEO-focused chrome (header/footer)
 * shared by the indexable marketing pages. Exposes only client-facing actions
 * (browse + order); no staff/admin entry points here.
 *
 * The footer is the SAME component the ordering pages use. It previously had a
 * one-line placeholder here, so home and /locations showed nothing like the
 * real footer. SiteFooter is a Client Component (its copy is translated), hence
 * the LangProvider — scoped to the footer alone so the page content above it
 * stays fully server-rendered for SEO.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-extrabold text-primary">
            The Rollecito
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium text-text">
            <Link href="/locations" className="hover:text-primary">Locations</Link>
            <Link
              href="/order"
              className="rounded-full bg-accent px-4 py-2 font-semibold text-text-inverse shadow-warm transition-colors hover:bg-accent-hover"
            >
              Order online
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <LangProvider>
        <SiteFooter />
      </LangProvider>
    </div>
  );
}
