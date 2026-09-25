'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

/**
 * One polite live region for the client portal (WCAG 4.1.3 Status Messages).
 *
 * Changes that happen away from keyboard focus — an item landing in the cart,
 * a promo code being accepted, the kitchen marking an order ready — are
 * otherwise silent for screen-reader users. Call `announce()` for those.
 *
 * Use it sparingly: only for results of the user's own action or for changes
 * they are explicitly waiting on. Errors that block progress should render an
 * inline role="alert" next to the field instead, so they stay on screen.
 */
type Announce = (message: string) => void;

const AnnouncerContext = createContext<Announce | null>(null);

export function AnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<Announce>((next) => {
    if (timer.current) clearTimeout(timer.current);
    // Clear first, then set on the next tick: screen readers only announce a
    // CHANGE, so the same message twice in a row ("Added to cart" for a second
    // item) would otherwise be dropped.
    setMessage('');
    timer.current = setTimeout(() => setMessage(next), 50);
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

/** No-op outside the provider, so shared components never crash on it. */
export function useAnnounce(): Announce {
  return useContext(AnnouncerContext) ?? (() => {});
}
