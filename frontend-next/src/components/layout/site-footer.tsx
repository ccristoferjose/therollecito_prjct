'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { useLang } from '@/providers/lang-provider';

/**
 * The public site footer, shared by BOTH the (client) and (marketing) layouts.
 *
 * It previously lived inline in client-chrome.tsx, so only the ordering pages
 * had it — home and /locations fell back to a one-line footer in the marketing
 * layout. Extracting it keeps a single source of truth for the business's
 * contact details, which had already drifted (the copy in client-chrome carried
 * a placeholder Miami phone number and no street address).
 *
 * It is a Client Component because the copy is translated via useLang, so any
 * layout rendering it must sit inside a LangProvider.
 */

function InstagramGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.43.42.7.82.92 1.4.17.42.37 1.03.42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2-.22.6-.5 1-.9 1.4-.42.43-.82.7-1.4.92-.42.17-1.03.37-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42-.6-.22-1-.5-1.4-.9-.43-.42-.7-.82-.92-1.4-.17-.42-.37-1.03-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.6.5-1 .9-1.4.42-.43.82-.7 1.4-.92.42-.17 1.03-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 5.4a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8Zm0 7.2a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Zm5.6-7.4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/icon_main.png"
        alt=""
        aria-hidden
        width={44}
        height={44}
        className="h-11 w-11 rounded-xl object-cover shadow-sm"
      />
      <span className="text-xl font-extrabold text-accent">Rollecito</span>
    </div>
  );
}

export default function SiteFooter() {
  const { t } = useLang();

  return (
    <footer className="bg-primary-dark text-[#FFF1DC]">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <BrandMark />
            <p className="mt-4 max-w-sm leading-relaxed text-[#FFF1DC]/80">{t.footer.tagline}</p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://www.instagram.com/therollecito?igsh=NTc4MTIwNjQ2YQ=="
                target="_blank"
                rel="noreferrer"
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
              <li><Link href="/" className="transition-colors hover:text-accent">{t.nav.home}</Link></li>
              <li><Link href="/order" className="transition-colors hover:text-accent">{t.nav.menu}</Link></li>
              <li><Link href="/locations" className="transition-colors hover:text-accent">{t.nav.locations}</Link></li>
              <li><Link href="/track" className="transition-colors hover:text-accent">{t.tracking.trackOrder}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-bold text-[#FFF1DC]">{t.footer.contact}</h4>
            <ul className="space-y-2.5 text-sm text-[#FFF1DC]/80">
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-accent" />
                <a href="mailto:hello@therollecito.com" className="transition-colors hover:text-accent">
                  hello@therollecito.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-accent" />
                <a href="tel:+13236129202" className="transition-colors hover:text-accent">
                  (323) 612-9202
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0 text-accent" />
                <a
                  href="https://maps.google.com/?q=620+El+Segundo+Blvd,+Los+Angeles,+CA+90059"
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-accent"
                >
                  620 El Segundo Blvd, Los Angeles, CA 90059
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Clock size={14} className="mt-0.5 shrink-0 text-accent" />
                <span className="whitespace-pre-line">{t.footer.hoursValue}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[#FFF1DC]/15 pt-6 text-sm text-[#FFF1DC]/60 sm:flex-row">
          {/* Year is rendered client-side; this component is already a Client
              Component, so there is no SSR/CSR mismatch to guard against. */}
          <p>&copy; {new Date().getFullYear()} The Rollecito. {t.footer.rights}</p>
          <p>Baked with love in Los Angeles.</p>
        </div>
      </div>
    </footer>
  );
}
