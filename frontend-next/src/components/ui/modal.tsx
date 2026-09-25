'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useDialogFocus } from '@/lib/hooks/use-dialog-focus';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Modal dialog. Exposed to assistive technology as role="dialog" with
 * aria-modal and its title as the accessible name; keyboard focus is moved
 * in, kept in, and returned on close by useDialogFocus. Escape closes it.
 */
export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useDialogFocus(open, panelRef, onClose);

  if (!open) return null;

  return (
    // Backdrop click is a pointer convenience; the keyboard equivalent is
    // Escape (useDialogFocus) and the Close button, so no key handler here.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'bg-surface rounded-2xl shadow-elevated w-full max-w-lg max-h-[85vh] overflow-y-auto',
          'focus:outline-none',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-secondary hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
