import Link from 'next/link';

/**
 * PUBLIC marketing layout — Server Component. SEO-focused chrome (header/footer)
 * shared by the indexable marketing pages. Exposes only client-facing actions
 * (browse + order); no staff/admin entry points here.
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

      <footer className="border-t border-border bg-surface-warm">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-text-secondary">
          © The Rollecito — fresh-baked rolls, ordered online for pickup.
        </div>
      </footer>
    </div>
  );
}
