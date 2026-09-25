import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Visible helper text, linked to the input with aria-describedby. */
  hint?: string;
}

/**
 * Labelled text input. The <label> is programmatically tied to the input, and
 * `error` / `hint` are exposed through aria-describedby, with aria-invalid set
 * while an error is shown (WCAG 1.3.1, 3.3.1, 4.1.2).
 */
export default function Input({ label, error, hint, className, id, ...props }: InputProps) {
  // useId, not a slug of the label: two inputs with the same label (or a label
  // that changes with the language) must never share or lose their id.
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm',
          'placeholder:text-text-secondary/60',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
          error && 'border-error focus:ring-error/30',
          className,
        )}
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={describedBy}
      />
      {hint && (
        <p id={hintId} className="text-xs text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
