'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  );
}

/**
 * Keyboard behaviour for a modal dialog (WCAG 2.1.1, 2.1.2, 2.4.3):
 *
 *   1. On open, focus moves into the dialog: to the element marked
 *      `data-autofocus`, else the first focusable control, else the panel.
 *   2. Tab and Shift+Tab wrap inside the dialog while it is open.
 *   3. Escape calls `onClose`.
 *   4. On close, focus returns to whatever was focused before it opened
 *      (normally the button that opened it).
 *
 * `panelRef` must point at an element with tabIndex={-1} so it can take focus
 * when the dialog has no focusable content.
 */
export function useDialogFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  // Latest onClose without re-running the effect (and re-stealing focus) every
  // time a parent re-renders with a new inline callback.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const opener = document.activeElement as HTMLElement | null;

    const initial =
      panel.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(panel)[0] ?? panel;
    initial.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panel.contains(active)) {
        // Focus escaped (e.g. a click on the backdrop) — pull it back in.
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Only restore if the opener is still on the page; a dialog that
      // navigated away should not yank focus back to a detached node.
      if (opener && opener.isConnected && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
}
