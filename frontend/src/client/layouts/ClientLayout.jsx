import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  MapPin,
  User,
  Search,
  Mail,
  Phone,
  Clock,
} from 'lucide-react';
import { useCart } from '@shared/context/CartContext';

// Brand social glyphs — bundled inline so we don't depend on the
// installed lucide-react version exposing these icons.
const InstagramGlyph = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const FacebookGlyph = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.5 1.6-1.5H16.6V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.4H7.5v3h2.5V21h3.5z" />
  </svg>
);
const TwitterGlyph = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M18.2 3h3L14.4 10.7 22.3 21h-6.2l-4.9-6.4L5.6 21H2.6l7.3-8.3L2.2 3h6.4l4.5 5.9L18.2 3zm-1 16h1.6L7 4.9H5.3L17.2 19z" />
  </svg>
);
import { useClientAuth } from '@shared/context/ClientAuthContext';
import { useLang } from '@shared/context/LangContext';
import LangSwitcher from '@shared/components/LangSwitcher';

function BrandMark({ size = 'md' }) {
  const sizes = {
    sm: { outer: 'h-9 w-9', text: 'text-base' },
    md: { outer: 'h-10 w-10', text: 'text-lg' },
  };
  const s = sizes[size];
  return (
    <span className="flex items-center gap-2.5">
      <img
        src="/icon_main.png"
        alt=""
        aria-hidden="true"
        className={`${s.outer} rounded-xl object-cover shadow-sm`}
      />
      <span className={`font-extrabold ${s.text} text-primary-dark leading-none`}>
        The <span className="text-primary">Rollecito</span>
      </span>
    </span>
  );
}

export default function ClientLayout() {
  const { itemCount } = useCart();
  const { isAuthenticated, firebaseUser } = useClientAuth();
  const { t } = useLang();
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* =================== Sticky Navigation =================== */}
      <header
        className={`sticky top-0 z-40 border-b border-border/60 ${
          isLanding
            ? 'bg-[#FFF1DC]/85 backdrop-blur-md shadow-[0_2px_12px_-4px_rgba(74,58,53,0.08)]'
            : 'bg-surface shadow-[0_2px_12px_-4px_rgba(74,58,53,0.08)]'
        }`}
      >
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-16">
          <Link to="/" aria-label="The Rollecito home">
            <BrandMark />
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className="hidden md:flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light/70 transition-colors"
            >
              {t.nav.home}
            </Link>
            <Link
              to="/order"
              className="hidden md:flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light/70 transition-colors"
            >
              {t.nav.menu}
            </Link>
            <LangSwitcher />
            <Link
              to="/track"
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light/70 transition-colors"
            >
              <Search size={16} />
              <span className="hidden sm:inline">{t.tracking?.trackOrder || 'Track'}</span>
            </Link>
            <Link
              to="/locations"
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light/70 transition-colors"
            >
              <MapPin size={16} />
              <span className="hidden sm:inline">{t.nav.locations}</span>
            </Link>
            <Link
              to="/profile"
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light/70 transition-colors"
            >
              {isAuthenticated && firebaseUser?.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt=""
                  className="h-6 w-6 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User size={16} />
              )}
              <span className="hidden sm:inline">
                {isAuthenticated
                  ? firebaseUser?.displayName?.split(' ')[0] || t.nav.profile
                  : t.nav.profile}
              </span>
            </Link>
            <Link
              to="/cart"
              className="relative flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-light/70 transition-colors"
            >
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

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* =================== Footer =================== */}
      <footer className="bg-primary-dark text-[#FFF1DC]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 md:grid-cols-4">
            {/* brand column */}
            <div className="md:col-span-2">
              <BrandMark />
              <p className="mt-4 text-[#FFF1DC]/80 max-w-sm leading-relaxed">
                {t.footer.tagline}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <a
                  href="#"
                  aria-label="Instagram"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1DC]/10 transition-colors hover:bg-accent-hover"
                >
                  <InstagramGlyph width="16" height="16" />
                </a>
                <a
                  href="#"
                  aria-label="Facebook"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1DC]/10 transition-colors hover:bg-accent-hover"
                >
                  <FacebookGlyph width="16" height="16" />
                </a>
                <a
                  href="#"
                  aria-label="Twitter"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1DC]/10 transition-colors hover:bg-accent-hover"
                >
                  <TwitterGlyph width="16" height="16" />
                </a>
              </div>
            </div>

            {/* quick links */}
            <div>
              <h4 className="font-bold text-[#FFF1DC] mb-4">{t.footer.quickLinks}</h4>
              <ul className="space-y-2 text-sm text-[#FFF1DC]/80">
                <li>
                  <Link to="/" className="hover:text-accent transition-colors">
                    {t.nav.home}
                  </Link>
                </li>
                <li>
                  <Link to="/order" className="hover:text-accent transition-colors">
                    {t.nav.menu}
                  </Link>
                </li>
                <li>
                  <Link to="/locations" className="hover:text-accent transition-colors">
                    {t.nav.locations}
                  </Link>
                </li>
                <li>
                  <Link to="/track" className="hover:text-accent transition-colors">
                    {t.tracking?.trackOrder || 'Track Order'}
                  </Link>
                </li>
              </ul>
            </div>

            {/* contact */}
            <div>
              <h4 className="font-bold text-[#FFF1DC] mb-4">{t.footer.contact}</h4>
              <ul className="space-y-2.5 text-sm text-[#FFF1DC]/80">
                <li className="flex items-center gap-2">
                  <Mail size={14} className="text-accent" />
                  <a href="mailto:hello@therollecito.com" className="hover:text-accent transition-colors">
                    hello@therollecito.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={14} className="text-accent" />
                  <span>(305) 555-0101</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>{t.footer.hoursValue}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-[#FFF1DC]/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#FFF1DC]/60">
            <p>&copy; {new Date().getFullYear()} The Rollecito. {t.footer.rights}</p>
            <p>Baked with love in Miami.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
