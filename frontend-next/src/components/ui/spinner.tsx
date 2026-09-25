import { cn } from '@/lib/utils/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /**
   * Text announced to screen readers. Pass `decorative` instead when the
   * spinner sits next to visible text that already says what is happening
   * (e.g. "Processing payment..."), so it is not read twice.
   */
  label?: string;
  decorative?: boolean;
}

export default function Spinner({ size = 'md', className, label = 'Loading…', decorative = false }: SpinnerProps) {
  const sizeClass = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' } as const;
  return (
    <div
      role={decorative ? undefined : 'status'}
      aria-hidden={decorative || undefined}
      className={cn(
        'animate-spin rounded-full border-2 border-border border-t-primary',
        sizeClass[size],
        className,
      )}
    >
      {!decorative && <span className="sr-only">{label}</span>}
    </div>
  );
}
