'use client';

import Link from 'next/link';
import SiteFooter from '@/components/layout/site-footer';
import Image from 'next/image';
import { ShoppingBag, MapPin, User, Search } from 'lucide-react';
import { useCart } from '@/providers/cart-provider';
import { useClientAuth } from '@/providers/client-auth-provider';
import { useLang } from '@/providers/lang-provider';
import LangSwitcher from '@/components/ui/lang-switcher';
import SkipLink from '@/components/layout/skip-link';
import { fmt } from '@/lib/i18n';

function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/icon_main.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover shadow-sm" />
      <span className="text-lg font-extrabold leading-none text-primary-dark">
        The <span className="text-primary">Rollecito</span>
      </span>
    </span>
  );
}

export default function ClientChrome({ children }: { children: React.ReactNode }) {
  const { itemCount } = useCart();
  const { isAuthenticated, firebaseUser } = useClientAuth();
  const { t } = useLang();

  // max-[359px]:px-2 — at 320 CSS px (400% zoom, WCAG 1.4.10) the icon row
  // was 2px wider than the screen. Unchanged at every width from 360px up.
  const navLink =
    'flex items-center gap-1.5 rounded-full px-3 max-[359px]:px-2 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light/70 transition-colors';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink label={t.a11y.skipToContent} />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface shadow-[0_2px_12px_-4px_rgba(74,58,53,0.08)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="The Rollecito home">
            <BrandMark />
          </Link>
          <nav aria-label={t.a11y.mainNav} className="flex items-center gap-1">
            <Link href="/" className={`hidden md:flex ${navLink}`}>{t.nav.home}</Link>
            <Link href="/order" className={`hidden md:flex ${navLink}`}>{t.nav.menu}</Link>
            <LangSwitcher />
            <Link href="/track" className={navLink}>
              <Search size={16} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.tracking.trackOrder}</span>
            </Link>
            <Link href="/locations" className={navLink}>
              <MapPin size={16} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.nav.locations}</span>
            </Link>
            <Link href="/profile" className={navLink}>
              {isAuthenticated && firebaseUser?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firebaseUser.photoURL} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <User size={16} aria-hidden="true" />
              )}
              <span className="sr-only sm:not-sr-only">
                {isAuthenticated ? firebaseUser?.displayName?.split(' ')[0] || t.nav.profile : t.nav.profile}
              </span>
            </Link>
            <Link href="/cart" className={`relative ${navLink}`}>
              <ShoppingBag size={16} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t.nav.cart}</span>
              {itemCount > 0 && (
                <span className="sr-only">
                  {' '}({itemCount === 1 ? t.a11y.cartCountOne : fmt(t.a11y.cartCount, { n: itemCount })})
                </span>
              )}
              {itemCount > 0 && (
                <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-hover text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
