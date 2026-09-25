import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const variants = {
  primary: 'bg-primary text-text-inverse hover:bg-accent-hover shadow-[var(--shadow-warm)]',
  accent:
    'bg-accent text-primary-dark hover:bg-accent-hover hover:text-text-inverse shadow-[var(--shadow-warm)]',
  outline:
    'border-2 border-primary-dark text-primary-dark hover:bg-primary-dark hover:text-text-inverse',
  ghost: 'text-primary-dark hover:bg-primary-light/60',
  danger: 'bg-error text-text-inverse hover:bg-accent-hover',
} as const;

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-7 py-3.5 text-base',
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

/**
 * Button styling without the <button>. Use it to style a <Link> as a button.
 *
 * Wrapping <Button> in <Link> nests one interactive element inside another,
 * which is invalid HTML: keyboard users hit two tab stops for one action and
 * screen readers announce a "link, button" pair. A styled link is one control.
 */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200',
    // No focus classes here: the global :focus-visible rule in globals.css
    // draws the ring. The previous accent/50 ring measured 1.42:1 against
    // white, under the 3:1 minimum for a focus indicator.
    'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
