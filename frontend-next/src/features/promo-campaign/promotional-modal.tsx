'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useDialogFocus } from '@/lib/hooks/use-dialog-focus';
import type { ActivePromoCampaign, PromoFrequency } from '@/features/promo-campaign/types';

const STORAGE_KEY = 'rollecito_promo_seen';

/**
 * The promotional modal. The ARTWORK is the content — the restaurant's designer
 * puts the offer, the code and the styling into the image itself, and this
 * component only supplies the frame, the dismiss and the call to action.
 *
 * Frequency is enforced against browser storage rather than an account, because
 * this runs on the anonymous marketing homepage where there is no user to
 * record impressions against. That makes it per-device and best-effort by
 * design: clearing site data shows the promo again, which is the right failure
 * direction for marketing.
 */

/** Has this campaign already been seen, under its own frequency rule? */
function wasSeen(campaignId: number, frequency: PromoFrequency): boolean {
  if (frequency === 'always') return false;
  try {
    const store = frequency === 'once_per_session' ? window.sessionStorage : window.localStorage;
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return false;
    const seen = JSON.parse(raw) as Record<string, string>;
    const stamp = seen[String(campaignId)];
    if (!stamp) return false;
    // once_per_session: any stamp in sessionStorage means "already shown".
    if (frequency === 'once_per_session') return true;
    // once_per_day: the stamp is a calendar date, so it lapses at midnight
    // local time rather than 24h after the last view.
    return stamp === new Date().toDateString();
  } catch {
    // Private mode / blocked storage — show it rather than hide it.
    return false;
  }
}

function markSeen(campaignId: number, frequency: PromoFrequency): void {
  if (frequency === 'always') return;
  try {
    const store = frequency === 'once_per_session' ? window.sessionStorage : window.localStorage;
    const raw = store.getItem(STORAGE_KEY);
    const seen = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    seen[String(campaignId)] = new Date().toDateString();
    store.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // Storage unavailable — the modal simply shows again next visit.
  }
}

export default function PromotionalModal() {
  const [campaign, setCampaign] = useState<ActivePromoCampaign | null>(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { campaign: active } = await api.get<{ campaign: ActivePromoCampaign | null }>(
          '/promo-campaigns/active',
        );
        if (cancelled || !active) return;
        // Needs artwork to be worth showing at all.
        if (!active.image_desktop_url && !active.image_mobile_url) return;
        if (wasSeen(active.id, active.frequency)) return;
        setCampaign(active);
        setOpen(true);
      } catch {
        // A promo is never worth breaking the homepage over.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (campaign) markSeen(campaign.id, campaign.frequency);
  }, [campaign]);

  // Hold the background still while the modal is up.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Focus in on open, Tab kept inside, Escape to dismiss, focus back on close.
  // It opens on its own over the landing page, so without this a keyboard
  // user kept tabbing through the page hidden behind it.
  useDialogFocus(open && !!campaign, panelRef, close);

  if (!open || !campaign) return null;

  const desktop = campaign.image_desktop_url || campaign.image_mobile_url!;
  const mobile = campaign.image_mobile_url || campaign.image_desktop_url!;
  // The artwork carries the entire message, so it must never be decorative-only.
  const alt = campaign.image_alt?.trim() || campaign.name;

  return (
    // Backdrop click closes (only a click on the backdrop itself, so the
    // dialog needs no stopPropagation handler). Keyboard users have Escape and
    // the Close button.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onClick={(e) => e.target === e.currentTarget && close()}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={campaign.name}
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-elevated)]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close promotion"
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
        >
          <X size={22} aria-hidden="true" />
        </button>

        {/* The image is the content. <picture> so a vertical, Instagram-shaped
            promo is used on phones and a wide one on desktop, instead of
            letterboxing whichever single asset was uploaded.
            Plain <img>: the artwork lives on the S3/CDN origin and is authored
            at its final size, so next/image would add a proxy hop for nothing. */}
        <div className="overflow-y-auto">
          <picture>
            <source media="(max-width: 768px)" srcSet={mobile} />
            <img
              src={desktop}
              alt={alt}
              className="block h-auto w-full object-contain"
          />
          </picture>

          {campaign.promo_code && (
            <div className="px-6 pt-5 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Use code
              </p>
              <p className="mt-1 select-all text-2xl font-extrabold tracking-widest text-primary-dark">
                {campaign.promo_code}
              </p>
            </div>
          )}
        </div>

        {campaign.button_text && campaign.button_url && (
          <div className="border-t border-border/60 p-4">
            <Link
              href={campaign.button_url}
              onClick={close}
              className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-accent px-6 text-lg font-bold text-primary-dark shadow-[var(--shadow-warm)] transition-colors hover:bg-accent-hover hover:text-text-inverse active:scale-[0.99]"
            >
              {campaign.button_text}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
