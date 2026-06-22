'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, MapPin, User, Search, Mail, Phone, Clock } from 'lucide-react';
import { useCart } from '@/providers/cart-provider';
import { useClientAuth } from '@/providers/client-auth-provider';
import { useLang } from '@/providers/lang-provider';
import LangSwitcher from '@/components/ui/lang-switcher';

function InstagramGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/icon_main.png" alt="" aria-hidden width={40} height={40} className="h-10 w-10 rounded-xl object-cover shadow-sm" />
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

  const navLink =
    'flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light/70 transition-colors';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface shadow-[0_2px_12px_-4px_rgba(74,58,53,0.08)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="The Rollecito home">
            <BrandMark />
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className={`hidden md:flex ${navLink}`}>{t.nav.home}</Link>
            <Link href="/order" className={`hidden md:flex ${navLink}`}>{t.nav.menu}</Link>
            <LangSwitcher />
            <Link href="/track" className={navLink}>
              <Search size={16} />
              <span className="hidden sm:inline">{t.tracking.trackOrder}</span>
            </Link>
            <Link href="/locations" className={navLink}>
              <MapPin size={16} />
              <span className="hidden sm:inline">{t.nav.locations}</span>
            </Link>
            <Link href="/profile" className={navLink}>
              {isAuthenticated && firebaseUser?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firebaseUser.photoURL} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <User size={16} />
              )}
              <span className="hidden sm:inline">
                {isAuthenticated ? firebaseUser?.displayName?.split(' ')[0] || t.nav.profile : t.nav.profile}
              </span>
            </Link>
            <Link href="/cart" className={`relative ${navLink}`}>
              <ShoppingBag size={16} />
              <span className="hidden sm:inline">{t.nav.cart}</span>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-hover text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-primary-dark text-[#FFF1DC]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <BrandMark />
              <p className="mt-4 max-w-sm leading-relaxed text-[#FFF1DC]/80">{t.footer.tagline}</p>
              <div className="mt-5 flex items-center gap-3">
                <a
                  href="https://www.instagram.com/therollecito"
                  aria-label="Instagram"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1DC]/10 transition-colors hover:bg-accent-hover"
                >
                  <InstagramGlyph width="16" height="16" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="mb-4 font-bold text-[#FFF1DC]">{t.footer.quickLinks}</h4>
              <ul className="space-y-2 text-sm text-[#FFF1DC]/80">
                <li><Link href="/" className="hover:text-accent">{t.nav.home}</Link></li>
                <li><Link href="/order" className="hover:text-accent">{t.nav.menu}</Link></li>
                <li><Link href="/locations" className="hover:text-accent">{t.nav.locations}</Link></li>
                <li><Link href="/track" className="hover:text-accent">{t.tracking.trackOrder}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold text-[#FFF1DC]">{t.footer.contact}</h4>
              <ul className="space-y-2.5 text-sm text-[#FFF1DC]/80">
                <li className="flex items-center gap-2">
                  <Mail size={14} className="text-accent" />
                  <a href="mailto:hello@therollecito.com" className="hover:text-accent">hello@therollecito.com</a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={14} className="text-accent" />
                  <span>(305) 555-0101</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span>{t.footer.hoursValue}</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[#FFF1DC]/15 pt-6 text-sm text-[#FFF1DC]/60 sm:flex-row">
            <p>&copy; The Rollecito. {t.footer.rights}</p>
            <p>Baked with love in Miami.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
