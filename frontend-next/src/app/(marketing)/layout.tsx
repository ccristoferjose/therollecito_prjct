import { LangProvider } from '@/providers/lang-provider';
import { ClientAuthProvider } from '@/providers/client-auth-provider';
import { CartProvider } from '@/providers/cart-provider';
import SiteHeader from '@/components/layout/site-header';
import SiteFooter from '@/components/layout/site-footer';
import SkipLink from '@/components/layout/skip-link';

/**
 * PUBLIC marketing layout — Server Component. Chrome for the indexable
 * marketing pages (home, locations, legal). Exposes only client-facing actions
 * (browse + order); no staff/admin entry points here.
 *
 * The header and footer are the SAME components the ordering pages use, so the
 * navbar (Home, Menu, language, Track Order, Locations, Profile, Cart) is
 * identical everywhere. Both are Client Components (translated copy, cart
 * count, signed-in name), hence the providers. Wrapping `children` in client
 * providers does not make the page a client page: Server Component children
 * are still rendered on the server, so the content stays fully SEO-rendered.
 *
 * syncDocumentLang off: only the header and footer are translated on these
 * pages, so a saved Spanish preference must not relabel the English page.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider syncDocumentLang={false}>
      <ClientAuthProvider>
        <CartProvider>
          <div className="flex min-h-screen flex-col">
            <SkipLink />
            <SiteHeader />

            <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>

            <SiteFooter />
          </div>
        </CartProvider>
      </ClientAuthProvider>
    </LangProvider>
  );
}
